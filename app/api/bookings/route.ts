import { readBookings } from "@/lib/assistant"
import { clientIp, hitLimit } from "@/lib/guard"

export async function GET(request: Request) {
  if (hitLimit(`bookings:${clientIp(request)}`, 30, 60_000)) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "60" } },
    )
  }
  const result = await readBookings(request)
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  })
}
