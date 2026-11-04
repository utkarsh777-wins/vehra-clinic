import type { Locale } from "@/content/messages"
import { normalize } from "@/lib/text"

const SCRIPT = [
  /chest\s*pain|heart\s*attack|cannot\s*breathe|can't\s*breathe|cant\s*breathe|difficulty\s*breathing|trouble\s*breathing|shortness\s*of\s*breath|not\s*breathing|unconscious|(?:heavy|uncontrolled|severe)\s+bleeding|bleeding\s+(?:heavily|uncontrollably|severely)|\baccident\b|severe\s*pain|unbearable\s*pain|\bunbearable\b|\bambulance\b|severe\s*swelling|swelling\s+with\s+(?:fever|trouble\s*breathing|difficulty\s*breathing|shortness\s*of\s*breath)|(?:fever|trouble\s*breathing|difficulty\s*breathing|shortness\s*of\s*breath)\s+with\s+swelling|swelling\s+of\s+(?:the\s+)?(?:face|throat)|(?:face|throat)\s+(?:is\s+)?(?:swollen|swelling(?:\s+up)?)|swollen\s+(?:face|eye|throat)|throat\s+swelling|(?:face|eye)\s+swelling(?:\s+up)?|face\s+is\s+swelling(?:\s+up)?|swelling\s+(?:spreading\s+to|around|in|near)\s+(?:the\s+|my\s+)?eye|(?:can'?t|cannot|unable\s+to)\s+swallow|(?:difficulty|trouble)\s+swallowing|bleeding\s+(?:won'?t|wont|will\s*not|doesn'?t|not)\s*stop(?:ping)?|(?:can'?t|cant|cannot|unable\s+to)\s+stop\s+(?:the\s+)?bleeding|(?:broken|fractured|injured)\s+jaw|jaw\s+(?:injury|fracture|broken|trauma|is\s+broken)|hurt\s+(?:my\s+)?jaw|knocked\s*out\s*tooth|tooth\s*knocked\s*out|teeth\s*knocked\s*out|facial\s*trauma|face\s*trauma|\bemergency\b/i,
  /बेहोश|दुर्घटना|एम्बुलेंस|एम्ब्युलेंस|सीने\s*मे\u0902?\s*दर्द|छाती\s*मे\u0902?\s*दर्द|बहुत\s*तेज़\s*दर्द|बहुत\s*तेज\s*दर्द|तेज़\s*दर्द|तेज\s*दर्द|बहुत\s*दर्द|बहुत\s*तेज़|बहुत\s*तेज|असहनीय\s*दर्द|असहनीय|भारी\s*खून|बहुत\s*(?:ज़्यादा|ज्यादा)?\s*खून|अनियंत्रित\s*खून|खून\s*(?:नहीं\s*रुक|रुक\s*नहीं|बहता\s*जा\s*रहा|बंद\s*नहीं\s*हो\s*रहा)|गंभीर\s*सूजन|चेहरे?\s*(?:पर|पे|मे\u0902?)?\s*सूजन|चेहरा\s*सूज\s*गया|गले\s*(?:मे\u0902?|पर)?\s*सूजन|आ[ँं]ख\s*(?:तक|मे\u0902?|पर)?\s*सूजन|सूजन\s+के\s+साथ\s+(?:बुखार|सा[ँं]स)|(?:बुखार|सा[ँं]स)\s+के\s+साथ\s+सूजन|चेहरे\s*(?:पर)?\s*चोट|जब(?:ड़े?|डे?)\s*(?:मे\u0902?|पर|पे)?\s*चोट|जब(?:ड़ा|डा)\s*(?:टूट\s*गया|टूटा)|निगल(?:ने)?\s*(?:मे\u0902?\s*(?:तकलीफ|दिक्कत|दर्द|परेशानी)|नहीं\s*पा\s*रह[ीा])|दाँ?त\s*टूट\s*(?:कर\s*)?गिर|सा[ँं]स(?:\s+\S+){0,4}\s+(?:नहीं\s*आ|नहीं\s*ले|तकली[फफ़]|दिक्कत|फूल|रुक|परेशानी)/,
  /ਬੇਹੋਸ਼|ਬੇਹੋਸ|ਐਂਬੂਲੈਂਸ|ਹਾਦਸਾ|ਛਾਤੀ\s*ਵਿੱਚ\s*ਦਰਦ|ਬਹੁਤ\s*ਤੇ[ਜ਼ਜ]\s*ਦਰਦ|ਤੇ[ਜ਼ਜ]\s*ਦਰਦ|ਬਹੁਤ\s*ਦਰਦ|ਬਹੁਤ\s*ਤੇ[ਜ਼ਜ]|ਅਸਹਿ\s*ਦਰਦ|ਅਸਹਿ|ਭਾਰੀ\s*ਖੂਨ|ਬਹੁਤ\s*(?:[ਜ਼ਜ]ਿਆਦਾ)?\s*ਖੂਨ|ਅਣਰੋਕਿਆ\s*ਖੂਨ|ਖੂਨ\s*(?:ਨਹੀਂ\s*ਰੁਕ|ਰੁਕ\s*ਨਹੀਂ|ਵਗਦਾ\s*ਜਾ\s*ਰਿਹਾ)|ਗੰਭੀਰ\s*ਸੋਜ|ਚਿਹਰੇ\s*(?:ਤੇ|'ਤੇ|ਵਿੱਚ)?\s*ਸੋਜ|ਗਲੇ\s*(?:ਵਿੱਚ)?\s*ਸੋਜ|ਅੱਖ\s*(?:ਤੱਕ|ਵਿੱਚ|ਤੇ|'ਤੇ)?\s*ਸੋਜ|ਸੋਜ\s+ਨਾਲ\s+(?:ਬੁਖਾਰ|ਸਾਹ)|(?:ਬੁਖਾਰ|ਸਾਹ)\s+ਨਾਲ\s+ਸੋਜ|ਚਿਹਰੇ\s*(?:ਤੇ)?\s*ਸੱਟ|ਜਬਾੜੇ?\s*(?:ਤੇ|'ਤੇ|ਵਿੱਚ)?\s*ਸੱਟ|ਜਬਾੜਾ\s*(?:ਟੁੱਟ\s*ਗਿਆ|ਟੁੱਟਾ)|(?:ਨਿਗਲਣ|ਲੰਘਾਉਣ)\s*(?:ਵਿੱਚ\s*(?:ਤਕਲੀ[ਫਫ਼]\u0A3C?|ਦਰਦ|ਔਖ)|ਨਹੀਂ\s*(?:ਸਕਦਾ|ਹੋ\s*ਰਿਹਾ))|ਦੰਦ\s*ਟੁੱਟ\s*(?:ਕੇ\s*)?ਡਿੱਗ|ਸਾਹ(?:\s+\S+){0,4}\s+(?:ਨਹੀਂ\s*ਆ|ਨਹੀਂ\s*ਲੈ|ਤਕਲੀ[ਫਫ਼]\u0A3C?|ਔਖ|ਦਿੱ?ਕਤ|ਦਿਕਤ|ਫੁੱ?ਲ|ਫੁਲ|ਰੁਕ)/,
]

const LATIN =
  /\b(behosh|behoshi|behos|behosh hai|seene mein|chaati|chaati mein|ambulance|dil ka daura|heart attack|chest pain|unconscious|accident|severe pain|unbearable pain|unbearable|bahut tez|bohot tez|bahut tez dard|bohot tez dard|bahut dard|bohot dard|tez dard|heavy bleeding|uncontrolled bleeding|severe bleeding|severe swelling|facial trauma|trouble breathing|(?:saans|sans|saah)(?:\s+\w+){0,4}\s+(?:nahin?\s*aa|nahin?\s*le|takleef|dikkat|phool|ruk|pareshani)|bahut khoon beh raha hai|bohot khoon beh raha hai|khoon\s+(?:nahin?\s*ruk|ruk\s*nahin?)|bahut khoon|bohot khoon|bhari khoon|bhaari khoon|(?:chehre|chehra)\s*(?:pe|par|te)?\s*(?:s[ou]+jan|soj|sooj\s*gaya)|aankh tak s[ou]+jan|akh tak soj|jabda toot gaya|jabda tut gaya|jabde? (?:mein|pe|par|te)?\s*chot|swollen face|throat swelling|swollen throat|swollen eye|eye swelling|swelling spreading to (?:my\s+|the\s+)?eye|i can'?t swallow|can'?t swallow|difficulty swallowing|trouble swallowing|bleeding won'?t stop|can'?t stop (?:the\s+)?bleeding|jaw injury|broken jaw|hurt my jaw|hurt jaw|knocked out tooth|nigal(?:ne)?\s*(?:me(?:in)?\s*(?:takleef|dikkat|pareshani|dard)|nahin?\s*pa\s*rah[ai]))\b/i

const BAD_BREATH =
  /(?:(?:saans|sans|saah|muh|munh|mooh|mouth)(?:\s*(?:se|ki|ke|mein|me|mai|main|vich|vicho|vichon|ch|chon|'chon|'ch|di|de|to|ton|te|from|in)){0,2}(?:\s*(?:bahut|bohot))?\s*)?(?:badboo\b|badbu\b|bad\s*breath\b)|(?:(?:सा[ँं]स|मु[ँं]ह)(?:\s*(?:से|की|के|मे[\u0902\u0901]?|पर)){0,2}(?:\s*(?:बहुत|ज़्यादा|ज्यादा))?\s*)?बदबू|(?:(?:ਸਾਹ|ਮੂੰਹ)(?:\s*(?:ਵਿੱਚੋਂ|ਵਿਚੋਂ|'ਚੋਂ|ਚੋਂ|ਵਿੱਚ|ਵਿਚ|ਦੀ|ਦੇ|ਤੋਂ|ਤੇ)){0,2}(?:\s*ਬਹੁਤ)?\s*)?ਬਦਬੂ/gi

export function isEmergency(message: string): boolean {
  const stripped = message.replace(BAD_BREATH, " ")
  const clean = stripped.replace(/[\u093C\u0A3C]/g, "")
  if (SCRIPT.some((pattern) => pattern.test(stripped) || pattern.test(clean))) return true
  return LATIN.test(normalize(stripped)) || LATIN.test(normalize(clean))
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
