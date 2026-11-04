import { mkdtemp, readFile, rm } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GET } from "@/app/api/bookings/route"
import { POST } from "@/app/api/chat/route"
import { runAssistantTurn } from "@/lib/assistant"
import { handleTurn, initialSession, parseName, preserveTime, validateAppointment } from "@/lib/booking"
import { getClinic } from "@/lib/clinic"
import { isEmergency } from "@/lib/emergency"
import { resetGuards } from "@/lib/guard"
import { openTodayLabel } from "@/lib/open-status"
import { saveBooking } from "@/lib/store"
import { resolveLocale, voice } from "@/lib/voice"

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
    // EN escalate
    ["severe pain in my tooth", "en"],
    ["unbearable pain in my mouth", "en"],
    ["heavy bleeding", "en"],
    ["uncontrolled bleeding", "en"],
    ["severe swelling on my face", "en"],
    ["swelling with fever", "en"],
    ["facial trauma after fall", "en"],
    ["I have chest pain", "en"],
    ["my father cannot breathe", "en"],
    ["what is the ambulance number", "en"],
    ["accident, heavy bleeding", "en"],
    ["heart attack", "en"],
    ["swollen face", "en"],
    ["throat swelling", "en"],
    ["swelling spreading to my eye", "en"],
    ["I can't swallow", "en"],
    ["difficulty swallowing", "en"],
    ["bleeding won't stop", "en"],
    ["can't stop the bleeding", "en"],
    ["jaw injury", "en"],
    ["broken jaw", "en"],
    ["hurt my jaw", "en"],
    ["knocked out tooth", "en"],
    ["face is swelling up", "en"],
    // HI escalate
    ["बहुत तेज़ दर्द है", "hi"],
    ["दाँत में तेज़ दर्द है", "hi"],
    ["बहुत दर्द हो रहा है", "hi"],
    ["सीने में दर्द है", "hi"],
    ["saans nahi aa rahi", "hi"],
    ["behosh hai", "hi"],
    ["भारी खून बह रहा है", "hi"],
    ["चेहरे पर सूजन है", "hi"],
    ["आँख तक सूजन", "hi"],
    ["जबड़े में चोट", "hi"],
    ["जबड़ा टूट गया", "hi"],
    ["सांस नहीं आ रही", "hi"],
    ["सांस लेने में तकलीफ", "hi"],
    ["सांस नहीं ले पा रही", "hi"],
    ["सांस लेने मे तकलीफ", "hi"],
    // PA escalate
    ["ਬਹੁਤ ਤੇਜ਼ ਦਰਦ ਹੈ", "pa"],
    ["ਤੇਜ਼ ਦਰਦ ਹੋ ਰਿਹਾ ਹੈ", "pa"],
    ["ਬਹੁਤ ਦਰਦ ਹੈ", "pa"],
    ["ਛਾਤੀ ਵਿੱਚ ਦਰਦ ਹੈ", "pa"],
    ["ਮੈਨੂੰ ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ", "pa"],
    ["ਬੇਹੋਸ਼ ਹੋ ਗਿਆ ਹੈ", "pa"],
    ["ਭਾਰੀ ਖੂਨ ਨਿਕਲ ਰਿਹਾ ਹੈ", "pa"],
    ["ਅੱਖ ਤੱਕ ਸੋਜ", "pa"],
    ["ਖੂਨ ਨਹੀਂ ਰੁਕ ਰਿਹਾ", "pa"],
    ["ਜਬਾੜੇ ਤੇ ਸੱਟ", "pa"],
    ["ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ", "pa"],
    ["ਸਾਹ ਲੈਣ ਵਿੱਚ ਤਕਲੀਫ", "pa"],
    ["ਸਾਹ ਫੁੱਲ ਰਿਹਾ ਹੈ", "pa"],
    ["ਸਾਹ ਨਹੀਂ ਆਉਂਦਾ", "pa"],
    ["ਖੂਨ ਨਹੀਂ ਰੁਕਦਾ", "pa"],
    ["ਨਿਗਲਣ ਵਿੱਚ ਤਕਲੀਫ", "pa"],
    // Romanised Hindi/Punjabi escalate
    ["bahut khoon beh raha hai", "hi"],
    ["khoon nahi ruk raha", "hi"],
    ["chehre pe sujan", "hi"],
    ["jabda toot gaya", "hi"],
    ["saans nahin aa rahi", "hi"],
    ["saans lene me takleef", "hi"],
    ["saans phool rahi hai", "hi"],
    ["khoon nahin ruk raha", "hi"],
    ["nigal nahi pa raha", "hi"],
    ["aankh tak soojan", "hi"],
    ["mera chehra sooj gaya", "hi"],
    // Bad breath + emergency escalate
    ["bad breath and I can't breathe", "en"],
    ["मुँह से बदबू आ रही है और साँस नहीं आ रही", "hi"],
    ["ਮੂੰਹ ਵਿੱਚੋਂ ਬਦਬੂ ਅਤੇ ਖੂਨ ਨਹੀਂ ਰੁਕ ਰਿਹਾ", "pa"],
    ["badboo hai aur khoon nahi ruk raha", "hi"],
  ])("escalates %s to 112 emergency path in %s", (message, lang) => {
    const locale = (lang as "en" | "hi" | "pa") || resolveLocale(message)
    const turn = say(message, { mode: "booking", step: "reason", draft: { name: "Ada Kaur" } }, locale)
    expect(turn.reply).toMatch(/112/)
    expect(turn.reply).toMatch(/108/)
    expect(turn.reply).not.toMatch(/00000/)
    expect(turn.pending).toBeUndefined()
    if (locale === "hi") expect(turn.reply).toMatch(/कॉल/)
    if (locale === "pa") expect(turn.reply).toMatch(/ਕਾਲ/)
  })

  it.each([
    // EN non-escalate
    ["pain in my back molar", "en"],
    ["I have tooth pain", "en"],
    ["bleeding gums", "en"],
    ["toothache", "en"],
    ["bare pain", "en"],
    ["bad breath", "en"],
    // HI non-escalate
    ["दाँत में दर्द है", "hi"],
    ["दर्द हो रहा है", "hi"],
    ["मसूड़ों से खून आ रहा है", "hi"],
    ["daant mein dard", "hi"],
    // PA non-escalate
    ["ਦੰਦ ਵਿੱਚ ਦਰਦ ਹੈ", "pa"],
    ["ਦਰਦ ਹੈ", "pa"],
    ["ਮਸੂੜਿਆਂ ਵਿੱਚੋਂ ਖੂਨ ਆ ਰਿਹਾ ਹੈ", "pa"],
    // Bad-breath non-escalate
    ["सांस की बदबू", "hi"],
    ["saans ki badboo", "hi"],
    ["bad breath in the morning", "en"],
    ["saans se badboo aati hai", "hi"],
    ["ਸਾਹ ਵਿੱਚੋਂ ਬਦਬੂ ਆਉਂਦੀ ਹੈ", "pa"],
    ["मेरी सास को दाँत में हल्का दर्द है", "hi"],
  ])("does NOT escalate plain pain or bleeding gums (%s) to 112, gives symptom reply", (message, lang) => {
    const locale = lang as "en" | "hi" | "pa"
    const turn = say(message, initialSession(), locale)
    expect(turn.reply).not.toMatch(/112/)
    expect(turn.reply).not.toMatch(/108/)
    expect(turn.reply).toBe(voice(locale).symptom)
  })

  it("properly classifies bad-breath and breath distress edge cases with isEmergency", () => {
    // must escalate
    expect(isEmergency("bad breath and I can't breathe")).toBe(true)
    expect(isEmergency("मुँह से बदबू आ रही है और साँस नहीं आ रही")).toBe(true)
    expect(isEmergency("ਮੂੰਹ ਵਿੱਚੋਂ ਬਦਬੂ ਅਤੇ ਖੂਨ ਨਹੀਂ ਰੁਕ ਰਿਹਾ")).toBe(true)
    expect(isEmergency("badboo hai aur khoon nahi ruk raha")).toBe(true)

    // must NOT escalate
    expect(isEmergency("मेरी सास को दाँत में हल्का दर्द है")).toBe(false)
    expect(isEmergency("bad breath in the morning")).toBe(false)
    expect(isEmergency("saans se badboo aati hai")).toBe(false)
    expect(isEmergency("ਸਾਹ ਵਿੱਚੋਂ ਬਦਬੂ ਆਉਂਦੀ ਹੈ")).toBe(false)
  })

  it("booking form accepts reason like 'दाँत में दर्द' without being blocked by emergency detection", async () => {
    const response = await chat({
      intent: "submit_booking",
      draft: { ...validDraft, reason: "दाँत में दर्द" },
    })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.booking).not.toBeNull()
    expect(payload.booking.reason).toBe("दाँत में दर्द")
    expect(payload.reply).not.toMatch(/112/)
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

  it("refuses shared-T0 attack with different phone, allows supersede with matching phone", async () => {
    const first = await saveBooking(
      { ...validDraft, phone: "9876543210" },
      now,
    )
    expect(first.booking).not.toHaveProperty("sessionToken")

    const storedAfterFirst = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8")) as Record<string, unknown>[]
    expect(storedAfterFirst[0]).not.toHaveProperty("sessionToken")

    // Get the deterministic token from a plain FAQ turn via runAssistantTurn
    const faqTurn = await runAssistantTurn({ message: "What are your hours?", now })
    expect(faqTurn.status).toBe(200)
    const token = (faqTurn as { body: { sessionToken: string } }).body.sessionToken
    expect(token).toBeTruthy()

    // Shared-T0 attack: try to supersede victim booking ref with a different phone plus that token
    const attack = await chat({
      intent: "submit_booking",
      sessionToken: token,
      supersedes: first.booking.id,
      draft: {
        ...validDraft,
        name: "Attacker",
        phone: "9123456780",
        time: "11:00",
      },
    })
    expect(attack.status).toBe(400)
    const attackBody = await attack.json()
    expect(attackBody.error).toMatch(/Cannot supersede booking/)

    // Direct saveBooking attempt with different phone is also refused
    await expect(
      saveBooking(
        { ...validDraft, name: "Attacker", phone: "9123456780", supersedes: first.booking.id },
        now,
      ),
    ).rejects.toThrow(/Cannot supersede booking/)

    // Victim booking stays active
    const storedAfterAttack = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8")) as { id: string; status: string; name: string }[]
    expect(storedAfterAttack).toHaveLength(1)
    expect(storedAfterAttack[0].id).toBe(first.booking.id)
    expect(storedAfterAttack[0].status).toBe("active")
    expect(storedAfterAttack[0].name).toBe("Ada Kaur")

    // Supersede with matching phone succeeds
    const byPhone = await saveBooking(
      { ...validDraft, phone: "9876543210", time: "11:00", supersedes: first.booking.id },
      now,
    )
    expect(byPhone.booking.time).toBe("11:00")
    expect(byPhone.booking).not.toHaveProperty("sessionToken")

    const storedAfterPhone = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8")) as { id: string; status: string; time: string; sessionToken?: unknown }[]
    expect(storedAfterPhone).toHaveLength(2)
    expect(storedAfterPhone.find((row) => row.id === first.booking.id)?.status).toBe("superseded")
    expect(storedAfterPhone.find((row) => row.id === byPhone.booking.id)?.time).toBe("11:00")
    expect(storedAfterPhone[1]).not.toHaveProperty("sessionToken")

    // Refuse when superseding an already superseded booking
    await expect(
      saveBooking(
        { ...validDraft, phone: "9876543210", supersedes: first.booking.id },
        now,
      ),
    ).rejects.toThrow(/Cannot supersede booking/)
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

    // Origin check: x-forwarded-host behind proxy, host, and ALLOWED_ORIGINS env var
    const proxyReq = await chat(
      { message: "hello" },
      {
        origin: "https://clinic.vercel.app",
        "x-forwarded-host": "clinic.vercel.app",
        host: "localhost:3000",
      },
    )
    expect(proxyReq.status).toBe(200)

    const hostReq = await chat(
      { message: "hello" },
      {
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
    )
    expect(hostReq.status).toBe(200)

    process.env.ALLOWED_ORIGINS = "https://custom.clinic.com, https://other.clinic.com"
    const allowedReq = await chat(
      { message: "hello" },
      {
        origin: "https://custom.clinic.com",
        host: "localhost:3000",
      },
    )
    expect(allowedReq.status).toBe(200)
    delete process.env.ALLOWED_ORIGINS

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
