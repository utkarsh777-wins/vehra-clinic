"use client"

import { useState } from "react"

import { formatClinicDate, formatTime } from "@/lib/calendar"
import { useLocale } from "@/components/locale"

type Row = {
  id: string
  name: string
  phone: string
  date: string
  time: string
  reason: string
  createdAt: string
  status?: string
  webhook?: string
}

export function BookingLog() {
  const { t } = useLocale()
  const [secret, setSecret] = useState("")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/bookings", { headers: { "x-bookings-secret": secret } })
      const payload = (await response.json()) as { bookings?: Row[]; error?: string }
      if (!response.ok) {
        setRows(null)
        setError(payload.error || t.log.error)
        return
      }
      setRows(payload.bookings ?? [])
    } catch {
      setError(t.log.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <p className="eyebrow">Sample site</p>
      <h1 className="h2">{t.log.title}</h1>
      <p className="sec-head__p" style={{ marginTop: 16 }}>
        {t.log.lede}
      </p>
      <form className="req" style={{ marginTop: 28 }} onSubmit={onSubmit}>
        <label>
          {t.log.secret}
          <input
            id="secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            aria-invalid={Boolean(error)}
            onChange={(event) => setSecret(event.target.value)}
          />
        </label>
        <p className="req__fine">{t.log.secretHelp}</p>
        {error ? <p className="field-error">{error}</p> : null}
        <button className="btn btn--primary" type="submit" disabled={loading || !secret}>
          {loading ? t.log.loading : t.log.show}
        </button>
      </form>
      {rows && rows.length === 0 ? <p style={{ marginTop: 24 }}>{t.log.empty}</p> : null}
      {rows && rows.length > 0 ? (
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {rows.filter((row) => row.status !== "superseded").map((row) => (
            <article key={row.id} className="confirm">
              <p className="confirm__k">
                <span className="dot dot--wait" aria-hidden="true" />
                {t.chat.received}
              </p>
              <p className="confirm__v">
                {formatClinicDate(row.date)} · {formatTime(row.time)}
              </p>
              <p>
                {row.name} · {row.phone.slice(0, 5)} {row.phone.slice(5)}
                {row.reason ? ` · ${row.reason}` : ""}
              </p>
              <p className="confirm__ref">
                Reference {row.id} · {row.createdAt}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
