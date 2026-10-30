export type CalendarDate = { year: number; month: number; day: number }

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function clinicNow(now: Date, timeZone: string): CalendarDate & { weekday: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]))
  let hour = Number(parts.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: hour * 60 + Number(parts.minute),
  }
}

export function toIso(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
}

export function fromIso(iso: string): CalendarDate & { weekday: number } {
  const [year, month, day] = iso.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { year, month, day, weekday }
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

export function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function timeToMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map(Number)
  return hour * 60 + minute
}

export function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function formatClinicDate(iso: string): string {
  const { year, month, day } = fromIso(iso)
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatTime(hhmm: string): string {
  if (hhmm === "morning") return "Morning"
  if (hhmm === "evening") return "Evening"
  const [hour, minute] = hhmm.split(":").map(Number)
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(2026, 0, 1, hour, minute)))
    .toLowerCase()
}
