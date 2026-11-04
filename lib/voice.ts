import { messages, type Locale } from "@/content/messages"

export type { Locale }

type Bundle = {
  openBooking: string
  namePrompt: string
  phoneThanks: (name: string) => string
  whenAsk: string
  timeOn: (date: string) => string
  reasonPrompt: string
  confirmLead: string
  confirmYes: string
  nameLabel: string
  mobileLabel: string
  whenLabel: string
  reasonLabel: string
  notSpecified: string
  thanks: (name: string) => string
  received: string
  deskWillCall: (phone: string) => string
  cancelled: string
  already: string
  missing: string
  changeWhat: string
  yesOrChange: string
  nameAsk: string
  phoneAsk: string
  visitFor: string
  menu: string
  symptom: string
  notAName: string
  sentenceName: string
  lettersName: string
  chooseDate: string
  chooseTime: string
  phoneInvalid: string
  reasonShort: string
  reasonLong: string
  notedWhen: string
  multiTime: string
}

const en: Bundle = {
  openBooking: "Happy to help. I'll take a few details and the desk will call you to confirm a time. What name should I put on it?",
  namePrompt: "What name should I put on it?",
  phoneThanks: (name) => `Thanks, ${name}. What is the mobile number? A 10-digit Indian number is enough.`,
  whenAsk: "Which day and time would you like?",
  timeOn: (date) => `What time on ${date}?`,
  reasonPrompt: "What is the visit for? A short reason is enough. You can also say skip.",
  confirmLead: "Please confirm this request:",
  confirmYes: "Reply yes to submit, or tell me what to change. You can also say cancel.",
  nameLabel: "Name",
  mobileLabel: "Mobile",
  whenLabel: "When",
  reasonLabel: "Reason",
  notSpecified: "Not specified",
  thanks: (name) => `Thank you, ${name}. Your request is with the front desk.`,
  received: "Request received, not yet confirmed.",
  deskWillCall: (phone) =>
    `The desk will call +91 ${phone} to confirm an exact time. Until then, this isn't a booked appointment.`,
  cancelled: "Cancelled. Ask me about hours, services, fees, or start again whenever you like.",
  already: "We're already noting a request.",
  missing: "Some details are missing. What name should I put on the request?",
  changeWhat: "What should I change? You can say name, phone, date, time, or reason.",
  yesOrChange: "Reply yes to submit, or tell me what to change (name, phone, date, time, or reason). You can also say cancel.",
  nameAsk: "What name should I put on it?",
  phoneAsk: "What mobile number should I use?",
  visitFor: "What is the visit for?",
  menu: "I can help with hours, services, fees, the doctors, the address, or an appointment request. What would you like to know?",
  symptom: "I can't advise on symptoms, but the doctor can. Would you like to request an appointment?",
  notAName: "That doesn't look like a name. Please share the patient's name.",
  sentenceName: "Please share just the patient's name, not a sentence.",
  lettersName: "Please share a name using letters, for example Meher Kaur.",
  chooseDate: "Please choose a date.",
  chooseTime: "Please choose morning or evening.",
  phoneInvalid: "Please enter a 10-digit mobile number.",
  reasonShort: "Please add a short reason, at least a few characters, or say skip.",
  reasonLong: "Please keep the reason under 120 characters.",
  notedWhen: "I can note that time.",
  multiTime: "I heard more than one time. Please send just one, for example 10:30 am.",
}

