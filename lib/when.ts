import {
  addDays,
  clinicNow,
  formatClinicDate,
  formatHHMM,
  formatTime,
  fromIso,
  isRealDate,
  timeToMinutes,
  toIso,
  type CalendarDate,
} from "@/lib/calendar"
import type { ClinicHours, TimeSlot } from "@/lib/clinic"

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

export type WhenResult =
  | { status: "complete"; date: string; time: string }
  | { status: "need-time"; date: string; message: string }
  | { status: "need-date"; time: string; message: string }
  | { status: "invalid"; message: string }

const NEED_BOTH = "Please share a date and a time, for example tomorrow at 10:30 am."

export function parseWhen(
  input: string,
  now: Date,
  hours: ClinicHours,
  partial?: { date?: string; time?: string },
): WhenResult {
  const extracted = extractDateAndTime(input, now, hours.timezone)
  if (extracted.error && !extracted.date && !extracted.time) {
    return { status: "invalid", message: extracted.error }
  }

  const date = extracted.date ?? partial?.date
  const time = extracted.time ?? partial?.time

  if (!extracted.date && !extracted.time && !partial?.date && !partial?.time) {
    return { status: "invalid", message: extracted.error ?? NEED_BOTH }
  }

  if (!date && time) {
    return {
      status: "need-date",
      time,
      message: `Which date should I use for ${formatTime(time)}?`,
    }
  }
  if (date && !time) {
    return {
      status: "need-time",
      date,
      message: `What time on ${formatClinicDate(date)}? For example, 10:30 am or 4:30 pm.`,
    }
  }
  if (!date || !time) {
    return { status: "invalid", message: NEED_BOTH }
  }

  const problem = validateSlot(date, time, now, hours)
  if (problem) return { status: "invalid", message: problem }
  return { status: "complete", date, time }
}

export function validateSlot(date: string, time: string, now: Date, hours: ClinicHours): string | null {
  const today = clinicNow(now, hours.timezone)
  const todayIso = toIso(today)
  const latest = toIso(addDays(today, 30))
  if (date < todayIso) {
    return "That date has already passed. Please choose today or a later day."
  }
  if (date > latest) {
    return "Please choose a date within the next 30 days."
  }
  const weekday = fromIso(date).weekday
  const slots = slotsForWeekday(hours, weekday)
  if (slots.length === 0) {
    return `The clinic is closed that day. ${hours.lines.join(" ")}`
  }
  if (time === "morning" || time === "evening") {
    const session = slots.filter((slot) =>
      time === "morning" ? timeToMinutes(slot.start) < 14 * 60 : timeToMinutes(slot.start) >= 16 * 60,
    )
    if (session.length === 0) {
      return `That session is not open that day. ${hours.lines.join(" ")}`
    }
    if (date === todayIso && session.every((slot) => today.minutes >= timeToMinutes(slot.end))) {
      return "That time has already passed today. Please choose a later time."
    }
    return null
  }
  const minutes = timeToMinutes(time)
  const inside = slots.some((slot) => minutes >= timeToMinutes(slot.start) && minutes < timeToMinutes(slot.end))
  if (!inside) {
    return `That time is outside clinic hours. ${hours.lines.join(" ")}`
  }
  if (date === todayIso && minutes <= today.minutes) {
    return "That time has already passed today. Please choose a later time."
  }
  return null
}

export function slotsForWeekday(hours: ClinicHours, weekday: number): TimeSlot[] {
  if (hours.closedWeekdays.includes(weekday)) return []
  if (weekday === 6 && hours.saturdaySlots?.length) return hours.saturdaySlots
  return hours.slots
}

function extractDateAndTime(
  input: string,
  now: Date,
  timeZone: string,
): { date?: string; time?: string; error?: string } {
  const time = extractTime(input)
  if (time.error) return { error: time.error }
  const date = extractDate(time.rest, now, timeZone)
  if (date.error) return { time: time.time, error: date.error }
  return { date: date.date, time: time.time }
}

function extractTime(input: string): { time?: string; rest: string; error?: string } {
  const ampm = input.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i)
  if (ampm) {
    let hour = Number(ampm[1])
    const minute = ampm[2] ? Number(ampm[2]) : 0
    const suffix = ampm[3].toLowerCase()
    if (hour < 1 || hour > 12) {
      return { rest: input, error: "That time doesn't look right. Try 10:30 am or 4:30 pm." }
    }
    if (suffix === "pm" && hour !== 12) hour += 12
    if (suffix === "am" && hour === 12) hour = 0
    return { time: formatHHMM(hour, minute), rest: input.replace(ampm[0], " ") }
  }

  const hm = input.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (hm) {
    return {
      time: formatHHMM(Number(hm[1]), Number(hm[2])),
      rest: input.replace(hm[0], " "),
    }
  }

  if (/\bmorning\b/i.test(input)) {
    return { time: "morning", rest: input.replace(/\bmorning\b/i, " ") }
  }
  if (/\bevening\b/i.test(input)) {
    return { time: "evening", rest: input.replace(/\bevening\b/i, " ") }
  }

  return { rest: input }
}

function extractDate(
  input: string,
  now: Date,
  timeZone: string,
): { date?: string; error?: string } {
  const text = input.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim()
  if (!text || /^(at|on|around|please|the)$/.test(text)) return {}

  const today = clinicNow(now, timeZone)

  if (/\btoday\b/.test(text)) return { date: toIso(today) }
  if (/\bday after tomorrow\b/.test(text)) return { date: toIso(addDays(today, 2)) }
  if (/\btomorrow\b/.test(text)) return { date: toIso(addDays(today, 1)) }

  const nextWeekday = text.match(
    new RegExp(`\\bnext\\s+(${WEEKDAYS.join("|")})\\b`),
  )
  const weekday = text.match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`))
  if (nextWeekday || weekday) {
    const name = (nextWeekday ?? weekday)![1]
    const target = WEEKDAYS.indexOf(name)
    let delta = (target - today.weekday + 7) % 7
    if (nextWeekday && delta === 0) delta = 7
    return { date: toIso(addDays(today, delta)) }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    return dateOrError(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/)
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])
    return dateOrError(year, Number(dmy[2]), Number(dmy[1]))
  }

  const dayMonth = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join("|")})(?:\\s+(\\d{4}))?\\b`),
  )
  if (dayMonth) {
    const year = dayMonth[3] ? Number(dayMonth[3]) : inferYear(today, Number(dayMonth[1]), MONTHS[dayMonth[2]])
    return dateOrError(year, MONTHS[dayMonth[2]], Number(dayMonth[1]))
  }

  const monthDay = text.match(
    new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`),
  )
  if (monthDay) {
    const year = monthDay[3] ? Number(monthDay[3]) : inferYear(today, Number(monthDay[2]), MONTHS[monthDay[1]])
    return dateOrError(year, MONTHS[monthDay[1]], Number(monthDay[2]))
  }

  if (text.replace(/\b(at|on|around|please|the|for|a|an)\b/g, "").trim()) {
    return { error: NEED_BOTH }
  }
  return {}
}

function inferYear(today: CalendarDate, day: number, month: number): number {
  const thisYear = dateOrError(today.year, month, day)
  if (!("error" in thisYear) && thisYear.date && thisYear.date >= toIso(today)) return today.year
  return today.year + 1
}

function dateOrError(year: number, month: number, day: number): { date?: string; error?: string } {
  if (!isRealDate(year, month, day)) {
    return { error: "That date doesn't look valid. Try 2 Nov or 02/11/2026." }
  }
  return { date: toIso({ year, month, day }) }
}
