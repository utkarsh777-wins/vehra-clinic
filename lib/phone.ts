export type PhoneResult =
  | { ok: true; national: string; e164: string; display: string }
  | { ok: false; error: string }

const INVALID =
  "That doesn't look like an Indian mobile number. Use 10 digits starting with 6, 7, 8, or 9. You can include +91."

export function parseIndianMobile(input: string): PhoneResult {
  let digits = input.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { ok: false, error: INVALID }
  }
  return {
    ok: true,
    national: digits,
    e164: `+91${digits}`,
    display: `${digits.slice(0, 5)} ${digits.slice(5)}`,
  }
}