const hi: Bundle = {
  openBooking: "ज़रूर। कुछ विवरण लूँगी, डेस्क समय पक्का करने के लिए फ़ोन करेगी। इस पर कौन सा नाम लिखूँ?",
  namePrompt: "इस पर कौन सा नाम लिखूँ?",
  phoneThanks: (name) => `धन्यवाद, ${name}. मोबाइल नंबर क्या है? 10 अंक काफ़ी हैं।`,
  whenAsk: "कौन सा दिन और समय ठीक रहेगा?",
  timeOn: (date) => `${date} को कौन सा समय ठीक रहेगा?`,
  reasonPrompt: "मुलाकात किस लिए है? छोटा सा कारण काफ़ी है। छोड़ना हो तो skip बोल दें।",
  confirmLead: "कृपया यह अनुरोध देख लें:",
  confirmYes: "भेजने के लिए हाँ लिखें, या बताएँ क्या बदलना है। रद्द भी कर सकते हैं।",
  nameLabel: "नाम",
  mobileLabel: "मोबाइल",
  whenLabel: "समय",
  reasonLabel: "कारण",
  notSpecified: "नहीं बताया",
  thanks: (name) => `धन्यवाद, ${name}. आपका अनुरोध फ्रंट डेस्क के पास है।`,
  received: "अनुरोध मिला, अभी पक्का नहीं।",
  deskWillCall: (phone) => `डेस्क आपको +91 ${phone} पर फ़ोन करके समय पक्का करेगी।`,
  cancelled: "रद्द कर दिया। घंटे, सेवाएँ, फ़ीस पूछ सकते हैं, या फिर से शुरू कर सकते हैं।",
  already: "एक अनुरोध पहले से चल रहा है।",
  missing: "कुछ विवरण बाकी हैं। इस पर कौन सा नाम लिखूँ?",
  changeWhat: "क्या बदलूँ? नाम, फ़ोन, तारीख, समय या कारण बता सकते हैं।",
  yesOrChange: "भेजने के लिए हाँ लिखें, या बताएँ क्या बदलना है। रद्द भी कर सकते हैं।",
  nameAsk: "इस पर कौन सा नाम लिखूँ?",
  phoneAsk: "कौन सा मोबाइल नंबर लिखूँ?",
  visitFor: "मुलाकात किस लिए है?",
  menu: "मैं घंटे, सेवाएँ, फ़ीस, डॉक्टर, पता, या अपॉइंटमेंट के बारे में बता सकती हूँ। क्या जानना है?",
  symptom: "मैं लक्षणों पर सलाह नहीं दे सकती। डॉक्टर बताएँगे। क्या अपॉइंटमेंट का अनुरोध भेजना है?",
  notAName: "यह नाम नहीं लग रहा। मरीज़ का नाम लिखें।",
  sentenceName: "सिर्फ़ मरीज़ का नाम लिखें, पूरा वाक्य नहीं।",
  lettersName: "नाम अक्षरों में लिखें, जैसे मीहर कौर।",
  chooseDate: "कृपया तारीख चुनें।",
  chooseTime: "सुबह या शाम चुनें।",
  phoneInvalid: "10 अंक का मोबाइल नंबर लिखें।",
  reasonShort: "छोटा सा कारण लिखें, या skip बोल दें।",
  reasonLong: "कारण 120 अक्षरों से कम रखें।",
  notedWhen: "यह समय नोट कर सकती हूँ।",
  multiTime: "दो समय सुनाई दिए। एक ही भेजें, जैसे सुबह 10:30।",
}

