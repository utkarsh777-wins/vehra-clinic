import type { Locale } from "@/content/messages"
import { normalize } from "@/lib/text"

const SCRIPT = [
  /chest\s*pain|heart\s*attack|cannot\s*breathe|can't\s*breathe|cant\s*breathe|difficulty\s*breathing|shortness\s*of\s*breath|unconscious|not\s*breathing|heavy\s*bleeding|\bbleeding\b|\baccident\b|severe\s*pain|\bambulance\b|swelling\s+of\s+(?:the\s+)?(?:face|throat)|(?:face|throat)\s+(?:is\s+)?swollen|\bemergency\b/i,
  /सांस|साँस|बेहोश|खून|दुर्घटना|एम्बुलेंस|एम्ब्युलेंस|सीने\s*में\s*दर्द|छाती\s*में\s*दर्द|बहुत\s*दर्द|तेज\s*दर्द|तेज़\s*दर्द|दर्द/,
  /ਸਾਹ|ਬੇਹੋਸ|ਖੂਨ|ਦਰਦ|ਐਂਬੂਲੈਂਸ|ਹਾਦਸਾ/,
]

const LATIN =
  /\b(saans|sans|behosh|behoshi|behos|khoon|seene mein|chaati|chaati mein|ambulance|dil ka daura|heart attack|chest pain|unconscious|bleeding|accident|severe pain|saah|dard|behosh hai)\b/i

export function isEmergency(message: string): boolean {
  if (SCRIPT.some((pattern) => pattern.test(message))) return true
  return LATIN.test(normalize(message))
}

export function emergencyReply(locale: Locale): string {
  if (locale === "hi") {
    return "यह इमरजेंसी लग रही है। अभी 112 पर कॉल करें, एम्बुलेंस के लिए 108। मैं इलाज की सलाह नहीं दे सकती।"
  }
  if (locale === "pa") {
    return "ਇਹ ਐਮਰਜੈਂਸੀ ਲੱਗਦੀ ਹੈ। ਹੁਣੇ 112 ਤੇ ਕਾਲ ਕਰੋ, ਐਂਬੂਲੈਂਸ ਲਈ 108। ਮੈਂ ਇਲਾਜ ਦੀ ਸਲਾਹ ਨਹੀਂ ਦੇ ਸਕਦੀ।"
  }
  return "This sounds like an emergency. Call 112 now, or 108 for an ambulance. I can't give medical advice."
}
