import { mkdtemp, readFile, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/bookings/route"
import { POST } from "@/app/api/chat/route"
import type { Session } from "@/lib/booking"
import { resetGuards } from "@/lib/guard"

const NOW = "2026-10-29T04:30:00.000Z"

let directory: string
const originalEnv = { ...process.env }

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "sukoon-"))
  process.env.BOOKINGS_STORE_PATH = path.join(directory, "bookings.json")
  process.env.BOOKINGS_FALLBACK_PATH = path.join(directory, "fallback.json")
  process.env.BOOKINGS_VIEW_SECRET = "test-secret-value1"
  resetGuards()
  process.env.LLM_PROVIDER = "none"
  delete process.env.LLM_API_KEY
  delete process.env.LLM_MODEL
  delete process.env.BOOKING_WEBHOOK_URL
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "919876543210"
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
  await rm(directory, { recursive: true, force: true })
})

function chat(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-clock": NOW, ...headers },
      body: JSON.stringify(body),
    }),
  )
}

async function bookThroughChat() {
  let response = await chat({ message: "", intent: "start_booking" })
  let payload = (await response.json()) as {
    session: Session
    sessionToken?: string
    reply: string
    booking: { id: string; webhook: string }
  }
  const steps = ["Ada Kaur", "9876543210", "2 Nov 2026 10:30 am", "Tooth check-up", "yes"]
  for (const message of steps) {
    response = await chat({ message, session: payload.session, sessionToken: payload.sessionToken })
    payload = await response.json()
  }
  return { response, payload }
}

describe("POST /api/chat", () => {
  it("rejects invalid JSON and empty messages", async () => {
    const invalid = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    )
    expect(invalid.status).toBe(400)

    const empty = await chat({ message: "   " })
    expect(empty.status).toBe(400)
  })

  it("answers from the knowledge file without calling a model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const response = await chat({ message: "Where is the clinic?" })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.source).toBe("rules")
    expect(payload.reply).toContain("Banga Road")
    expect(payload.sampleLabel).toBe("Sample site")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("saves a confirmed request and lists it with the view secret", async () => {
    const { response, payload } = await bookThroughChat()
    expect(response.status).toBe(200)
    expect(payload.reply).toMatch(/Request received, not yet confirmed/)
    expect(payload.reply).toMatch(/not sent yet/)
    expect(payload.booking.webhook).toBe("skipped")
    expect(payload.booking.id).toMatch(/^VH-/)

    const stored = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8"))
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      name: "Ada Kaur",
      phone: "9876543210",
      date: "2026-11-02",
      time: "10:30",
      reason: "Tooth check-up",
      source: "chat",
      sample: true,
      language: "en",
      status: "active",
    })
    expect(stored[0].key).toMatch(/^[0-9a-f-]{36}$/)
    expect(stored[0].id).toMatch(/^VH-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)

    const hidden = await GET(new Request("http://localhost/api/bookings"))
    expect(hidden.status).toBe(401)

    const shown = await GET(
      new Request("http://localhost/api/bookings", {
        headers: { "x-bookings-secret": "test-secret-value1" },
      }),
    )
    expect(shown.status).toBe(200)
    const body = await shown.json()
    expect(body.bookings[0].id).toBe(payload.booking.id)
  })

  it("closes the log when the view secret is unset", async () => {
    delete process.env.BOOKINGS_VIEW_SECRET
    const response = await GET(new Request("http://localhost/api/bookings"))
    expect(response.status).toBe(503)
  })

  it("posts to the webhook and still keeps the local copy if the webhook fails", async () => {
    process.env.BOOKING_WEBHOOK_URL = "https://example.test/hook"
    const fetchMock = vi.fn().mockResolvedValue(new Response("no", { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)

    const { payload } = await bookThroughChat()
    expect(payload.booking.webhook).toBe("failed")
    expect(payload.reply).toMatch(/spreadsheet webhook/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({ phone: "9876543210", sample: true, language: "en" })

    const stored = JSON.parse(await readFile(process.env.BOOKINGS_STORE_PATH!, "utf8"))
    expect(stored).toHaveLength(1)
  })

  it("uses an OpenAI-compatible reply and falls back when the provider errors", async () => {
    process.env.LLM_PROVIDER = "groq"
    process.env.LLM_API_KEY = "test-key"
    process.env.LLM_MODEL = "test-model"
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ choices: [{ message: { content: "The notes place the clinic in Phagwara." } }] }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const answered = await chat({ message: "Where are you?" })
    const answeredBody = await answered.json()
    expect(answeredBody.source).toBe("llm")
    expect(answeredBody.reply).toContain("Phagwara")
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init.body)).toContain("Banga Road")
    expect(String(init.body)).toContain("112")
    expect(String(init.body).toLowerCase()).not.toContain("demo")
    expect(String((init.headers as Record<string, string>).authorization)).toBe("Bearer test-key")

    fetchMock.mockRejectedValueOnce(new Error("offline"))
    const fallback = await chat({ message: "Where is the clinic?" })
    const fallbackBody = await fallback.json()
    expect(fallbackBody.source).toBe("rules")
    expect(fallbackBody.reply).toContain("Banga Road")
  })

  it("writes to the fallback file when the primary path cannot be created", async () => {
    const blocker = path.join(directory, "not-a-directory")
    await writeFile(blocker, "x")
    process.env.BOOKINGS_STORE_PATH = path.join(blocker, "bookings.json")
    const { payload } = await bookThroughChat()
    expect(payload.booking.id).toMatch(/^VH-/)
    const stored = JSON.parse(await readFile(process.env.BOOKINGS_FALLBACK_PATH!, "utf8"))
    expect(stored[0].name).toBe("Ada Kaur")
  })
})
