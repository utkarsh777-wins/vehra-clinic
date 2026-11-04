import { clinicNow, formatTime, timeToMinutes } from "@/lib/calendar"
import type { ClinicHours } from "@/lib/clinic"
import type { Locale } from "@/content/messages"
import { slotsForWeekday } from "@/lib/when"

const LABELS: Record<Locale, { closedToday: string; openUntil: string; opensAt: string; closedForToday: string }> = {
  en: {
    closedToday: "Closed today",
    openUntil: "Open today until {time}",
    opensAt: "Opens today at {time}",
    closedForToday: "Closed for today",
  },
  hi: {
    closedToday: "आज बंद है",
    openUntil: "आज {time} तक खुला है",
    opensAt: "आज {time} पर खुलेगा",
    closedForToday: "आज का समय खत्म हो गया",
  },
  pa: {
    closedToday: "ਅੱਜ ਬੰਦ ਹੈ",
    openUntil: "ਅੱਜ {time} ਤੱਕ ਖੁੱਲ੍ਹਾ ਹੈ",
    opensAt: "ਅੱਜ {time} ਤੇ ਖੁੱਲ੍ਹੇਗਾ",
    closedForToday: "ਅੱਜ ਦਾ ਸਮਾਂ ਖਤਮ ਹੋ ਗਿਆ",
  },
}

export function openTodayLabel(now: Date, locale: Locale, hours: ClinicHours): { closed: boolean; label: string } {
  const today = clinicNow(now, hours.timezone)
  const slots = slotsForWeekday(hours, today.weekday)
  const text = LABELS[locale]
  if (slots.length === 0) return { closed: true, label: text.closedToday }
  const current = slots.find(
    (slot) => today.minutes >= timeToMinutes(slot.start) && today.minutes < timeToMinutes(slot.end),
  )
  if (current) return { closed: false, label: text.openUntil.replace("{time}", formatTime(current.end)) }
  const next = slots.find((slot) => today.minutes < timeToMinutes(slot.start))
  if (next) return { closed: true, label: text.opensAt.replace("{time}", formatTime(next.start)) }
  return { closed: true, label: text.closedForToday }
}
