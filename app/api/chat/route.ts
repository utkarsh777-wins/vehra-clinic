import { clockFromRequest, runAssistantTurn } from "@/lib/assistant"
import { clientIp, hitLimit, readJson } from "@/lib/guard"

export async function POST(request: Request) {
  if (hitLimit(`chat:${clientIp(request)}`, 40, 60_000)) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "60" } },
    )
  }
  const parsed = await readJson(request)
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status, headers: { "cache-control": "no-store" } })
  }
  if (!parsed.value || typeof parsed.value !== "object") {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  const body = parsed.value as {
    message?: unknown
    session?: unknown
    sessionToken?: unknown
    intent?: unknown
    draft?: unknown
    locale?: unknown
    idempotencyKey?: unknown
    supersedes?: unknown
  }
  const result = await runAssistantTurn({
    message: body.message,
    session: body.session,
    sessionToken: body.sessionToken,
    intent: body.intent,
    draft: body.draft,
    locale: body.locale,
    idempotencyKey: body.idempotencyKey,
    supersedes: body.supersedes,
    now: clockFromRequest(request),
  })
  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  })
}
