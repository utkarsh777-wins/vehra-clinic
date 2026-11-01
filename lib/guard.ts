type Bucket = { count: number; reset: number }
type Failures = { count: number; lockUntil: number }

const buckets = new Map<string, Bucket>()
const secretFails = new Map<string, Failures>()

const WEAK_SECRETS = new Set(["change-me", "changeme", "password", "secret"])

export function resetGuards(): void {
  buckets.clear()
  secretFails.clear()
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return "local"
}

export function hitLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return false
  }
  bucket.count += 1
  return bucket.count > limit
}

export function viewSecretProblem(): string | null {
  const secret = process.env.BOOKINGS_VIEW_SECRET?.trim() || ""
  if (!secret || secret.length < 16 || WEAK_SECRETS.has(secret.toLowerCase())) {
    return "BOOKINGS_VIEW_SECRET is missing or still a placeholder, so the request log is closed."
  }
  return null
}

export function secretLocked(request: Request): boolean {
  const row = secretFails.get(clientIp(request))
  return Boolean(row && row.lockUntil > Date.now())
}

export function noteSecretFailure(request: Request): void {
  const ip = clientIp(request)
  const row = secretFails.get(ip) ?? { count: 0, lockUntil: 0 }
  row.count += 1
  if (row.count >= 8) row.lockUntil = Date.now() + 15 * 60 * 1000
  secretFails.set(ip, row)
}

export function noteSecretSuccess(request: Request): void {
  secretFails.delete(clientIp(request))
}

export async function readJson(
  request: Request,
  max = 20_000,
): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const type = request.headers.get("content-type") || ""
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json." }
  }
  const origin = request.headers.get("origin")
  if (origin) {
    let expected = ""
    try {
      expected = new URL(request.url).origin
    } catch {
      expected = ""
    }
    if (!expected || origin !== expected) {
      return { ok: false, status: 403, error: "Cross-origin requests are not accepted." }
    }
  }
  const declared = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(declared) && declared > max) {
    return { ok: false, status: 413, error: "Request body is too large." }
  }
  const text = await request.text()
  if (text.length > max) return { ok: false, status: 413, error: "Request body is too large." }
  try {
    const value: unknown = JSON.parse(text)
    return { ok: true, value }
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON." }
  }
}
