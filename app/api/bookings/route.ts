import { readBookings } from "@/lib/assistant"

export async function GET(request: Request) {
  const result = await readBookings(request)
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  })
}
