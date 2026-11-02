import type { Locale } from "@/content/messages"
import { normalize } from "@/lib/text"

const SCRIPT = [
  /chest\s*pain|heart\s*attack|cannot\s*breathe|can't\s*breathe|cant\s*breathe|difficulty\s*breathing|trouble\s*breathing|shortness\s*of\s*breath|not\s*breathing|unconscious|(?:heavy|uncontrolled|severe)\s+bleeding|bleeding\s+(?:heavily|uncontrollably|severely)|\baccident\b|severe\s*pain|unbearable\s*pain|\bunbearable\b|\bambulance\b|severe\s*swelling|swelling\s+with\s+(?:fever|trouble\s*breathing|difficulty\s*breathing|shortness\s*of\s*breath)|(?:fever|trouble\s*breathing|difficulty\s*breathing|shortness\s*of\s*breath)\s+with\s+swelling|swelling\s+of\s+(?:the\s+)?(?:face|throat)|(?:face|throat)\s+(?:is\s+)?swollen|facial\s*trauma|face\s*trauma|\bemergency\b/i,
  /सांस|साँस|बेहोश|दुर्घटना|एम्बुलेंस|एम्ब्युलेंस|सीने\s*में\s*दर्द|छाती\s*में\s*दर्द|बहुत\s*तेज़\s*दर्द|बहुत\s*तेज\s*दर्द|तेज़\s*दर्द|तेज\s*दर्द|बहुत\s*दर्द|बहुत\s*तेज़|बहुत\s*तेज|असहनीय\s*दर्द|असहनीय|भारी\s*खून|बहुत\s*(?:ज़्यादा|ज्यादा)?\s*खून|अनियंत्रित\s*खून|खून\s*(?:रुक\s*नहीं|बहता\s*जा\s*रहा)|गंभीर\s*सूजन|चेहरे\s*(?:पर)?\s*सूजन|गले\s*(?:में)?\s*सूजन|सूजन\s+के\s+साथ\s+(?:बुखार|सांस)|(?:बुखार|सांस)\s+के\s+साथ\s+सूजन|चेहरे\s*(?:पर)?\s*चोट/,
  /ਸਾਹ|ਬੇਹੋਸ਼|ਬੇਹੋਸ|ਐਂਬੂਲੈਂਸ|ਹਾਦਸਾ|ਛਾਤੀ\s*ਵਿੱਚ\s*ਦਰਦ|ਬਹੁਤ\s*ਤੇਜ਼\s*ਦਰਦ|ਤੇਜ਼\s*ਦਰਦ|ਬਹੁਤ\s*ਦਰਦ|ਬਹੁਤ\s*ਤੇਜ਼|ਅਸਹਿ\s*ਦਰਦ|ਅਸਹਿ|ਭਾਰੀ\s*ਖੂਨ|ਬਹੁਤ\s*(?:ਜ਼ਿਆਦਾ)?\s*ਖੂਨ|ਅਣਰੋਕਿਆ\s*ਖੂਨ|ਗੰਭੀਰ\s*ਸੋਜ|ਚਿਹਰੇ\s*(?:ਤੇ)?\s*ਸੋਜ|ਗਲੇ\s*(?:ਵਿੱਚ)?\s*ਸੋਜ|ਸੋਜ\s+ਨਾਲ\s+(?:ਬੁਖਾਰ|ਸਾਹ)|(?:ਬੁਖਾਰ|ਸਾਹ)\s+ਨਾਲ\s+ਸੋਜ|ਚਿਹਰੇ\s*(?:ਤੇ)?\s*ਸੱਟ/,
]

const LATIN =
  /\b(saans|sans|behosh|behoshi|behos|behosh hai|seene mein|chaati|chaati mein|ambulance|dil ka daura|heart attack|chest pain|unconscious|accident|severe pain|unbearable pain|unbearable|bahut tez|bohot tez|bahut tez dard|bohot tez dard|bahut dard|bohot dard|tez dard|heavy bleeding|uncontrolled bleeding|severe bleeding|severe swelling|facial trauma|trouble breathing|saah)\b/i

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
