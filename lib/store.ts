import { randomBytes } from "crypto"
import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"

import type { AppointmentRequest } from "@/lib/booking"

export type StoredBooking = AppointmentRequest & {
  id: string
  createdAt: string
  source: "chat"
  demo: true
}

export type SaveResult = {
  booking: StoredBooking
  file: string
  webhook: "skipped" | "sent" | "failed"
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

export async function saveBooking(input: AppointmentRequest, now = new Date()): Promise<SaveResult> {
  const booking: StoredBooking = {
    id: `VH-${String((now.getTime() + randomBytes(2).readUInt16BE(0)) % 10000).padStart(4, "0")}`,
    name: input.name,
    phone: input.phone,
    date: input.date,
    time: input.time,
    reason: input.reason,
    createdAt: now.toISOString(),
    source: "chat",
    demo: true,
  }

  const primary = resolveStorePath()
  const fallback = defaultFallbackPath()
  let file = primary
  try {
    await appendBooking(primary, booking)
  } catch (error) {
    if (path.resolve(/*turbopackIgnore: true*/ primary) === path.resolve(/*turbopackIgnore: true*/ fallback)) throw error
    await appendBooking(fallback, booking)
    file = fallback
  }

  const webhook = await postWebhook(booking)
  return { booking, file, webhook }
}

export async function listBookings(): Promise<StoredBooking[]> {
  const primary = resolveStorePath()
  const primaryList = await readList(primary)
  if (primaryList) return primaryList
  const fallback = defaultFallbackPath()
  if (path.resolve(/*turbopackIgnore: true*/ primary) === path.resolve(/*turbopackIgnore: true*/ fallback)) return []
  return (await readList(fallback)) ?? []
}

async function appendBooking(file: string, booking: StoredBooking): Promise<void> {
  await withLock(async () => {
    await mkdir(path.dirname(file), { recursive: true })
    const existing = (await readList(file)) ?? []
    existing.push(booking)
    const temporary = `${file}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(existing, null, 2))
    await rename(temporary, file)
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
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(booking),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    })
    return response.ok ? "sent" : "failed"
  } catch {
    return "failed"
  }
}
