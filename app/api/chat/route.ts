import { clockFromRequest, runAssistantTurn } from "@/lib/assistant"

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  const body = payload as { message?: unknown; session?: unknown; intent?: unknown; draft?: unknown }
  const result = await runAssistantTurn({
    message: body.message,
    session: body.session,
    intent: body.intent,
    draft: body.draft,
    now: clockFromRequest(request),
  })
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  })
}
