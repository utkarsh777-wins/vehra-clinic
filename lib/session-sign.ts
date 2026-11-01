import { createHmac, randomBytes, timingSafeEqual } from "crypto"

import { coerceSession, type Session } from "@/lib/booking"

const ephemeral = randomBytes(32).toString("hex")

function signingSecret(): string {
  const dedicated = process.env.BOOKING_SESSION_SECRET?.trim() || ""
  if (dedicated.length >= 16 && dedicated.toLowerCase() !== "change-me") return dedicated
  const view = process.env.BOOKINGS_VIEW_SECRET?.trim() || ""
  if (view.length >= 16 && view.toLowerCase() !== "change-me") return view
  return ephemeral
}

function canonical(session: Session): string {
  const draft = session.draft
  const parts = [
    `mode=${session.mode}`,
    `step=${session.step ?? ""}`,
    `name=${draft.name ?? ""}`,
    `phone=${draft.phone ?? ""}`,
    `date=${draft.date ?? ""}`,
    `time=${draft.time ?? ""}`,
    `reason=${draft.reason ?? ""}`,
    `hasReason=${draft.reason !== undefined ? "1" : "0"}`,
  ]
  return parts.join("\n")
}

export function signSession(session: Session): string {
  const normalized = coerceSession(session)
  return createHmac("sha256", signingSecret()).update(canonical(normalized)).digest("base64url")
}

export function readSignedSession(input: unknown, token: unknown): Session {
  const session = coerceSession(input)
  if (typeof token !== "string" || token.length < 20) return { mode: "faq", step: null, draft: {} }
  const expected = signSession(session)
  const left = Buffer.from(token)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    timingSafeEqual(right, right)
    return { mode: "faq", step: null, draft: {} }
  }
  if (!timingSafeEqual(left, right)) return { mode: "faq", step: null, draft: {} }
  return session
}
