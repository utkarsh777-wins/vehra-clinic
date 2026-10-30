import { describe, expect, it } from "vitest"

import { parseIndianMobile } from "@/lib/phone"

describe("parseIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["91-98765-43210", "9876543210"],
    ["09876543210", "9876543210"],
    ["  +91 (98765) 43210 ", "9876543210"],
    ["6123456789", "6123456789"],
  ])("accepts %s", (input, national) => {
    const result = parseIndianMobile(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.national).toBe(national)
      expect(result.e164).toBe(`+91${national}`)
      expect(result.display).toBe(`${national.slice(0, 5)} ${national.slice(5)}`)
    }
  })

  it.each(["12345", "5876543210", "1234567890", "98765abc10", "0000000000", "910000000000", "987654321", "987654321011"])(
    "rejects %s",
    (input) => {
      const result = parseIndianMobile(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/10 digits/)
    },
  )
})
