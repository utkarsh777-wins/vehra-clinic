import raw from "@/content/clinic.json"
import { brand } from "@/theme/brand"

export type TimeSlot = { start: string; end: string }

export type ClinicHours = {
  timezone: string
  closedWeekdays: number[]
  slots: TimeSlot[]
  saturdaySlots?: TimeSlot[]
  lines: string[]
}

export type ClinicContent = {
  name: string
  shortName: string
  demoLabel: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  map: {
    label: string
    lat: number
    lng: number
    bbox: [number, number, number, number]
  }
  contact: {
    phoneDisplay: string
    whatsappNumber: string
    email: string
  }
  languages: string[]
  hours: ClinicHours
  services: { name: string; summary: string }[]
  doctors: {
    name: string
    qualification: string
    role: string
    days: string
    fictional: true
  }[]
  feesNote: string
  why: { title: string; body: string }[]
  placeholders: { reviews: string; stats: string }
  faqs: { id: string; question: string; answer: string; keywords: string[] }[]
}

function assertClinic(value: ClinicContent): void {
  if (!value.faqs?.length) {
    throw new Error("content/clinic.json is missing faqs")
  }
  if (!value.hours?.slots?.length) {
    throw new Error("content/clinic.json is missing hours.slots")
  }
  if (!value.address?.city) {
    throw new Error("content/clinic.json is missing an address")
  }
}

export function getClinic(): ClinicContent {
  const clinic: ClinicContent = {
    ...(raw as Omit<ClinicContent, "name" | "shortName" | "demoLabel">),
    name: brand.name,
    shortName: brand.shortName,
    demoLabel: brand.demoLabel,
  }
  assertClinic(clinic)
  return clinic
}

/** Knowledge payload for the assistant, with the public WhatsApp number applied. */
export function getPublicClinic(): ClinicContent {
  const clinic = getClinic()
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim()
  if (!fromEnv) return clinic
  const digits = fromEnv.replace(/\D/g, "")
  return {
    ...clinic,
    contact: { ...clinic.contact, whatsappNumber: digits || clinic.contact.whatsappNumber },
  }
}

export function formatAddress(clinic: ClinicContent): string {
  const { line1, line2, city, state, postalCode } = clinic.address
  return `${line1}, ${line2}, ${city}, ${state} ${postalCode}`
}

export function osmEmbedUrl(clinic: ClinicContent): string {
  const [west, south, east, north] = clinic.map.bbox
  const { lat, lng } = clinic.map
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${west},${south},${east},${north}`)}&layer=mapnik&marker=${lat}%2C${lng}`
}

export function osmLink(clinic: ClinicContent): string {
  const { lat, lng } = clinic.map
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`
}

export function whatsappHref(clinic: ClinicContent): string {
  const text = encodeURIComponent(
    `Hello ${clinic.shortName}, I would like to ask about an appointment.`,
  )
  return `https://wa.me/${clinic.contact.whatsappNumber}?text=${text}`
}
