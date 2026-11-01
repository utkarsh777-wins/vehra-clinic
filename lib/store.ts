import { createHmac, randomBytes, randomUUID } from "crypto"
import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"

import type { AppointmentRequest } from "@/lib/booking"
import type { Locale } from "@/lib/voice"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export type StoredBooking = AppointmentRequest & {
  key: string
  id: string
  createdAt: string
  source: "chat"
  sample: true
  status: "active" | "superseded"
  language: Locale
  idempotencyKey?: string
  supersedes?: string
  supersededAt?: string
}

export type SaveResult = {
  booking: StoredBooking
  file: string
  webhook: "skipped" | "sent" | "failed"
  replay: boolean
}

export type SaveInput = AppointmentRequest & {
  language?: Locale
  idempotencyKey?: string
  supersedes?: string
}

let chain: Promise<unknown> = Promise.resolve()

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function resolveStorePath(): string {
  const configured = process.env.BOOKINGS_STORE_PATH?.trim()
  if (configured) return configured
  if (process.env.VERCEL) return "/tmp/vehra-bookings.json"
  return path.join(process.cwd(), "data", "bookings.json")
}

export function defaultFallbackPath(): string {
  return process.env.BOOKINGS_FALLBACK_PATH?.trim() || "/tmp/vehra-bookings.json"
}

function publicRef(): string {
  const bytes = randomBytes(8)
  let out = ""
  for (let index = 0; index < 8; index += 1) {
    out += ALPHABET[bytes[index] % ALPHABET.length]
  }
  return `VH-${out}`
}

export async function saveBooking(input: SaveInput, now = new Date()): Promise<SaveResult> {
  const draft: Omit<StoredBooking, "key" | "id"> = {
    name: input.name,
    phone: input.phone,
    date: input.date,
    time: input.time,
    reason: input.reason,
    createdAt: now.toISOString(),
    source: "chat",
    sample: true,
    status: "active",
    language: input.language ?? "en",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  }

  const primary = resolveStorePath()
  const fallback = defaultFallbackPath()
  let file = primary
  let saved: { booking: StoredBooking; replay: boolean }
  try {
    saved = await appendBooking(primary, draft)
  } catch (error) {
    if (path.resolve(/*turbopackIgnore: true*/ primary) === path.resolve(/*turbopackIgnore: true*/ fallback)) throw error
    saved = await appendBooking(fallback, draft)
    file = fallback
  }

  if (saved.replay) return { booking: saved.booking, file, webhook: "skipped", replay: true }
  const webhook = await postWebhook(saved.booking)
  return { booking: saved.booking, file, webhook, replay: false }
}

export async function listBookings(): Promise<StoredBooking[]> {
  const primary = resolveStorePath()
  const primaryList = await readList(primary)
  if (primaryList) return primaryList
  const fallback = defaultFallbackPath()
  if (path.resolve(/*turbopackIgnore: true*/ primary) === path.resolve(/*turbopackIgnore: true*/ fallback)) return []
  return (await readList(fallback)) ?? []
}

async function appendBooking(
  file: string,
  draft: Omit<StoredBooking, "key" | "id">,
): Promise<{ booking: StoredBooking; replay: boolean }> {
  return withLock(async () => {
    await mkdir(path.dirname(file), { recursive: true })
    const existing = (await readList(file)) ?? []
    if (draft.idempotencyKey) {
      const prior = existing.find((booking) => booking.idempotencyKey === draft.idempotencyKey)
      if (prior) return { booking: prior, replay: true }
    }
    if (!draft.supersedes) {
      const duplicate = existing.find(
        (booking) =>
          booking.status !== "superseded" &&
          booking.name === draft.name &&
          booking.phone === draft.phone &&
          booking.date === draft.date &&
          booking.time === draft.time &&
          booking.reason === draft.reason,
      )
      if (duplicate) return { booking: duplicate, replay: true }
    } else {
      const previous = existing.find((booking) => booking.id === draft.supersedes || booking.key === draft.supersedes)
      if (previous && previous.status !== "superseded") {
        previous.status = "superseded"
        previous.supersededAt = draft.createdAt
      }
    }

    const used = new Set(existing.map((booking) => booking.id))
    let id = publicRef()
    while (used.has(id)) id = publicRef()
    const booking: StoredBooking = { ...draft, key: randomUUID(), id }
    existing.push(booking)
    const temporary = `${file}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(existing, null, 2))
    await rename(temporary, file)
    return { booking, replay: false }
  })
}

async function readList(file: string): Promise<StoredBooking[] | null> {
  try {
    const raw = await readFile(file, "utf8")
    if (!raw.trim()) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error("Bookings store is not a list")
    }
    return parsed as StoredBooking[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

async function postWebhook(booking: StoredBooking): Promise<"skipped" | "sent" | "failed"> {
  const url = process.env.BOOKING_WEBHOOK_URL?.trim()
  if (!url) return "skipped"
  const body = JSON.stringify(booking)
  const headers: Record<string, string> = { "content-type": "application/json" }
  const secret = process.env.BOOKING_WEBHOOK_SECRET?.trim()
  if (secret) {
    headers["x-vehra-signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    })
    return response.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}
