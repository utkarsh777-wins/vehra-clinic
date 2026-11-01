import type { ClinicContent } from "@/lib/clinic"
import { normalize } from "@/lib/text"

export type FaqMatch = {
  id: string
  answer: string
  score: number
}

const PHRASES: { id: string; phrases: string[] }[] = [
  { id: "hours", phrases: ["क्या आज खुला है", "ਕੀ ਅੱਜ ਖੁੱਲ੍ਹਾ ਹੈ", "kab khulta", "kab khulte", "clinic kab", "timings kya", "samay kya"] },
  { id: "fees", phrases: ["सफ़ाई का खर्च", "सफाई का खर्च", "ਖ਼ਰਚ ਕਿੰਨਾ", "ਖਰਚ ਕਿੰਨਾ", "kitna fees", "fees kitna", "kharcha kitna"] },
  { id: "children", phrases: ["बच्चों को देखते", "ਬੱਚਿਆਂ ਨੂੰ ਵੇਖਦੇ", "bacche dekhte", "bachon ko"] },
  { id: "parking", phrases: ["पार्किंग कहाँ", "ਪਾਰਕਿੰਗ ਕਿੱਥੇ", "parking kahan", "kithhe park"] },
  { id: "address", phrases: ["कहाँ हो", "कहां हो", "ਕਿੱਥੇ ਹੋ", "kahan ho", "kahan hai", "aap kahan"] },
  { id: "services", phrases: ["कौन सी सेवा", "ਕਿਹੜੀਆਂ ਸੇਵਾਵਾਂ"] },
  { id: "doctors", phrases: ["डॉक्टर कौन", "ਡਾਕਟਰ ਕੌਣ"] },
  { id: "contact", phrases: ["संपर्क कैसे", "ਫ਼ੋਨ ਕਿਵੇਂ"] },
  { id: "sample", phrases: ["क्या यह असली", "ਕੀ ਇਹ ਅਸਲੀ"] },
]

export function matchFaq(query: string, clinic: ClinicContent): FaqMatch | null {
  const folded = query.toLowerCase().replace(/\s+/g, " ").trim()
  for (const entry of PHRASES) {
    if (!entry.phrases.some((phrase) => folded.includes(phrase))) continue
    const found = clinic.faqs.find((item) => item.id === entry.id)
    if (found) return { id: found.id, answer: found.answer, score: 10 }
  }

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
