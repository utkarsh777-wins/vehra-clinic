import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET } from "@/app/api/bookings/route"
import { POST } from "@/app/api/chat/route"
import { handleTurn, initialSession, parseName, preserveTime, validateAppointment } from "@/lib/booking"
import { getClinic } from "@/lib/clinic"
import { resetGuards } from "@/lib/guard"
import { openTodayLabel } from "@/lib/open-status"
import { saveBooking } from "@/lib/store"
import { resolveLocale } from "@/lib/voice"

const clinic = getClinic()
const now = new Date("2026-10-29T04:30:00.000Z")
const NOW = now.toISOString()

function say(message: string, session: unknown = initialSession(), locale?: "en" | "hi" | "pa") {
  return handleTurn({ message, session, clinic, now, locale })
}

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "vehra-blockers-"))
  process.env.BOOKINGS_STORE_PATH = path.join(directory, "bookings.json")
  process.env.BOOKINGS_FALLBACK_PATH = path.join(directory, "fallback.json")
  process.env.BOOKINGS_VIEW_SECRET = "test-secret-value1"
  process.env.LLM_PROVIDER = "none"
  delete process.env.BOOKING_WEBHOOK_URL
  resetGuards()
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function chat(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-clock": NOW, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )
}

const validDraft = {
  name: "Ada Kaur",
  phone: "9876543210",
  date: "2026-11-02",
  time: "10:30",
  reason: "Check-up",
}

describe("server revalidation", () => {
  it("does not save a tampered confirm session", async () => {
    const response = await chat({
      message: "yes",
      session: {
        mode: "booking",
        step: "confirm",
        draft: {
          name: "<img src=x onerror=alert(1)>",
          phone: "123",
          date: "1999-01-01",
          time: "25:99",
          reason: "x".repeat(200),
        },
      },
    })
    const payload = await response.json()
    expect(payload.booking).toBeNull()
    await expect(readFile(process.env.BOOKINGS_STORE_PATH!, "utf8")).rejects.toThrow()
  })

  it("rejects a skipped-step Sunday and an off-hours time before saving", () => {
    const sunday = say("yes", {
      mode: "booking",
      step: "confirm",
      draft: { ...validDraft, date: "2026-11-08", time: "10:30" },
    })
    expect(sunday.pending).toBeUndefined()
    expect(sunday.reply).toMatch(/closed/i)

    const early = say("yes", {
      mode: "booking",
      step: "confirm",
      draft: { ...validDraft, time: "03:00" },
    })
    expect(early.pending).toBeUndefined()
    expect(early.reply).toMatch(/outside clinic hours/i)
  })
})

describe("calendar dates", () => {
  it("rejects impossible dates on the date field", () => {
    for (const date of ["2026-11-31", "2026-02-31", "2026-13-01"]) {
      const result = validateAppointment({ ...validDraft, date }, clinic, now)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.field).toBe("date")
        expect(result.error).toMatch(/doesn't exist/i)
        expect(result.error).not.toMatch(/already passed|30 days/i)
      }
    }
  })

  it("reports a past date and a closed day on the date field", () => {
    const past = validateAppointment({ ...validDraft, date: "2026-10-01", time: "morning" }, clinic, now)
    expect(past.ok).toBe(false)
    if (!past.ok) expect(past.field).toBe("date")
    const sunday = validateAppointment({ ...validDraft, date: "2026-11-08", time: "morning" }, clinic, now)
    expect(sunday.ok).toBe(false)
    if (!sunday.ok) expect(sunday.field).toBe("date")
  })

  it("explains an invalid spoken date instead of asking which date", () => {
    const turn = say("31/02/2026 10 am", {
      mode: "booking",
      step: "when",
      draft: { name: "Ada Kaur", phone: "9876543210" },
    })
    expect(turn.reply).toMatch(/doesn't look valid/i)
    expect(say("yesterday 10 am", turn.session).reply).toMatch(/already passed/i)
    expect(say("tomorrow 10:30 am at 5 pm", turn.session).reply).toMatch(/more than one time/i)
  })
})

