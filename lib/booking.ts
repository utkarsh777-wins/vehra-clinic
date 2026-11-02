import { formatClinicDate, formatTime } from "@/lib/calendar"
import type { ClinicContent } from "@/lib/clinic"
import { emergencyReply, isEmergency } from "@/lib/emergency"
import { matchFaq } from "@/lib/faq"
import { parseIndianMobile } from "@/lib/phone"
import { cleanText, normalize } from "@/lib/text"
import { localizeFaq, voice, type Locale } from "@/lib/voice"
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

const YES_SCRIPT = new Set(["हाँ", "हां", "हाँ जी", "हां जी", "ਹਾਂ", "ਹਾਂ ਜੀ"])

const NAME_STOP = new Set([
  "yes",
  "no",
  "ok",
  "okay",
  "test",
  "asdf",
  "hello",
  "hi",
  "hey",
  "none",
  "later",
  "skip",
  "haan",
  "han",
  "nahi",
  "nahin",
  "nah",
  "nope",
  "hmm",
  "hm",
  "hmmm",
  "yeah",
  "yep",
  "cancel",
  "stop",
  "quit",
  "book",
  "booking",
  "appointment",
  "name",
  "nothing",
  "na",
  "idk",
  "y",
  "n",
])

const NAME_PHRASES = new Set(["i dont know", "i don't know", "dont know", "don't know", "no thanks", "not now", "test user"])

