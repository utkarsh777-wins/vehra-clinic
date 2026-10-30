import type { ClinicContent } from "@/lib/clinic"
import { normalize } from "@/lib/text"

export type FaqMatch = {
  id: string
  answer: string
  score: number
}

export function matchFaq(query: string, clinic: ClinicContent): FaqMatch | null {
  const normalized = normalize(query)
  if (!normalized) return null

  let best: (FaqMatch & { weight: number }) | null = null

  for (const entry of clinic.faqs) {
    let score = 0
    let weight = 0
    for (const keyword of entry.keywords) {
      const key = normalize(keyword)
      if (!key) continue
      const matched = key.includes(" ") ? normalized.includes(key) : new RegExp(`\\b${escapeRegExp(key)}\\b`).test(normalized)
      if (!matched) continue
      score += key.includes(" ") ? 5 : 3
      weight += key.length
    }

    if (!best || score > best.score || (score === best.score && weight > best.weight)) {
      best = { id: entry.id, answer: entry.answer, score, weight }
    }
  }

  if (!best || best.score < 3) return null
  return { id: best.id, answer: best.answer, score: best.score }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