describe("names", () => {
  it("accepts Devanagari and Gurmukhi names, including vowel signs", () => {
    expect(parseName("सिमरन कौर")).toMatchObject({ ok: true, name: "सिमरन कौर" })
    expect(parseName("ਸਿਮਰਨ ਕੌਰ")).toMatchObject({ ok: true, name: "ਸਿਮਰਨ ਕੌਰ" })
    expect(parseName("फ़िरोज अली")).toMatchObject({ ok: true })
  })

  it("rejects filler and sentences", () => {
    for (const name of ["no", "test", "asdf", "hello", "Hmm", "I dont know", "my child is unconscious"]) {
      expect(parseName(name).ok).toBe(false)
    }
  })

  it("checks an emergency before treating the words as a name", () => {
    const turn = say("my child is unconscious", { mode: "booking", step: "name", draft: {} })
    expect(turn.pending).toBeUndefined()
    expect(turn.reply).toMatch(/112/)
    expect(turn.reply).toMatch(/108/)
    expect(turn.reply).not.toMatch(/00000/)
    expect(turn.session.draft.name).toBeUndefined()
  })
})

describe("emergencies", () => {
  it.each([
    ["severe pain in my tooth", "en"],
    ["heart attack", "en"],
    ["my father cannot breathe", "en"],
    ["what is the ambulance number", "en"],
    ["I have chest pain", "en"],
    ["accident, heavy bleeding", "en"],
    ["सीने में दर्द है", "hi"],
    ["saans nahi aa rahi", "hi"],
    ["ਮੈਨੂੰ ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ", "pa"],
    ["behosh hai", "hi"],
  ])("answers %s with 112 and 108", (message) => {
    const locale = resolveLocale(message)
    const turn = say(message, { mode: "booking", step: "reason", draft: { name: "Ada Kaur" } }, locale)
    expect(turn.reply).toMatch(/112/)
    expect(turn.reply).toMatch(/108/)
    expect(turn.reply).not.toMatch(/00000/)
    expect(turn.pending).toBeUndefined()
    if (locale === "hi") expect(turn.reply).toMatch(/कॉल/)
    if (locale === "pa") expect(turn.reply).toMatch(/ਕਾਲ/)
  })

  it("counts हाँ and ਹਾਂ as yes and keeps a renamed person", () => {
    const session = {
      mode: "booking" as const,
      step: "confirm" as const,
      draft: { ...validDraft, name: "सिमरन कौर" },
    }
    expect(say("हाँ", session, "hi").pending?.name).toBe("सिमरन कौर")
    expect(say("ਹਾਂ", { ...session, draft: { ...validDraft, name: "ਸਿਮਰਨ ਕੌਰ" } }, "pa").pending?.name).toBe("ਸਿਮਰਨ ਕੌਰ")
    const renamed = say("change name to Meher Kaur", session)
    expect(renamed.session.step).toBe("confirm")
    expect(renamed.session.draft.name).toBe("Meher Kaur")
    expect(renamed.session.draft.phone).toBe("9876543210")
  })
})

