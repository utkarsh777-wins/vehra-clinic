import type { ClinicContent } from "@/lib/clinic"
import type { Locale } from "@/lib/voice"

export type LlmProvider = "openai" | "groq" | "gemini" | "openrouter" | "none"

const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
}

export function llmConfig(): { provider: LlmProvider; apiKey: string; model: string; enabled: boolean } {
  const raw = (process.env.LLM_PROVIDER || "none").trim().toLowerCase()
  const provider = (["openai", "groq", "gemini", "openrouter", "none"].includes(raw) ? raw : "none") as LlmProvider
  const apiKey = process.env.LLM_API_KEY?.trim() || ""
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider] || ""
  return {
    provider,
    apiKey,
    model,
    enabled: provider !== "none" && apiKey.length > 0 && model.length > 0,
  }
}

export function systemPrompt(clinic: ClinicContent, locale: Locale = "en"): string {
  const language = locale === "hi" ? "Hindi" : locale === "pa" ? "Punjabi" : "the same language the person used"
  return [
    `You are the website assistant for ${clinic.name}, a fictional clinic on a sample site.`,
    "Answer only from the clinic notes below. If the notes do not say it, say the notes do not include that.",
    "Do not invent reviews, testimonials, ratings, awards, patient counts, years of experience, or fees.",
    "Do not give medical advice, diagnose, or promise that a treatment will work. Do not pretend a real person has been booked.",
    "If the person may be having a medical emergency — chest pain, trouble breathing, unconsciousness, heavy bleeding, an accident, swelling of the face or throat, or a request for an ambulance — tell them to call 112 now, or 108 for an ambulance. Say that in their language. Never give the clinic phone number for an emergency.",
    `Reply in ${language}. If they write in Devanagari, reply in Hindi. If they write in Gurmukhi, reply in Punjabi. Use everyday spoken language.`,
    "Keep the reply under 120 words, in plain sentences.",
    "",
    "Clinic notes:",
    JSON.stringify(clinic),
  ].join("\n")
}

export async function answerWithLlm(question: string, clinic: ClinicContent, locale: Locale = "en"): Promise<string> {
  const config = llmConfig()
  if (!config.enabled) {
    throw new Error("LLM is not configured")
  }
  const system = systemPrompt(clinic, locale)
  if (config.provider === "gemini") {
    return gemini(config.apiKey, config.model, system, question)
  }
  const endpoint = OPENAI_COMPAT[config.provider]
  if (!endpoint) throw new Error("Unsupported LLM provider")
  return openaiCompatible(endpoint, config.apiKey, config.model, system, question)
}

async function openaiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  system: string,
  question: string,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status})`)
  }
  const payload: unknown = await response.json()
  const text = readOpenAiText(payload)
  if (!text) throw new Error("LLM returned an empty reply")
  return text
}

async function gemini(apiKey: string, model: string, system: string, question: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(12000),
    },
  )
  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status})`)
  }
  const payload: unknown = await response.json()
  const text = readGeminiText(payload)
  if (!text) throw new Error("LLM returned an empty reply")
  return text
}

function readOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return ""
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content
  return typeof content === "string" ? content.trim() : ""
}

function readGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return ""
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts
  if (!Array.isArray(parts)) return ""
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
    .join("")
    .trim()
}
