import { timingSafeEqual } from "crypto"

import { confirmationCopy, coerceSession, handleTurn, initialSession, validateAppointment, type Session } from "@/lib/booking"
import { getPublicClinic } from "@/lib/clinic"
import { answerWithLlm, llmConfig } from "@/lib/llm"
import { listBookings, saveBooking, type StoredBooking } from "@/lib/store"

export type ChatSuccess = {
  status: 200
  body: {
    reply: string
    session: Session
    suggestions: string[]
    source: "rules" | "llm"
    booking: null | {
      id: string
      webhook: "skipped" | "sent" | "failed"
      name: string
      phone: string
      date: string
      time: string
      reason: string
    }
    faqId?: string
    field?: string
    demoLabel: string
  }
}

export type ChatFailure = { status: 400 | 500; body: { error: string } }

export async function runAssistantTurn(input: {
  message?: unknown
  session?: unknown
  intent?: unknown
  draft?: unknown
  now?: Date
}): Promise<ChatSuccess | ChatFailure> {
  if (input.intent === "submit_booking") {
    return submitBooking(input.draft, input.now ?? new Date())
  }
  if (typeof input.message !== "string") {
    return { status: 400, body: { error: "Message must be a string." } }
  }
  if (input.message.length > 1000) {
    return { status: 400, body: { error: "Message is too long." } }
  }
  const intent = input.intent === "start_booking" ? "start_booking" : undefined
  if (!input.message.trim() && intent !== "start_booking") {
    return { status: 400, body: { error: "Message is empty." } }
  }

  const clinic = getPublicClinic()
  const now = input.now ?? new Date()
  const incoming = coerceSession(input.session)
  const turn = handleTurn({
    message: input.message,
    session: incoming,
    intent,
    clinic,
    now,
  })

  let reply = turn.reply
  let session = turn.session
  let source: "rules" | "llm" = "rules"
  let booking: ChatSuccess["body"]["booking"] = null

  if (turn.llmEligible && llmConfig().enabled && input.message.trim()) {
    try {
      const llmReply = await answerWithLlm(input.message, clinic)
      reply = turn.reprompt ? `${llmReply}\n\n${turn.reprompt}` : llmReply
      source = "llm"
    } catch {
      source = "rules"
    }
  }

  if (turn.pending) {
    try {
      const saved = await saveBooking(turn.pending, now)
      const delivery = saved.webhook === "sent" ? "sent to the clinic sheet" : "demo, not sent"
      reply = `${turn.reply}\n\nReference ${saved.booking.id} · ${delivery}.`
      if (saved.webhook === "failed") {
        reply += " The optional spreadsheet webhook did not accept it. The request is still in the demo log."
      }
      booking = {
        id: saved.booking.id,
        webhook: saved.webhook,
        name: saved.booking.name,
        phone: saved.booking.phone,
        date: saved.booking.date,
        time: saved.booking.time,
        reason: saved.booking.reason,
      }
      session = turn.session
    } catch {
      return {
        status: 200,
        body: {
          reply: "I could not store that request on this server. Please try again in a moment.",
          session: incoming.step ? incoming : { ...incoming, mode: "booking", step: "confirm" },
          suggestions: ["Yes, submit", "Cancel"],
          source: "rules",
          booking: null,
          demoLabel: clinic.demoLabel,
        },
      }
    }
  }

  return {
    status: 200,
    body: {
      reply,
      session,
      suggestions: turn.suggestions,
      source,
      booking,
      faqId: turn.faqId,
      demoLabel: clinic.demoLabel,
    },
  }
}

async function submitBooking(draft: unknown, now: Date): Promise<ChatSuccess | ChatFailure> {
  const clinic = getPublicClinic()
  const validated = validateAppointment(
    draft && typeof draft === "object" ? (draft as { name?: unknown; phone?: unknown; date?: unknown; time?: unknown; reason?: unknown }) : {},
    clinic,
    now,
  )
  if (!validated.ok) {
    return {
      status: 200,
      body: {
        reply: validated.error,
        session: initialSession(),
        suggestions: [],
        source: "rules",
        booking: null,
        demoLabel: clinic.demoLabel,
        field: validated.field,
      },
    }
  }
  try {
    const saved = await saveBooking(validated.request, now)
    const delivery = saved.webhook === "sent" ? "sent to the clinic sheet" : "demo, not sent"
    let reply = `${confirmationCopy(validated.request)}\n\nReference ${saved.booking.id} · ${delivery}.`
    if (saved.webhook === "failed") {
      reply += " The optional spreadsheet webhook did not accept it. The request is still in the demo log."
    }
    return {
      status: 200,
      body: {
        reply,
        session: initialSession(),
        suggestions: ["Change details", "Ask something else"],
        source: "rules",
        booking: {
          id: saved.booking.id,
          webhook: saved.webhook,
          name: saved.booking.name,
          phone: saved.booking.phone,
          date: saved.booking.date,
          time: saved.booking.time,
          reason: saved.booking.reason,
        },
        demoLabel: clinic.demoLabel,
      },
    }
  } catch {
    return { status: 500, body: { error: "I could not store that request on this server." } }
  }
}

export function clockFromRequest(request: Request): Date {
  if (process.env.NODE_ENV === "test") {
    const raw = request.headers.get("x-demo-now")
    if (raw) {
      const date = new Date(raw)
      if (!Number.isNaN(date.getTime())) return date
    }
  }
  return new Date()
}

export function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    timingSafeEqual(right, right)
    return false
  }
  return timingSafeEqual(left, right)
}

export async function readBookings(request: Request): Promise<
  | { status: 200; body: { bookings: StoredBooking[] } }
  | { status: 401 | 503 | 500; body: { error: string } }
> {
  const secret = process.env.BOOKINGS_VIEW_SECRET?.trim() || ""
  if (!secret) {
    return {
      status: 503,
      body: { error: "BOOKINGS_VIEW_SECRET is not set, so the demo log is closed." },
    }
  }
  const provided = request.headers.get("x-bookings-secret")?.trim() || ""
  if (!provided || !secretsMatch(provided, secret)) {
    return { status: 401, body: { error: "That secret does not match." } }
  }
  try {
    const bookings = await listBookings()
    return { status: 200, body: { bookings } }
  } catch {
    return { status: 500, body: { error: "The demo log could not be read." } }
  }
}

export { initialSession }
