import { formatClinicDate, formatTime } from "@/lib/calendar"
import type { ClinicContent } from "@/lib/clinic"
import { matchFaq } from "@/lib/faq"
import { parseIndianMobile } from "@/lib/phone"
import { cleanText, normalize } from "@/lib/text"
import { parseWhen, validateSlot } from "@/lib/when"

export type BookingStep = "name" | "phone" | "when" | "reason" | "confirm"

export type Draft = {
  name?: string
  phone?: string
  date?: string
  time?: string
  reason?: string
}

export type Session = {
  mode: "faq" | "booking"
  step: BookingStep | null
  draft: Draft
}

export type AppointmentRequest = {
  name: string
  phone: string
  date: string
  time: string
  reason: string
}

export type Turn = {
  reply: string
  session: Session
  suggestions: string[]
  pending?: AppointmentRequest
  llmEligible: boolean
  reprompt?: string
  faqId?: string
}

const STEPS = new Set<BookingStep>(["name", "phone", "when", "reason", "confirm"])

const YES = new Set([
  "yes",
  "y",
  "yeah",
  "yep",
  "confirm",
  "confirmed",
  "ok",
  "okay",
  "haan",
  "han",
  "theek",
  "theek hai",
  "submit",
  "yes submit",
  "please submit",
  "looks good",
  "correct",
  "go ahead",
])

export function initialSession(): Session {
  return { mode: "faq", step: null, draft: {} }
}

function coerceDraft(input: unknown): Draft {
  if (!input || typeof input !== "object") return {}
  const draft = input as Draft
  const next: Draft = {}
  if (typeof draft.name === "string") next.name = draft.name
  if (typeof draft.phone === "string") next.phone = draft.phone
  if (typeof draft.date === "string") next.date = draft.date
  if (typeof draft.time === "string") next.time = draft.time
  if (typeof draft.reason === "string") next.reason = draft.reason
  return next
}

export function coerceSession(input: unknown): Session {
  if (!input || typeof input !== "object") return initialSession()
  const record = input as Partial<Session>
  const mode = record.mode === "booking" ? "booking" : "faq"
  const step = mode === "booking" && record.step && STEPS.has(record.step) ? record.step : mode === "booking" ? "name" : null
  return { mode, step, draft: coerceDraft(record.draft) }
}

export function isBookingRequest(message: string): boolean {
  const text = normalize(message)
  if (!text) return false
  if (/^(how|what|when|where|who|why)\b/.test(text)) return false
  if (/^(book|booking|appointment|schedule)( an appointment| a visit)?$/.test(text)) return true
  if (/\b(book|booking|schedule)\b/.test(text) && /\b(appointment|visit|slot|consultation)\b/.test(text)) {
    return true
  }
  if (/\b(i want|i need|i would like|id like|i'd like|can i|could i|please)\b/.test(text) && /\b(book|appointment|schedule)\b/.test(text)) {
    return true
  }
  return false
}

export function parseName(input: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = cleanText(input, 60)
  if (name.length < 2 || name.length > 60 || !/^[\p{L}][\p{L}\s.'-]{1,59}$/u.test(name)) {
    return { ok: false, error: "Please share a name using letters, for example Meher Kaur." }
  }
  return { ok: true, name }
}

export function validateAppointment(
  draft: { name?: unknown; phone?: unknown; date?: unknown; time?: unknown; reason?: unknown },
  clinic: ClinicContent,
  now: Date,
): { ok: true; request: AppointmentRequest } | { ok: false; field: "name" | "phone" | "date" | "time" | "reason"; error: string } {
  const name = parseName(typeof draft.name === "string" ? draft.name : "")
  if (!name.ok) return { ok: false, field: "name", error: name.error }
  const phone = parseIndianMobile(typeof draft.phone === "string" ? draft.phone : "")
  if (!phone.ok) return { ok: false, field: "phone", error: "Please enter a 10-digit mobile number." }
  const date = typeof draft.date === "string" ? draft.date.trim() : ""
  const timeRaw = typeof draft.time === "string" ? draft.time.trim().toLowerCase() : ""
  const time = timeRaw === "morning" || timeRaw === "evening" ? timeRaw : timeRaw
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, field: "date", error: "Please choose a date." }
  }
  if (time !== "morning" && time !== "evening" && !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, field: "time", error: "Please choose morning or evening." }
  }
  const slot = validateSlot(date, time, now, clinic.hours)
  if (slot) return { ok: false, field: time === "morning" || time === "evening" ? "time" : "date", error: slot }
  const reasonText = typeof draft.reason === "string" ? draft.reason : ""
  const reason = reasonText.trim() ? parseReason(reasonText) : { ok: true as const, reason: "" }
  if (!reason.ok) return { ok: false, field: "reason", error: reason.error }
  return {
    ok: true,
    request: { name: name.name, phone: phone.national, date, time, reason: reason.reason },
  }
}