describe("duplicates and references", () => {
  it("keeps an exact time instead of collapsing it", () => {
    expect(preserveTime("10:30")).toBe("10:30")
    expect(preserveTime("evening")).toBe("evening")
  })

  it("stores one booking for the same idempotency key and marks the old one superseded", async () => {
    const first = await saveBooking({ ...validDraft, language: "en", idempotencyKey: "form-key-0001" }, now)
    const again = await saveBooking({ ...validDraft, language: "en", idempotencyKey: "form-key-0001" }, now)
    expect(again.booking.id).toBe(first.booking.id)
    expect(again.replay).toBe(true)

    const changed = await saveBooking(
      { ...validDraft, name: "Meher Kaur", time: "10:30", language: "hi", idempotencyKey: "form-key-0002", supersedes: first.booking.id },
      now,
    )
    expect(changed.booking.time).toBe("10:30")
    expect(changed.booking.id).not.toBe(first.booking.id)
    const stored = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8")) as { id: string; status: string; time: string }[]
    expect(stored).toHaveLength(2)
    expect(stored.find((row) => row.id === first.booking.id)?.status).toBe("superseded")
    expect(stored.find((row) => row.id === changed.booking.id)?.time).toBe("10:30")
  })

  it("issues unique public references backed by a uuid", async () => {
    const ids = new Set<string>()
    const keys = new Set<string>()
    for (let index = 0; index < 40; index += 1) {
      const saved = await saveBooking(
        { ...validDraft, phone: `98765${String(10000 + index).slice(0, 5)}`, name: `Ada ${index}` },
        now,
      )
      ids.add(saved.booking.id)
      keys.add(saved.booking.key)
      expect(saved.booking.id).toMatch(/^VH-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
      expect(saved.booking.key).toMatch(/^[0-9a-f-]{36}$/)
    }
    expect(ids.size).toBe(40)
    expect(keys.size).toBe(40)
  })
})

describe("request guards", () => {
  it("rejects a placeholder or short view secret", async () => {
    process.env.BOOKINGS_VIEW_SECRET = "change-me"
    expect((await GET(new Request("http://localhost/api/bookings"))).status).toBe(503)
    process.env.BOOKINGS_VIEW_SECRET = "short-secret"
    expect((await GET(new Request("http://localhost/api/bookings"))).status).toBe(503)
    delete process.env.BOOKINGS_VIEW_SECRET
    expect((await GET(new Request("http://localhost/api/bookings"))).status).toBe(503)
  })

  it("requires JSON, limits body size, and rate limits", async () => {
    const plain = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "text/plain", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ message: "hello" }),
      }),
    )
    expect(plain.status).toBe(415)

    const foreign = await chat({ message: "hello" }, { origin: "https://evil.example" })
    expect(foreign.status).toBe(403)

    const huge = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ message: "x".repeat(21000) }),
      }),
    )
    expect(huge.status).toBe(413)

    let limited = 0
    for (let index = 0; index < 45; index += 1) {
      const response = await chat({ message: "hello" }, { "x-forwarded-for": "203.0.113.11" })
      if (response.status === 429) limited += 1
    }
    expect(limited).toBeGreaterThan(0)
  })

  it("locks the log after repeated bad secrets", async () => {
    for (let index = 0; index < 8; index += 1) {
      await GET(new Request("http://localhost/api/bookings", { headers: { "x-forwarded-for": "203.0.113.12", "x-bookings-secret": "wrong-secret-value" } }))
    }
    const locked = await GET(
      new Request("http://localhost/api/bookings", { headers: { "x-forwarded-for": "203.0.113.12", "x-bookings-secret": "test-secret-value1" } }),
    )
    expect(locked.status).toBe(429)
  })

  it("does not save an emergency submitted as a name", async () => {
    const response = await chat({
      intent: "submit_booking",
      draft: { ...validDraft, name: "my child is unconscious" },
    })
    const payload = await response.json()
    expect(payload.booking).toBeNull()
    expect(payload.reply).toMatch(/112/)
    expect(payload.reply).not.toMatch(/00000/)
  })
})

describe("open today", () => {
  it("follows Asia/Kolkata hours and is closed on Sunday", () => {
    const sunday = openTodayLabel(new Date("2026-11-01T06:00:00.000Z"), "en", clinic.hours)
    expect(sunday.closed).toBe(true)
    expect(sunday.label).toBe("Closed today")
    const mondayMorning = openTodayLabel(new Date("2026-11-02T05:00:00.000Z"), "en", clinic.hours)
    expect(mondayMorning.label).toMatch(/Open today until/i)
    expect(mondayMorning.closed).toBe(false)
  })
})
