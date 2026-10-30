const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "do",
  "does",
  "did",
  "you",
  "your",
  "i",
  "we",
  "our",
  "me",
  "to",
  "of",
  "for",
  "and",
  "or",
  "in",
  "on",
  "at",
  "please",
  "can",
  "could",
  "what",
  "whats",
  "how",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "there",
  "this",
  "that",
  "with",
  "about",
  "tell",
  "any",
  "have",
  "has",
  "from",
  "it",
  "its",
  "be",
  "am",
])

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9+'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokens(input: string): string[] {
  return normalize(input)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP.has(word))
}

export function cleanText(input: string, max = 1000): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}