export function parseReason(input: string): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = cleanText(input, 160)
  if (/^(skip|none|nothing|no reason|n\/a|na|-)$/i.test(reason)) {
    return { ok: true, reason: "" }
  }
  if (reason.length < 3) {
    return { ok: false, error: "Please add a short reason, at least a few characters, or say skip." }
  }
  if (reason.length > 120) {
    return { ok: false, error: "Please keep the reason under 120 characters." }
  }
  return { ok: true, reason }
}

export function handleTurn(input: {
  message: string
  session?: unknown
  intent?: "start_booking"
  clinic: ClinicContent
  now: Date
}): Turn {
  const clinic = input.clinic
  const now = input.now
  const message = cleanText(input.message)
  let session = coerceSession(input.session)

  if (input.intent === "start_booking") {
    session = { mode: "booking", step: "name", draft: {} }
    return answer(promptFor("name", session.draft, clinic), session, false)
  }

  if (isCancel(message) && session.mode === "booking") {
    return answer("Cancelled. Ask me about hours, services, fees, or start again whenever you like.", initialSession(), false)
  }

  if (session.mode === "booking" && session.step) {
    if (isBookingRequest(message)) {
      return answer(`We're already noting a request.\n\n${promptFor(session.step, session.draft, clinic)}`, session, false)
    }
    const aside = asideAnswer(message, clinic)
    if (aside) {
      const reprompt = promptFor(session.step, session.draft, clinic)
      return {
        reply: `${aside}\n\n${reprompt}`,
        session,
        suggestions: suggestionsFor(session),
        llmEligible: true,
        reprompt,
      }
    }
    return bookingStep(message, session, clinic, now)
  }

  if (isBookingRequest(message)) {
    session = { mode: "booking", step: "name", draft: {} }
    return answer(
      "Happy to help. I'll take a few details and the desk will call you to confirm a time. What name should I put on it?",
      session,
      false,
    )
  }

  if (/\b(bleeding|swelling|severe pain|accident|unconscious)\b/i.test(message)) {
    return answer(
      `If this is an emergency, please call the clinic on ${clinic.contact.phoneDisplay}. I can't give medical advice.`,
      session,
      false,
    )
  }

  const match = message ? matchFaq(message, clinic) : null
  if (match) {
    return { ...answer(match.answer, session, true), faqId: match.id }
  }

  if (/\b(pain|symptom|symptoms|hurt|hurts|medicine|dose|infection|diagnosis)\b/i.test(message)) {
    return answer(
      "I can't advise on symptoms, but the doctor can. Would you like to request an appointment?",
      session,
      false,
    )
  }

  return answer(
    "I can help with hours, services, fees, the doctors, the address, or an appointment request. What would you like to know?",
    session,
    Boolean(message),
  )
}

