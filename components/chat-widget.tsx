"use client"

import { useEffect, useId, useRef, useState } from "react"

import { addDays, clinicNow, formatClinicDate, formatTime, toIso } from "@/lib/calendar"
import { LanguageSwitch, useLocale } from "@/components/locale"
import type { Messages } from "@/content/messages"

type BookingCard = {
  id: string
  name: string
  phone: string
  date: string
  time: string
  reason: string
  webhook?: string
}

type Bubble =
  | { id: string; kind: "me" | "bot" | "small" | "error"; text: string }
  | { id: string; kind: "confirm"; booking: BookingCard }

type Session = {
  mode: "faq" | "booking"
  step: string | null
  draft: Record<string, string | undefined>
}

type FormState = {
  name: string
  phone: string
  date: string
  time: "morning" | "evening"
  reason: string
  field?: string
  error?: string
}

const EMPTY_FORM: FormState = { name: "", phone: "", date: "", time: "morning", reason: "" }

const ENGLISH_CHIPS = [
  "Book an appointment",
  "Are you open today?",
  "How much is a cleaning?",
  "Do you see children?",
  "Where do I park?",
]

function localAnswer(faqId: string | undefined, fallback: string, t: Messages, locale: string) {
  if (!faqId || locale === "en") return fallback
  const hours = `${t.doctors.rows[0][0]} ${t.doctors.rows[0][1]} / ${t.doctors.rows[0][2]}. ${t.doctors.rows[1][0]} ${t.doctors.rows[1][1]} / ${t.doctors.rows[1][2]}. ${t.doctors.sunday}: ${t.doctors.closed}`
  const known: Record<string, string> = {
    hours,
    "walk-in": t.faq.items[0][1],
    fees: t.faq.items[1][1],
    children: t.faq.items[2][1],
    bring: t.faq.items[3][1],
    payment: t.faq.items[4][1],
    sunday: t.faq.items[5][1],
    parking: `${t.visit.parkingValue}. ${t.visit.accessValue}.`,
    address: `${t.visit.lines.join(", ")}. ${t.visit.flag}`,
    doctors: `${t.doctors.people.map((person) => `${person[0]} (${person[2]})`).join(". ")}. ${t.doctors.lede}`,
    services: t.services.items.map((item) => item[0]).join(", "),
    languages: t.why.items[3][1],
    demo: t.demoBar,
    contact: `${t.visit.phone} ${"+91 00000 00000"}. ${t.visit.flag}`,
  }
  return known[faqId] ?? fallback
}

function todayIso() {
  return toIso(clinicNow(new Date(), "Asia/Kolkata"))
}

function maxIso() {
  return toIso(addDays(clinicNow(new Date(), "Asia/Kolkata"), 30))
}