const INTENT_WORD =
  /^(i|im|i'm|my|me|we|our|is|am|are|was|were|have|has|had|want|need|please|help|the|a|an|child|unconscious)$/i

const NAME_RE = /^(?=[\p{L}\p{M}])(?=.*\p{L})[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u

const NEED_BOTH = "Please share a date and a time, for example tomorrow at 10:30 am."

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

export function preserveTime(time: string): string {
  if (time === "morning" || time === "evening") return time
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [hour, minute] = time.split(":").map(Number)
    if (hour <= 23 && minute <= 59) return time
  }
  return "morning"
}

export function isBookingRequest(message: string): boolean {
  const text = normalize(message)
  if (!text && !/अपॉइंटमेंट|ਅਪੌਇੰਟਮੈਂਟ/.test(message)) return false
  if (/^(how|what|when|where|who|why)\b/.test(text)) return false
  if (/कैसे|ਕਿਵੇਂ/.test(message) && /अपॉइंटमेंट|ਅਪੌਇੰਟਮੈਂਟ|book/.test(message)) return false
  if (/अपॉइंटमेंट लें|अपॉइंटमेंट चाह|ਅਪੌਇੰਟਮੈਂਟ ਲਵੋ|ਅਪੌਇੰਟਮੈਂਟ ਚਾਹ/.test(message)) return true
  if (/^(book|booking|appointment|schedule)( an appointment| a visit)?$/.test(text)) return true
  if (/\b(book|booking|schedule)\b/.test(text) && /\b(appointment|visit|slot|consultation)\b/.test(text)) {
    return true
  }
  if (/\b(i want|i need|i would like|id like|i'd like|can i|could i|please)\b/.test(text) && /\b(book|appointment|schedule)\b/.test(text)) {
    return true
  }
  return false
}

export function parseName(input: string, locale: Locale = "en"): { ok: true; name: string } | { ok: false; error: string } {
  const v = voice(locale)
  const name = cleanText(input, 60)
  if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) {
    return { ok: false, error: v.lettersName }
  }
  const words = name.split(/\s+/)
  if (words.length > 4) return { ok: false, error: v.sentenceName }
  const keys = words.map((word) => word.toLowerCase().replace(/[.'’-]/g, ""))
  if (keys.some((word) => word.length < 2 || !/\p{L}/u.test(word))) {
    return { ok: false, error: v.lettersName }
  }
  const phrase = name.toLowerCase()
  if (NAME_PHRASES.has(phrase) || keys.some((word) => NAME_STOP.has(word))) {
    return { ok: false, error: v.notAName }
  }
  const intentHits = keys.filter((word) => INTENT_WORD.test(word)).length
  if (words.length >= 3 && intentHits >= 2) return { ok: false, error: v.sentenceName }
  return { ok: true, name }
}

export function validateAppointment(
  draft: { name?: unknown; phone?: unknown; date?: unknown; time?: unknown; reason?: unknown },
  clinic: ClinicContent,
  now: Date,
  locale: Locale = "en",
): { ok: true; request: AppointmentRequest } | { ok: false; field: "name" | "phone" | "date" | "time" | "reason"; error: string } {
  const v = voice(locale)
  const name = parseName(typeof draft.name === "string" ? draft.name : "", locale)
  if (!name.ok) return { ok: false, field: "name", error: name.error }
  const phone = parseIndianMobile(typeof draft.phone === "string" ? draft.phone : "")
  if (!phone.ok) return { ok: false, field: "phone", error: locale === "en" ? phone.error : v.phoneInvalid }
  const date = typeof draft.date === "string" ? draft.date.trim() : ""
  const time = typeof draft.time === "string" ? draft.time.trim().toLowerCase() : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, field: "date", error: v.chooseDate }
  }
  if (time !== "morning" && time !== "evening" && !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, field: "time", error: v.chooseTime }
  }
  const slot = validateSlot(date, time, now, clinic.hours)
  if (slot) return { ok: false, field: slot.field, error: slot.message }
  const reasonText = typeof draft.reason === "string" ? draft.reason : ""
  const reason = reasonText.trim() ? parseReason(reasonText, locale) : { ok: true as const, reason: "" }
  if (!reason.ok) return { ok: false, field: "reason", error: reason.error }
  return {
    ok: true,
    request: { name: name.name, phone: phone.national, date, time, reason: reason.reason },
  }
}

export function parseReason(input: string, locale: Locale = "en"): { ok: true; reason: string } | { ok: false; error: string } {
  const v = voice(locale)
  const reason = cleanText(input, 160)
  if (/^(skip|none|nothing|no reason|n\/a|na|-)$/i.test(reason)) {
    return { ok: true, reason: "" }
  }
  if (reason.length < 3) {
    return { ok: false, error: v.reasonShort }
  }
  if (reason.length > 120) {
    return { ok: false, error: v.reasonLong }
  }
  return { ok: true, reason }
}

export function handleTurn(input: {
  message: string
  session?: unknown
  intent?: "start_booking"
  clinic: ClinicContent
  now: Date
  locale?: Locale
}): Turn {
  const clinic = input.clinic
  const now = input.now
  const locale = input.locale ?? "en"
  const v = voice(locale)
  const message = cleanText(input.message)
  let session = coerceSession(input.session)

  if (message && isEmergency(message)) {
    return answer(emergencyReply(locale), session, false, locale)
  }

  if (input.intent === "start_booking") {
    session = { mode: "booking", step: "name", draft: {} }
    return answer(v.namePrompt, session, false, locale)
  }

  if (isCancel(message) && session.mode === "booking") {
    return answer(v.cancelled, initialSession(), false, locale)
  }

  if (session.mode === "booking" && session.step) {
    if (isBookingRequest(message)) {
      return answer(`${v.already}\n\n${promptFor(session.step, session.draft, clinic, locale)}`, session, false, locale)
    }
    const aside = asideAnswer(message, clinic, locale)
    if (aside) {
      const reprompt = promptFor(session.step, session.draft, clinic, locale)
      return {
        reply: `${aside.reply}\n\n${reprompt}`,
        session,
        suggestions: suggestionsFor(session, locale),
        llmEligible: true,
        reprompt,
        faqId: aside.faqId,
      }
    }
    return bookingStep(message, session, clinic, now, locale)
  }

  if (isBookingRequest(message)) {
    session = { mode: "booking", step: "name", draft: {} }
    return answer(v.openBooking, session, false, locale)
  }

  if (!looksLikeQuestion(message)) {
    const when = parseWhen(message, now, clinic.hours)
    if (when.status === "complete" || when.status === "need-time" || when.status === "need-date") {
      const draft: Draft = {}
      if (when.status === "complete") {
        draft.date = when.date
        draft.time = when.time
      } else if (when.status === "need-time") {
        draft.date = when.date
      } else {
        draft.time = when.time
      }
      const next = { mode: "booking" as const, step: "name" as const, draft }
      return answer(`${v.notedWhen} ${v.namePrompt}`, next, false, locale)
    }
    if (when.status === "invalid" && when.message !== NEED_BOTH) {
      return answer(when.message, session, false, locale)
    }
  }

  if (isClinicalQuestion(message)) {
    return answer(v.symptom, session, false, locale)
  }

  const match = message ? matchFaq(message, clinic) : null
  if (match) {
    return { ...answer(localizeFaq(match.id, locale, match.answer), session, true, locale), faqId: match.id }
  }

  if (/\b(pain|symptom|symptoms|hurt|hurts|medicine|dose|infection|diagnosis|dard|bleeding\s*gums?)\b/i.test(message) || /दर्द|ਦਰਦ|मसूड़ों|ਮਸੂੜਿਆਂ/.test(message)) {
    return answer(v.symptom, session, false, locale)
  }

  return answer(v.menu, session, Boolean(message), locale)
}

function bookingStep(message: string, session: Session, clinic: ClinicContent, now: Date, locale: Locale): Turn {
  const v = voice(locale)
  const step = session.step
  const draft = { ...session.draft }

  if (step === "name") {
    const parsed = parseName(message, locale)
    if (!parsed.ok) return answer(parsed.error, session, false, locale)
    draft.name = parsed.name
    return answer(v.phoneThanks(parsed.name), nextStepAfterName(draft), false, locale)
  }

  if (step === "phone") {
    const parsed = parseIndianMobile(message)
    if (!parsed.ok) return answer(locale === "en" ? parsed.error : v.phoneInvalid, session, false, locale)
    draft.phone = parsed.national
    if (draft.date && draft.time && draft.reason !== undefined) {
      return answer(confirmCopy(draft, locale), { mode: "booking", step: "confirm", draft }, false, locale)
    }
    if (draft.date && draft.time) {
      return answer(v.reasonPrompt, { mode: "booking", step: "reason", draft }, false, locale)
    }
    return answer(
      `${v.whenAsk} ${clinic.hours.lines.join(" ")}`,
      { mode: "booking", step: "when", draft },
      false,
      locale,
    )
  }

  if (step === "when") {
    const parsed = parseWhen(message, now, clinic.hours, { date: draft.date, time: draft.time })
    if (parsed.status === "need-date") {
      draft.time = parsed.time
      draft.date = undefined
      return answer(parsed.message, { ...session, draft }, false, locale)
    }
    if (parsed.status === "need-time") {
      draft.date = parsed.date
      draft.time = undefined
      return answer(parsed.message, { ...session, draft }, false, locale)
    }
    if (parsed.status === "invalid") {
      return answer(parsed.message, session, false, locale)
    }
    draft.date = parsed.date
    draft.time = parsed.time
    if (draft.reason !== undefined) {
      return answer(confirmCopy(draft, locale), { mode: "booking", step: "confirm", draft }, false, locale)
    }
    return answer(v.reasonPrompt, { mode: "booking", step: "reason", draft }, false, locale)
  }

  if (step === "reason") {
    const parsed = parseReason(message, locale)
    if (!parsed.ok) return answer(parsed.error, session, false, locale)
    draft.reason = parsed.reason
    return answer(confirmCopy(draft, locale), { mode: "booking", step: "confirm", draft }, false, locale)
  }

  const rename = message.match(/^(?:please\s+)?(?:change|update|edit|set)(?:\s+the)?\s+name\s+to\s+(.+)$/i)
  if (rename) {
    const parsed = parseName(rename[1], locale)
    if (!parsed.ok) return answer(parsed.error, session, false, locale)
    draft.name = parsed.name
    return answer(confirmCopy(draft, locale), { mode: "booking", step: "confirm", draft }, false, locale)
  }

  if (isYes(message)) {
    const validated = validateAppointment(draft, clinic, now, locale)
    if (!validated.ok) {
      const stepFor = validated.field === "name" ? "name" : validated.field === "phone" ? "phone" : validated.field === "reason" ? "reason" : "when"
      return answer(validated.error, { mode: "booking", step: stepFor, draft }, false, locale)
    }
    return {
      reply: confirmationCopy(validated.request, locale),
      session: initialSession(),
      suggestions: suggestionsFor(initialSession(), locale),
      pending: validated.request,
      llmEligible: false,
    }
  }

  if (isNo(message)) {
    return answer(v.changeWhat, session, false, locale)
  }

  const change = requestedChange(message)
  if (change === "name") {
    draft.name = undefined
    return answer(v.nameAsk, { mode: "booking", step: "name", draft }, false, locale)
  }
  if (change === "phone") {
    draft.phone = undefined
    return answer(v.phoneAsk, { mode: "booking", step: "phone", draft }, false, locale)
  }
  if (change === "time") {
    draft.time = undefined
    const when = draft.date ? v.timeOn(formatClinicDate(draft.date)) : v.whenAsk
    return answer(when, { mode: "booking", step: "when", draft }, false, locale)
  }
  if (change === "date" || change === "both") {
    draft.date = undefined
    if (change === "both") draft.time = undefined
    return answer(v.whenAsk, { mode: "booking", step: "when", draft }, false, locale)
  }
  if (change === "reason") {
    draft.reason = undefined
    return answer(v.visitFor, { mode: "booking", step: "reason", draft }, false, locale)
  }

  return answer(v.yesOrChange, session, false, locale)
}

function nextStepAfterName(draft: Draft): Session {
  if (draft.phone && draft.date && draft.time && draft.reason !== undefined) {
    return { mode: "booking", step: "confirm", draft }
  }
  if (draft.phone && draft.date && draft.time) {
    return { mode: "booking", step: "reason", draft }
  }
  if (draft.phone) return { mode: "booking", step: "when", draft }
  return { mode: "booking", step: "phone", draft }
}

function confirmCopy(draft: Draft, locale: Locale): string {
  const v = voice(locale)
  const phone = draft.phone ? `${draft.phone.slice(0, 5)} ${draft.phone.slice(5)}` : ""
  const reason = draft.reason ? draft.reason : v.notSpecified
  return [
    v.confirmLead,
    "",
    `${v.nameLabel}: ${draft.name}`,
    `${v.mobileLabel}: ${phone}`,
    `${v.whenLabel}: ${draft.date ? formatClinicDate(draft.date) : ""} · ${draft.time ? formatTime(draft.time) : ""}`,
    `${v.reasonLabel}: ${reason}`,
    "",
    v.confirmYes,
  ].join("\n")
}

export function confirmationCopy(pending: AppointmentRequest, locale: Locale = "en"): string {
  const v = voice(locale)
  const phone = `${pending.phone.slice(0, 5)} ${pending.phone.slice(5)}`
  return [v.thanks(pending.name), "", v.received, `${formatClinicDate(pending.date)} · ${formatTime(pending.time)}`, v.deskWillCall(phone)].join("\n")
}

function asideAnswer(message: string, clinic: ClinicContent, locale: Locale): { reply: string; faqId: string } | null {
  if (!looksLikeQuestion(message)) return null
  const match = matchFaq(message, clinic)
  if (!match) return null
  return { reply: localizeFaq(match.id, locale, match.answer), faqId: match.id }
}

function looksLikeQuestion(message: string): boolean {
  const text = normalize(message)
  return /^(what|whats|when|where|who|why|how|do you|are you|is there|can you)\b/.test(text) || message.trim().endsWith("?")
}

function promptFor(step: BookingStep, draft: Draft, clinic: ClinicContent, locale: Locale): string {
  const v = voice(locale)
  if (step === "name") return v.namePrompt
  if (step === "phone") return v.phoneAsk
  if (step === "when") {
    return draft.date ? v.timeOn(formatClinicDate(draft.date)) : `${v.whenAsk} ${clinic.hours.lines.join(" ")}`
  }
  if (step === "reason") return v.visitFor
  return v.confirmYes
}

function answer(reply: string, session: Session, llmEligible: boolean, locale: Locale): Turn {
  return {
    reply,
    session,
    suggestions: suggestionsFor(session, locale),
    llmEligible,
  }
}

export function suggestionsFor(session: Session, locale: Locale = "en"): string[] {
  if (session.mode === "faq") {
    if (locale === "hi") return ["अपॉइंटमेंट लें", "क्या आज खुला है?", "सफ़ाई का खर्च कितना है?"]
    if (locale === "pa") return ["ਅਪੌਇੰਟਮੈਂਟ ਲਵੋ", "ਕੀ ਅੱਜ ਖੁੱਲ੍ਹਾ ਹੈ?", "ਸਫ਼ਾਈ ਦਾ ਖ਼ਰਚ ਕਿੰਨਾ ਹੈ?"]
    return ["Book an appointment", "Are you open today?", "How much is a cleaning?", "Do you see children?", "Where do I park?"]
  }
  if (session.step === "confirm") {
    if (locale === "hi") return ["हाँ, भेजें", "समय बदलें", "रद्द"]
    if (locale === "pa") return ["ਹਾਂ, ਭੇਜੋ", "ਸਮਾਂ ਬਦਲੋ", "ਰੱਦ"]
    return ["Yes, submit", "Change the time", "Cancel"]
  }
  return []
}

function isYes(message: string): boolean {
  const raw = message.trim().toLowerCase().replace(/[!.।]+$/g, "")
  if (YES_SCRIPT.has(raw)) return true
  const text = normalize(message)
  if (YES.has(text)) return true
  if (/^(हाँ|हां|ਹਾਂ)(?:\s*[,，].*)?$/.test(raw)) return true
  return /^yes\b/.test(text) && text.length < 40 && !/\b(but|no|not|change)\b/.test(text)
}

function isNo(message: string): boolean {
  const raw = message.trim().toLowerCase()
  if (/^(नहीं|ना|ਕਹੀਂ|ਨਹੀਂ)$/.test(raw)) return true
  return /^(no|nope|nah|nahi|nahin|change|edit|wrong|incorrect)$/.test(normalize(message))
}

function isCancel(message: string): boolean {
  const raw = message.trim().toLowerCase()
  if (/^(रद्द|रद्द करें|छोड़ो|ਕੈਂਸਲ|ਰੱਦ)$/.test(raw)) return true
  return /^(cancel|stop|quit|exit|never mind|nevermind|start over)$/.test(normalize(message))
}

function requestedChange(message: string): "name" | "phone" | "date" | "time" | "reason" | "both" | null {
  if (/नाम बदल|ਨਾਂ ਬਦਲ/.test(message)) return "name"
  if ((/फोन|फ़ोन|नंबर|ਨੰਬਰ/.test(message) && /बदल|ਬਦਲ/.test(message)) || /समय नहीं/.test(message)) {
    if (/फोन|फ़ोन|नंबर|ਨੰਬਰ/.test(message)) return "phone"
  }
  if (/तारीख बदल|ਤਾਰੀਖ ਬਦਲ/.test(message) && /समय बदल|ਸਮਾਂ ਬਦਲ/.test(message)) return "both"
  if (/समय बदल|ਸਮਾਂ ਬਦਲ/.test(message)) return "time"
  if (/तारीख बदल|ਤਾਰੀਖ ਬਦਲ/.test(message)) return "date"
  if (/कारण बदल|ਕਾਰਨ ਬਦਲ/.test(message)) return "reason"

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

function isClinicalQuestion(message: string): boolean {
  const text = normalize(message)
  return (
    /\b(do i have|can you cure|what medicine|which antibiotic|painful|swollen|swelling|for sure|guarantee|will it fix|fix my|cure)\b/.test(text) ||
    /दवा|दवाई|एंटीबायोटिक|ਦਵਾਈ/.test(message)
  )
}