const pa: Bundle = {
  openBooking: "ਜ਼ਰੂਰ। ਕੁਝ ਵੇਰਵੇ ਲਵਾਂਗੀ, ਡੈਸਕ ਸਮਾਂ ਪੱਕਾ ਕਰਨ ਲਈ ਫ਼ੋਨ ਕਰੇਗੀ। ਇਸ ਉੱਤੇ ਕਿਹੜਾ ਨਾਂ ਲਿਖਾਂ?",
  namePrompt: "ਇਸ ਉੱਤੇ ਕਿਹੜਾ ਨਾਂ ਲਿਖਾਂ?",
  phoneThanks: (name) => `ਧੰਨਵਾਦ, ${name}. ਮੋਬਾਈਲ ਨੰਬਰ ਕੀ ਹੈ? 10 ਅੰਕ ਕਾਫ਼ੀ ਹਨ।`,
  whenAsk: "ਕਿਹੜਾ ਦਿਨ ਅਤੇ ਸਮਾਂ ਠੀਕ ਰਹੇਗਾ?",
  timeOn: (date) => `${date} ਨੂੰ ਕਿਹੜਾ ਸਮਾਂ ਠੀਕ ਰਹੇਗਾ?`,
  reasonPrompt: "ਮੁਲਾਕਾਤ ਕਿਸ ਲਈ ਹੈ? ਛੋਟਾ ਜਿਹਾ ਕਾਰਨ ਕਾਫ਼ੀ ਹੈ। ਛੱਡਣਾ ਹੋਵੇ ਤਾਂ skip ਕਹਿ ਦਿਓ।",
  confirmLead: "ਕਿਰਪਾ ਕਰਕੇ ਇਹ ਬੇਨਤੀ ਵੇਖ ਲਵੋ:",
  confirmYes: "ਭੇਜਣ ਲਈ ਹਾਂ ਲਿਖੋ, ਜਾਂ ਦੱਸੋ ਕੀ ਬਦਲਣਾ ਹੈ। ਰੱਦ ਵੀ ਕਰ ਸਕਦੇ ਹੋ।",
  nameLabel: "ਨਾਂ",
  mobileLabel: "ਮੋਬਾਈਲ",
  whenLabel: "ਸਮਾਂ",
  reasonLabel: "ਕਾਰਨ",
  notSpecified: "ਨਹੀਂ ਦੱਸਿਆ",
  thanks: (name) => `ਧੰਨਵਾਦ, ${name}. ਤੁਹਾਡੀ ਬੇਨਤੀ ਫਰੰਟ ਡੈਸਕ ਕੋਲ ਹੈ।`,
  received: "ਬੇਨਤੀ ਮਿਲੀ, ਅਜੇ ਪੱਕੀ ਨਹੀਂ।",
  deskWillCall: (phone) => `ਡੈਸਕ ਤੁਹਾਨੂੰ +91 ${phone} ਉੱਤੇ ਫ਼ੋਨ ਕਰਕੇ ਸਮਾਂ ਪੱਕਾ ਕਰੇਗੀ।`,
  cancelled: "ਰੱਦ ਕਰ ਦਿੱਤਾ। ਘੰਟੇ, ਸੇਵਾਵਾਂ, ਫ਼ੀਸ ਪੁੱਛ ਸਕਦੇ ਹੋ, ਜਾਂ ਫਿਰ ਤੋਂ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹੋ।",
  already: "ਇੱਕ ਬੇਨਤੀ ਪਹਿਲਾਂ ਤੋਂ ਚੱਲ ਰਹੀ ਹੈ।",
  missing: "ਕੁਝ ਵੇਰਵੇ ਬਾਕੀ ਹਨ। ਇਸ ਉੱਤੇ ਕਿਹੜਾ ਨਾਂ ਲਿਖਾਂ?",
  changeWhat: "ਕੀ ਬਦਲਾਂ? ਨਾਂ, ਫ਼ੋਨ, ਤਾਰੀਖ, ਸਮਾਂ ਜਾਂ ਕਾਰਨ ਦੱਸ ਸਕਦੇ ਹੋ।",
  yesOrChange: "ਭੇਜਣ ਲਈ ਹਾਂ ਲਿਖੋ, ਜਾਂ ਦੱਸੋ ਕੀ ਬਦਲਣਾ ਹੈ। ਰੱਦ ਵੀ ਕਰ ਸਕਦੇ ਹੋ।",
  nameAsk: "ਇਸ ਉੱਤੇ ਕਿਹੜਾ ਨਾਂ ਲਿਖਾਂ?",
  phoneAsk: "ਕਿਹੜਾ ਮੋਬਾਈਲ ਨੰਬਰ ਲਿਖਾਂ?",
  visitFor: "ਮੁਲਾਕਾਤ ਕਿਸ ਲਈ ਹੈ?",
  menu: "ਮੈਂ ਘੰਟੇ, ਸੇਵਾਵਾਂ, ਫ਼ੀਸ, ਡਾਕਟਰ, ਪਤਾ, ਜਾਂ ਅਪੌਇੰਟਮੈਂਟ ਬਾਰੇ ਦੱਸ ਸਕਦੀ ਹਾਂ। ਕੀ ਜਾਨਣਾ ਹੈ?",
  symptom: "ਮੈਂ ਲੱਛਣਾਂ ਉੱਤੇ ਸਲਾਹ ਨਹੀਂ ਦੇ ਸਕਦੀ। ਡਾਕਟਰ ਦੱਸਣਗੇ। ਕੀ ਅਪੌਇੰਟਮੈਂਟ ਦੀ ਬੇਨਤੀ ਭੇਜਣੀ ਹੈ?",
  notAName: "ਇਹ ਨਾਂ ਨਹੀਂ ਲੱਗ ਰਿਹਾ। ਮਰੀਜ਼ ਦਾ ਨਾਂ ਲਿਖੋ।",
  sentenceName: "ਸਿਰਫ਼ ਮਰੀਜ਼ ਦਾ ਨਾਂ ਲਿਖੋ, ਪੂਰਾ ਵਾਕ ਨਹੀਂ।",
  lettersName: "ਨਾਂ ਅੱਖਰਾਂ ਵਿੱਚ ਲਿਖੋ, ਜਿਵੇਂ ਮੀਹਰ ਕੌਰ।",
  chooseDate: "ਕਿਰਪਾ ਕਰਕੇ ਤਾਰੀਖ ਚੁਣੋ।",
  chooseTime: "ਸਵੇਰ ਜਾਂ ਸ਼ਾਮ ਚੁਣੋ।",
  phoneInvalid: "10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਲਿਖੋ।",
  reasonShort: "ਛੋਟਾ ਜਿਹਾ ਕਾਰਨ ਲਿਖੋ, ਜਾਂ skip ਕਹਿ ਦਿਓ।",
  reasonLong: "ਕਾਰਨ 120 ਅੱਖਰਾਂ ਤੋਂ ਘੱਟ ਰੱਖੋ।",
  notedWhen: "ਇਹ ਸਮਾਂ ਨੋਟ ਕਰ ਸਕਦੀ ਹਾਂ।",
  multiTime: "ਦੋ ਸਮੇਂ ਸੁਣੇ। ਇੱਕ ਹੀ ਭੇਜੋ, ਜਿਵੇਂ ਸਵੇਰ 10:30।",
}

