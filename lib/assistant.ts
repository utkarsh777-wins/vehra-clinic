import { timingSafeEqual } from "crypto"

import {
  confirmationCopy,
  handleTurn,
  initialSession,
  validateAppointment,
  type Session,
} from "@/lib/booking"
import { getPublicClinic } from "@/lib/clinic"
import { emergencyReply, isEmergency } from "@/lib/emergency"
import { noteSecretFailure, noteSecretSuccess, secretLocked, viewSecretProblem } from "@/lib/guard"
import { answerWithLlm, llmConfig } from "@/lib/llm"
import { readSignedSession, signSession } from "@/lib/session-sign"
import { listBookings, saveBooking, type StoredBooking } from "@/lib/store"
import { resolveLocale, voice, type Locale } from "@/lib/voice"

export type ChatSuccess = {
  status: 200
  body: {
    reply: string
    session: Session
    sessionToken: string
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
    sampleLabel: string
  }
}

export type ChatFailure = { status: 400 | 413 | 415 | 500; body: { error: string } }

export async function runAssistantTurn(input: {
  message?: unknown
  session?: unknown
  sessionToken?: unknown
  intent?: unknown
  draft?: unknown
  locale?: unknown
  idempotencyKey?: unknown
  supersedes?: unknown
  now?: Date
}): Promise<ChatSuccess | ChatFailure> {
  const locale = resolveLocale(textOf(input), input.locale)
  if (input.intent === "submit_booking") {
    return submitBooking(input.draft, input.now ?? new Date(), locale, input.idempotencyKey, input.supersedes, typeof input.sessionToken === "string" ? input.sessionToken : undefined)
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
  const incoming = readSignedSession(input.session, input.sessionToken)
  const turn = handleTurn({
    message: input.message,
    session: incoming,
    intent,
    clinic,
    now,
    locale,
  })

  let reply = turn.reply
  let session = turn.session
  let source: "rules" | "llm" = "rules"
  let booking: ChatSuccess["body"]["booking"] = null

  if (turn.llmEligible && !isEmergency(input.message) && llmConfig().enabled && input.message.trim()) {
    try {
      const llmReply = await answerWithLlm(input.message, clinic, locale)
      reply = turn.reprompt ? `${llmReply}\n\n${turn.reprompt}` : llmReply
      source = "llm"
    } catch {
      source = "rules"
    }
  }

  if (turn.pending) {
    const checked = validateAppointment(turn.pending, clinic, now, locale)
    if (!checked.ok || isEmergency(turn.pending.name)) {
      return {
        status: 200,
        body: {
          reply: isEmergency(turn.pending.name) ? emergencyReply(locale) : checked.ok ? emergencyReply(locale) : checked.error,
          session: incoming.step ? incoming : { ...incoming, mode: "booking", step: "confirm" },
          sessionToken: signSession(incoming.step ? incoming : { ...incoming, mode: "booking", step: "confirm" }),
          suggestions: ["Yes, submit", "Cancel"],
          source: "rules",
          booking: null,
          sampleLabel: clinic.sampleLabel,
          field: checked.ok ? "name" : checked.field,
        },
      }
    }
    try {
      const saved = await saveBooking(
        {
          ...checked.request,
          language: locale,
          idempotencyKey: cleanKey(input.idempotencyKey),
          supersedes: cleanId(input.supersedes),
          sessionToken: typeof input.sessionToken === "string" ? input.sessionToken : undefined,
        },
        now,
      )
      reply = `${turn.reply}\n\n${deliveryLine(saved.booking.id, saved.webhook, saved.replay, locale)}`
      booking = publicBooking(saved.booking, saved.webhook)
      session = turn.session
    } catch {
      const held = incoming.step ? incoming : { ...incoming, mode: "booking" as const, step: "confirm" as const }
      return {
        status: 200,
        body: {
          reply: "I could not store that request on this server. Please try again in a moment.",
          session: held,
          sessionToken: signSession(held),
          suggestions: ["Yes, submit", "Cancel"],
          source: "rules",
          booking: null,
          sampleLabel: clinic.sampleLabel,
        },
      }
    }
  }

  return {
    status: 200,
    body: {
      reply,
      session,
      sessionToken: signSession(session),
      suggestions: turn.suggestions,
      source,
      booking,
      faqId: turn.faqId,
      sampleLabel: clinic.sampleLabel,
    },
  }
}

async function submitBooking(
  draft: unknown,
  now: Date,
  locale: Locale,
  idempotencyKey: unknown,
  supersedes: unknown,
  sessionToken?: string,
): Promise<ChatSuccess | ChatFailure> {
  const clinic = getPublicClinic()
  const record =
    draft && typeof draft === "object"
      ? (draft as { name?: unknown; phone?: unknown; date?: unknown; time?: unknown; reason?: unknown })
      : {}
  const blob = typeof record.name === "string" ? record.name : ""
  if (isEmergency(blob)) {
    return {
      status: 200,
      body: {
        reply: emergencyReply(resolveLocale(blob, locale)),
        session: initialSession(),
        sessionToken: signSession(initialSession()),
        suggestions: [],
        source: "rules",
        booking: null,
        sampleLabel: clinic.sampleLabel,
        field: "name",
      },
    }
  }
  const validated = validateAppointment(record, clinic, now, locale)
  if (!validated.ok) {
    return {
      status: 200,
      body: {
        reply: validated.error,
        session: initialSession(),
        sessionToken: signSession(initialSession()),
        suggestions: [],
        source: "rules",
        booking: null,
        sampleLabel: clinic.sampleLabel,
        field: validated.field,
      },
    }
  }
  try {
    const saved = await saveBooking(
      {
        ...validated.request,
        language: locale,
        idempotencyKey: cleanKey(idempotencyKey),
        supersedes: cleanId(supersedes),
        sessionToken,
      },
      now,
    )
    const reply = `${confirmationCopy(validated.request, locale)}\n\n${deliveryLine(saved.booking.id, saved.webhook, saved.replay, locale)}`
    return {
      status: 200,
      body: {
        reply,
        session: initialSession(),
        sessionToken: signSession(initialSession()),
        suggestions: ["Change details", "Ask something else"],
        source: "rules",
        booking: publicBooking(saved.booking, saved.webhook),
        sampleLabel: clinic.sampleLabel,
      },
    }
  } catch {
    return { status: 500, body: { error: "I could not store that request on this server." } }
  }
}

function deliveryLine(id: string, webhook: "skipped" | "sent" | "failed", replay: boolean, locale: Locale): string {
  const v = voice(locale)
  if (replay) return `${v.received} Reference ${id} · already received.`
  const delivery = webhook === "sent" ? "sent to the clinic sheet" : "not sent yet"
  let line = `Reference ${id} · ${delivery}.`
  if (webhook === "failed") {
    line += " The optional spreadsheet webhook did not accept it. The request is still in the local log."
  }
  return line
}

function publicBooking(booking: StoredBooking, webhook: "skipped" | "sent" | "failed"): ChatSuccess["body"]["booking"] {
  return {
    id: booking.id,
    webhook,
    name: booking.name,
    phone: booking.phone,
    date: booking.date,
    time: booking.time,
    reason: booking.reason,
  }
}

function textOf(input: { message?: unknown; draft?: unknown }): string {
  if (typeof input.message === "string" && input.message.trim()) return input.message
  if (input.draft && typeof input.draft === "object") {
    const draft = input.draft as { name?: unknown; reason?: unknown }
    return `${typeof draft.name === "string" ? draft.name : ""} ${typeof draft.reason === "string" ? draft.reason : ""}`
  }
  return ""
}

function cleanKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const key = value.trim()
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) return undefined
  return key
}

function cleanId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const id = value.trim()
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return undefined
  return id
}

export function clockFromRequest(request: Request): Date {
  if (process.env.NODE_ENV === "test") {
    const raw = request.headers.get("x-clock")
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
  | { status: 401 | 429 | 503 | 500; body: { error: string } }
> {
  const problem = viewSecretProblem()
  if (problem) return { status: 503, body: { error: problem } }
  if (secretLocked(request)) {
    return { status: 429, body: { error: "Too many attempts. Try again later." } }
  }
  const secret = process.env.BOOKINGS_VIEW_SECRET?.trim() || ""
  const provided = request.headers.get("x-bookings-secret")?.trim() || ""
  if (!provided || !secretsMatch(provided, secret)) {
    noteSecretFailure(request)
    return { status: 401, body: { error: "That secret does not match." } }
  }
  noteSecretSuccess(request)
  try {
    const bookings = await listBookings()
    return { status: 200, body: { bookings } }
  } catch {
    return { status: 500, body: { error: "The request log could not be read." } }
  }
}

export { initialSession }