function bookingStep(message: string, session: Session, clinic: ClinicContent, now: Date): Turn {
  const step = session.step
  const draft = { ...session.draft }

  if (step === "name") {
    const parsed = parseName(message)
    if (!parsed.ok) return answer(parsed.error, session, false)
    draft.name = parsed.name
    const next = { mode: "booking" as const, step: "phone" as const, draft }
    return answer(`Thanks, ${parsed.name}. What is the mobile number? A 10-digit Indian number is enough.`, next, false)
  }

  if (step === "phone") {
    const parsed = parseIndianMobile(message)
    if (!parsed.ok) return answer(parsed.error, session, false)
    draft.phone = parsed.national
    if (draft.date && draft.time && draft.reason !== undefined) {
      return answer(confirmCopy(draft), { mode: "booking", step: "confirm", draft }, false)
    }
    const next = { mode: "booking" as const, step: "when" as const, draft }
    return answer(
      `Which day and time would you like? For example, tomorrow at 10:30 am. ${clinic.hours.lines.join(" ")}`,
      next,
      false,
    )
  }

  if (step === "when") {
    const parsed = parseWhen(message, now, clinic.hours, { date: draft.date, time: draft.time })
    if (parsed.status === "need-date") {
      draft.time = parsed.time
      draft.date = undefined
      return answer(parsed.message, { ...session, draft }, false)
    }
    if (parsed.status === "need-time") {
      draft.date = parsed.date
      draft.time = undefined
      return answer(parsed.message, { ...session, draft }, false)
    }
    if (parsed.status === "invalid") {
      return answer(parsed.message, session, false)
    }
    draft.date = parsed.date
    draft.time = parsed.time
    if (draft.reason !== undefined) {
      return answer(confirmCopy(draft), { mode: "booking", step: "confirm", draft }, false)
    }
    const next = { mode: "booking" as const, step: "reason" as const, draft }
    return answer("What is the visit for? A short reason is enough. You can also say skip.", next, false)
  }

  if (step === "reason") {
    const parsed = parseReason(message)
    if (!parsed.ok) return answer(parsed.error, session, false)
    draft.reason = parsed.reason
    const next = { mode: "booking" as const, step: "confirm" as const, draft }
    return answer(confirmCopy(draft), next, false)
  }

  if (isYes(message)) {
    const pending = completeDraft(draft)
    if (!pending) {
      return answer("Some details are missing. What name should I put on the request?", { mode: "booking", step: "name", draft }, false)
    }
    return {
      reply: confirmationCopy(pending),
      session: initialSession(),
      suggestions: suggestionsFor(initialSession()),
      pending,
      llmEligible: false,
    }
  }

  if (isNo(message)) {
    return answer("What should I change? You can say name, phone, date, time, or reason.", session, false)
  }

  const change = requestedChange(message)
  if (change === "name") {
    draft.name = undefined
    return answer("What name should I put on it?", { mode: "booking", step: "name", draft }, false)
  }
  if (change === "phone") {
    draft.phone = undefined
    return answer("What mobile number should I use?", { mode: "booking", step: "phone", draft }, false)
  }
  if (change === "time") {
    draft.time = undefined
    const when = draft.date
      ? `What time on ${formatClinicDate(draft.date)}?`
      : "Which day and time would you like?"
    return answer(when, { mode: "booking", step: "when", draft }, false)
  }
  if (change === "date" || change === "both") {
    draft.date = undefined
    if (change === "both") draft.time = undefined
    return answer("Which day and time would you like?", { mode: "booking", step: "when", draft }, false)
  }
  if (change === "reason") {
    draft.reason = undefined
    return answer("What is the visit for?", { mode: "booking", step: "reason", draft }, false)
  }

  return answer("Reply yes to submit, or tell me what to change (name, phone, date, time, or reason). You can also say cancel.", session, false)
}