const BUNDLES: Record<Locale, Bundle> = { en, hi, pa }

export function voice(locale: Locale): Bundle {
  return BUNDLES[locale]
}

export function localizeFaq(id: string, locale: Locale, english: string): string {
  if (locale === "en") return english
  const t = messages[locale]
  const hours = `${t.doctors.rows[0][0]}: ${t.doctors.rows[0][1]}, ${t.doctors.rows[0][2]}. ${t.doctors.rows[1][0]}: ${t.doctors.rows[1][1]}, ${t.doctors.rows[1][2]}. ${t.doctors.sunday}: ${t.doctors.closed}`
  const known: Record<string, string> = {
    hours,
    "walk-in": t.faq.items[0][1],
    fees: t.chat.feeAnswer,
    children: t.faq.items[2][1],
    bring: t.faq.items[3][1],
    payment: t.faq.items[4][1],
    sunday: t.faq.items[5][1],
    parking: `${t.visit.parkingValue}. ${t.visit.accessValue}.`,
    address: `${t.visit.lines.join(", ")}. ${t.visit.flag}`,
    doctors: `${t.doctors.people.map((person) => `${person[0]}, ${person[2]}`).join(". ")}. ${t.doctors.lede}`,
    services: t.services.items.map((item) => item[0]).join(", "),
    languages: t.why.items[3][1],
    sample: t.sampleBar,
    contact: `${t.visit.phone} +91 00000 00000. ${t.visit.flag}`,
    "booking-how": t.chat.bookAck,
  }
  return known[id] ?? english
}

export function resolveLocale(message: string, requested?: unknown): Locale {
  if (/[\u0A00-\u0A7F]/.test(message)) return "pa"
  if (/[\u0900-\u097F]/.test(message)) return "hi"
  const latin = message.toLowerCase()
  if (/\b(tusi|tuhanu|kiven|kiddan|kithhe|kithe|sanu|saah)\b/.test(latin)) return "pa"
  if (/\b(kya|hai|haan|nahi|nahin|kitna|kahan|kab|khulta|subah|shaam|saans|behosh|khoon|mujhe|aap)\b/.test(latin)) {
    return "hi"
  }
  if (requested === "hi" || requested === "pa" || requested === "en") return requested
  return "en"
}