export function ChatWidget() {
  const { t, locale, setLocale } = useLocale()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [chipsOn, setChipsOn] = useState(true)
  const [formOn, setFormOn] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [typing, setTyping] = useState(false)
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(false)
  const [draft, setDraft] = useState("")
  const [session, setSession] = useState<Session | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [shot, setShot] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const launchRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const queue = useRef<string[]>([])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const params = new URLSearchParams(window.location.search)
    const state = params.get("chat")
    setShot(params.has("shot"))
    if (state) {
      setPreview(state)
      setOpen(true)
      if (state === "offline") setOffline(true)
    }
    const onOpen = (event: Event) => {
      const flow = (event as CustomEvent<{ flow?: "book" }>).detail?.flow
      setPreview(null)
      setOpen(true)
      if (flow === "book") beginForm()
    }
    const onOff = () => setOffline(true)
    const onOn = () => {
      setOffline(false)
      queue.current.forEach((message) => {
        void send(message)
      })
      queue.current = []
    }
    window.addEventListener("vehra:open", onOpen)
    window.addEventListener("offline", onOff)
    window.addEventListener("online", onOn)
    setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      window.removeEventListener("vehra:open", onOpen)
      window.removeEventListener("offline", onOff)
      window.removeEventListener("online", onOn)
    }
    // beginForm/send are stable enough for the mount listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open || shot) return
    const field = panelRef.current?.querySelector<HTMLElement>(formOn ? "input, select, button" : "#chat-msg")
    field?.focus()
  }, [open, formOn, shot])

  useEffect(() => {
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [bubbles, typing, formOn, open, preview])

  function close() {
    setOpen(false)
    launchRef.current?.focus()
  }

  function beginForm(prefill?: Partial<FormState>) {
    setChipsOn(false)
    setFormOn(true)
    setForm({ ...EMPTY_FORM, ...prefill })
    setSuggestions([])
  }

  async function send(message: string) {
    const text = message.trim()
    if (!text) return
    if (/[\u0A00-\u0A7F]/.test(text)) setLocale("pa")
    else if (/[\u0900-\u097F]/.test(text)) setLocale("hi")
    setPreview(null)
    setChipsOn(false)
    setFormOn(false)
    setBubbles((current) => [...current, { id: crypto.randomUUID(), kind: "me", text }])
    setDraft("")
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queue.current.push(text)
      setOffline(true)
      return
    }
    const started = Date.now()
    let shownAt = 0
    const showTimer = window.setTimeout(() => {
      shownAt = Date.now()
      setTyping(true)
    }, 300)
    const slowTimer = window.setTimeout(() => setSlow(true), 8000)
    const controller = new AbortController()
    const failTimer = window.setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, session }),
        signal: controller.signal,
      })
      const payload = (await response.json()) as {
        reply?: string
        session?: Session
        suggestions?: string[]
        faqId?: string
        booking?: BookingCard | null
        error?: string
      }
      if (!response.ok || !payload.reply) throw new Error(payload.error || "failed")
      const wait = shownAt ? Math.max(0, 400 - (Date.now() - shownAt)) : 0
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait))
      setSession(payload.session ?? null)
      setSuggestions(payload.suggestions ?? [])
      const reply = localAnswer(payload.faqId, payload.reply, t, locale)
      setBubbles((current) => [
        ...current,
        { id: crypto.randomUUID(), kind: "bot", text: reply },
        ...(payload.booking ? [{ id: crypto.randomUUID(), kind: "confirm" as const, booking: payload.booking }] : []),
      ])
    } catch {
      const wait = shownAt ? Math.max(0, 400 - (Date.now() - shownAt)) : 0
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait))
      setBubbles((current) => [...current, { id: crypto.randomUUID(), kind: "error", text }])
    } finally {
      window.clearTimeout(showTimer)
      window.clearTimeout(slowTimer)
      window.clearTimeout(failTimer)
      setTyping(false)
      setSlow(false)
      if (Date.now() - started < 0) setTyping(false)
    }
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault()
    if (preview === "book") {
      setPreview("done")
      return
    }
    setForm((current) => ({ ...current, error: undefined, field: undefined }))
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "submit_booking",
          message: "",
          draft: { name: form.name, phone: form.phone, date: form.date, time: form.time, reason: form.reason },
        }),
      })
      const payload = (await response.json()) as {
        reply?: string
        field?: string
        booking?: BookingCard | null
        error?: string
      }
      if (payload.field) {
        setForm((current) => ({ ...current, field: payload.field, error: payload.reply }))
        return
      }
      if (!response.ok || !payload.booking) throw new Error(payload.error || "failed")
      const booking = payload.booking
      setFormOn(false)
      setBubbles((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: "me",
          text: `${booking.name} · ${booking.phone.slice(0, 5)} ${booking.phone.slice(5)}\n${formatClinicDate(booking.date)} · ${formatTime(booking.time)}${booking.reason ? ` · ${booking.reason}` : ""}`,
        },
        { id: crypto.randomUUID(), kind: "bot", text: `${booking.name}. ${t.chat.thanks}` },
        { id: crypto.randomUUID(), kind: "confirm", booking },
      ])
    } catch {
      setBubbles((current) => [...current, { id: crypto.randomUUID(), kind: "error", text: form.name }])
    }
  }

  function onChip(index: number) {
    if (ENGLISH_CHIPS[index] === "Book an appointment") {
      setPreview(null)
      beginForm()
      return
    }
    void send(ENGLISH_CHIPS[index] ?? t.chat.chips[index])
  }

  const previewBook = preview === "book" || preview === "done"
  const showLiveForm = formOn && !preview

  return (
    <>
      <button
        ref={launchRef}
        className="chat-launch"
        type="button"
        aria-controls="chat"
        aria-expanded={open}
        onClick={() => {
          setPreview(null)
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18.5V7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v5a3.5 3.5 0 0 1-3.5 3.5H9z" />
          <path d="M9 9.5h6M9 12.5h4" />
        </svg>
        <span>{t.chat.launch}</span>
      </button>
      <div className="chat-scrim" hidden={!open} onClick={close} />
      <section
        ref={panelRef}
        className="chat"
        id="chat"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            close()
          }
        }}
      >
        <div className="chat__grab" aria-hidden="true" />
        <header className="chat__head">
          <div className="chat__who">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/monogram.svg" width="32" height="32" alt="" />
            <div>
              <h2 id={titleId}>{t.chat.title}</h2>
              <p>
                <span className={offline ? "dot dot--off" : "dot dot--open"} aria-hidden="true" />
                {offline || preview === "offline" ? t.chat.offline : t.chat.online}
              </p>
            </div>
          </div>
          <div className="chat__tools">
            <LanguageSwitch label={t.chat.lang} compact />
            <button className="icon-btn" type="button" aria-label={t.chat.close} onClick={close}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
        </header>
        <div className="chat__status" role="status" hidden={!(offline || preview === "offline")}>
          <strong>{t.chat.offlineBanner}</strong> {t.chat.offlineRest}
        </div>
        <div className="chat__log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
          <p className="chat__day">{t.chat.day}</p>
          <div className="msg msg--bot">
            <p>{t.chat.greet}</p>
          </div>
          <div className="msg msg--bot msg--small">
            <p>{t.chat.emergency}</p>
          </div>
          {(preview === "open" || (!preview && chipsOn && !formOn && bubbles.length === 0)) ? (
            <div className="chips" aria-label="Suggested questions">
              {t.chat.chips.map((label, index) => (
                <button
                  key={label}
                  className={index === 0 ? "chip chip--primary" : "chip"}
                  type="button"
                  onClick={() => onChip(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {previewBook ? <PreviewFlow done={preview === "done"} t={t} onSend={() => setPreview("done")} /> : null}
          {preview === "typing" ? <Typing label={t.chat.typing} /> : null}
          {preview === "error" ? <ErrorBubble t={t} onRetry={() => setPreview("open")} /> : null}

          {(showLiveForm || (formOn && preview === null)) && (
            <div className="flow">
              <div className="msg msg--me">
                <p>{t.chat.chips[0]}</p>
              </div>
              <div className="msg msg--bot">
                <p>{t.chat.bookAck}</p>
              </div>
              <RequestForm
                t={t}
                form={form}
                setForm={setForm}
                onSubmit={submitForm}
                disabled={offline}
              />
            </div>
          )}

          {bubbles.map((bubble) =>
            bubble.kind === "confirm" ? (
              <ConfirmCard key={bubble.id} t={t} booking={bubble.booking} onChange={() => beginForm({
                name: bubble.booking.name,
                phone: bubble.booking.phone,
                date: bubble.booking.date,
                time: bubble.booking.time === "evening" ? "evening" : "morning",
                reason: bubble.booking.reason,
              })} onElse={() => { setFormOn(false); setChipsOn(true); setSuggestions([]) }} />
            ) : bubble.kind === "error" ? (
              <ErrorBubble key={bubble.id} t={t} onRetry={() => void send(bubble.text)} />
            ) : (
              <div key={bubble.id} className={bubble.kind === "me" ? "msg msg--me" : bubble.kind === "small" ? "msg msg--bot msg--small" : "msg msg--bot"}>
                <p style={{ whiteSpace: "pre-wrap" }}>{bubble.text}</p>
              </div>
            ),
          )}

          {suggestions.length > 0 && !formOn && !preview ? (
            <div className="chips">
              {suggestions.slice(0, 3).map((label) => (
                <button key={label} className="chip" type="button" onClick={() => void send(label)}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {typing ? (
            slow ? (
              <div className="msg msg--bot">
                <p>{t.chat.slow}</p>
              </div>
            ) : (
              <Typing label={t.chat.typing} />
            )
          ) : null}
        </div>
        <form
          className="chat__input"
          onSubmit={(event) => {
            event.preventDefault()
            void send(draft)
          }}
        >
          <label className="sr-only" htmlFor="chat-msg">
            {t.chat.message}
          </label>
          <input
            ref={inputRef}
            id="chat-msg"
            value={draft}
            placeholder={t.chat.placeholder}
            autoComplete="off"
            disabled={offline || preview === "offline"}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="send" type="submit" aria-label={t.chat.send} disabled={offline || preview === "offline" || !draft.trim()}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h11m-4-4 4 4-4 4" />
            </svg>
          </button>
        </form>
        <p className="chat__fine">{t.chat.disclaimer}</p>
      </section>
    </>
  )
}

function Typing({ label }: { label: string }) {
  return (
    <div className="msg msg--bot msg--typing" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  )
}

function ErrorBubble({ t, onRetry }: { t: Messages; onRetry: () => void }) {
  return (
    <div className="msg msg--error" role="alert">
      <p>
        {t.chat.error}{" "}
        <button className="link" type="button" onClick={onRetry}>
          {t.chat.retry}
        </button>{" "}
        {t.chat.orCall} <span className="nw">+91 00000 00000</span>.
      </p>
    </div>
  )
}

function ConfirmCard({
  t,
  booking,
  onChange,
  onElse,
}: {
  t: Messages
  booking: BookingCard
  onChange: () => void
  onElse: () => void
}) {
  const phone = `${booking.phone.slice(0, 5)} ${booking.phone.slice(5)}`
  return (
    <div className="confirm" role="status">
      <p className="confirm__k">
        <span className="dot dot--wait" aria-hidden="true" />
        {t.chat.received}
      </p>
      <p className="confirm__v">
        {formatClinicDate(booking.date)} · {formatTime(booking.time)}
      </p>
      <p>
        {t.chat.callLine} <strong>+91 {phone}</strong> {t.chat.until}
      </p>
      <p className="confirm__ref">
        Reference {booking.id} · {booking.webhook === "sent" ? "sent to the clinic sheet" : t.chat.notSent}
      </p>
      <div className="confirm__acts">
        <button className="chip" type="button" onClick={onChange}>
          {t.chat.change}
        </button>
        <button className="chip" type="button" onClick={onElse}>
          {t.chat.else}
        </button>
      </div>
    </div>
  )
}

function RequestForm({
  t,
  form,
  setForm,
  onSubmit,
  disabled,
}: {
  t: Messages
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (event: React.FormEvent) => void
  disabled?: boolean
}) {
  return (
    <form className="req" aria-label={t.chat.formTitle} onSubmit={onSubmit}>
      <p className="req__step">{t.chat.formTitle}</p>
      <label>
        {t.chat.name}
        <input
          autoComplete="name"
          required
          placeholder={t.chat.namePh}
          value={form.name}
          aria-invalid={form.field === "name"}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        {t.chat.mobile}
        <span className="field-pre">
          <span>+91</span>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={t.chat.mobilePh}
            value={form.phone}
            aria-invalid={form.field === "phone"}
            onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
          />
        </span>
      </label>
      <div className="req__row">
        <label>
          {t.chat.date}
          <input
            type="date"
            required
            min={todayIso()}
            max={maxIso()}
            value={form.date}
            aria-invalid={form.field === "date"}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </label>
        <label>
          {t.chat.time}
          <select
            value={form.time}
            aria-invalid={form.field === "time"}
            onChange={(event) => setForm({ ...form, time: event.target.value === "evening" ? "evening" : "morning" })}
          >
            <option value="morning">{t.chat.morning}</option>
            <option value="evening">{t.chat.evening}</option>
          </select>
        </label>
      </div>
      <label>
        <span>
          {t.chat.reason} <span className="opt">{t.chat.optional}</span>
        </span>
        <input
          maxLength={120}
          placeholder={t.chat.reasonPh}
          value={form.reason}
          aria-invalid={form.field === "reason"}
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
        />
      </label>
      {form.error ? <p className="field-error">{form.error}</p> : null}
      <button className="btn btn--primary btn--block" type="submit" disabled={disabled}>
        {t.chat.sendRequest}
      </button>
      <p className="req__fine">{t.chat.fine}</p>
    </form>
  )
}

function PreviewFlow({ t, done, onSend }: { t: Messages; done: boolean; onSend: () => void }) {
  return (
    <div className="flow">
      <div className="msg msg--me">
        <p>Book an appointment</p>
      </div>
      <div className="msg msg--bot">
        <p>{t.chat.bookAck}</p>
      </div>
      <form className="req" aria-label="Appointment request" hidden={done} onSubmit={(event) => { event.preventDefault(); onSend() }}>
        <p className="req__step">Appointment request</p>
        <label>
          Your name
          <input autoComplete="name" defaultValue="Gurleen" placeholder="Full name" />
        </label>
        <label>
          Mobile number
          <span className="field-pre">
            <span>+91</span>
            <input inputMode="numeric" autoComplete="tel-national" defaultValue="98765 43210" placeholder="10-digit number" />
          </span>
        </label>
        <div className="req__row">
          <label>
            Preferred date
            <input type="text" defaultValue="Sat, 7 Nov" />
          </label>
          <label>
            Time
            <select defaultValue="Morning">
              <option>Morning</option>
              <option>Evening</option>
            </select>
          </label>
        </div>
        <label>
          <span>
            Reason <span className="opt">(optional)</span>
          </span>
          <input defaultValue="Cleaning and check-up" placeholder="e.g. tooth pain, check-up" />
        </label>
        <button className="btn btn--primary btn--block" type="submit">
          Send request
        </button>
        <p className="req__fine">Your details are only used to call you back about this request.</p>
      </form>
      {done ? (
        <>
          <div className="msg msg--me">
            <p>
              Gurleen · 98765 43210
              <br />
              Sat, 7 Nov · Morning · Cleaning and check-up
            </p>
          </div>
          <div className="msg msg--bot">
            <p>Thank you, Gurleen. Your request is with the front desk.</p>
          </div>
          <div className="confirm" role="status">
            <p className="confirm__k">
              <span className="dot dot--wait" aria-hidden="true" />
              Request received, not yet confirmed
            </p>
            <p className="confirm__v">Sat, 7 Nov · Morning</p>
            <p>
              The desk will call <strong>+91 98765 43210</strong> to confirm an exact time. Until then, this isn’t a booked appointment.
            </p>
            <p className="confirm__ref">Reference VH-0142 · demo, not sent</p>
            <div className="confirm__acts">
              <button className="chip" type="button">
                Change details
              </button>
              <button className="chip" type="button">
                Ask something else
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