function confirmCopy(draft: Draft): string {
  const phone = draft.phone ? `${draft.phone.slice(0, 5)} ${draft.phone.slice(5)}` : ""
  const reason = draft.reason ? draft.reason : "Not specified"
  return [
    "Please confirm this request:",
    "",
    `Name: ${draft.name}`,
    `Mobile: ${phone}`,
    `When: ${draft.date ? formatClinicDate(draft.date) : ""} · ${draft.time ? formatTime(draft.time) : ""}`,
    `Reason: ${reason}`,
    "",
    "Reply yes to submit, or tell me what to change. You can also say cancel.",
  ].join("\n")
}

export function confirmationCopy(pending: AppointmentRequest): string {
  const phone = `${pending.phone.slice(0, 5)} ${pending.phone.slice(5)}`
  return [
    `Thank you, ${pending.name}. Your request is with the front desk.`,
    "",
    "Request received, not yet confirmed.",
    `${formatClinicDate(pending.date)} · ${formatTime(pending.time)}`,
    `The desk will call +91 ${phone} to confirm an exact time. Until then, this isn't a booked appointment.`,
  ].join("\n")
}

function completeDraft(draft: Draft): AppointmentRequest | null {
  if (!draft.name || !draft.phone || !draft.date || !draft.time || draft.reason === undefined) return null
  return {
    name: draft.name,
    phone: draft.phone,
    date: draft.date,
    time: draft.time,
    reason: draft.reason,
  }
}

function asideAnswer(message: string, clinic: ClinicContent): string | null {
  const text = normalize(message)
  const looksLikeQuestion = /^(what|whats|when|where|who|why|how|do you|are you|is there|can you)\b/.test(text) || message.trim().endsWith("?")
  if (!looksLikeQuestion) return null
  return matchFaq(message, clinic)?.answer ?? null
}

function promptFor(step: BookingStep, draft: Draft, clinic: ClinicContent): string {
  if (step === "name") return "What name should I put on it?"
  if (step === "phone") return "What is the mobile number?"
  if (step === "when") {
    return draft.date
      ? `What time on ${formatClinicDate(draft.date)}?`
      : `Which day and time would you like? ${clinic.hours.lines.join(" ")}`
  }
  if (step === "reason") return "What is the visit for?"
  return "Reply yes to submit, or tell me what to change."
}

function answer(reply: string, session: Session, llmEligible: boolean): Turn {
  return {
    reply,
    session,
    suggestions: suggestionsFor(session),
    llmEligible,
  }
}

export function suggestionsFor(session: Session): string[] {
  if (session.mode === "faq") {
    return ["Book an appointment", "Are you open today?", "How much is a cleaning?", "Do you see children?", "Where do I park?"]
  }
  if (session.step === "confirm") return ["Yes, submit", "Change the time", "Cancel"]
  return []
}

function isYes(message: string): boolean {
  const text = normalize(message)
  if (YES.has(text)) return true
  return /^yes\b/.test(text) && text.length < 40 && !/\b(but|no|not|change)\b/.test(text)
}

function isNo(message: string): boolean {
  return /^(no|nope|nah|change|edit|wrong|incorrect)$/.test(normalize(message))
}

function isCancel(message: string): boolean {
  return /^(cancel|stop|quit|exit|never mind|nevermind|start over)$/.test(normalize(message))
}

function requestedChange(message: string): "name" | "phone" | "date" | "time" | "reason" | "both" | null {
  const text = normalize(message)
  const explicit = /\b(change|edit|update|fix|wrong)\b/.test(text)
  const only = /^(name|phone|mobile|mobile number|date|day|time|reason)$/.test(text)
  if (!explicit && !only) return null
  const hasDate = /\b(date|day)\b/.test(text)
  const hasTime = /\btime\b/.test(text)
  if (hasDate && hasTime) return "both"
  if (hasTime) return "time"
  if (hasDate) return "date"
  if (/\b(phone|mobile|number)\b/.test(text)) return "phone"
  if (/\bname\b/.test(text)) return "name"
  if (/\breason\b/.test(text)) return "reason"
  return null
}
