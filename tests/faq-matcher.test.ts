import { describe, expect, it } from "vitest"

import { getClinic } from "@/lib/clinic"
import { matchFaq } from "@/lib/faq"

const clinic = getClinic()

describe("matchFaq", () => {
  it("answers timings, including Sunday closure", () => {
    const match = matchFaq("What time do you open on Sunday?", clinic)
    expect(match?.id).toBe("hours")
    expect(match?.answer).toContain("Sunday")
    expect(match?.answer).toContain("9:30")
  })

  it("answers the fictional address", () => {
    const match = matchFaq("Where is the clinic located?", clinic)
    expect(match?.id).toBe("address")
    expect(match?.answer).toContain("Banga Road")
    expect(match?.answer).toContain("Phagwara")
  })

  it("answers services, including a root canal consultation", () => {
    const match = matchFaq("Do you offer root canal treatment?", clinic)
    expect(match?.id).toBe("services")
    expect(match?.answer.toLowerCase()).toContain("root canal")
  })

  it("uses the fee placeholder instead of inventing prices", () => {
    const match = matchFaq("How much does a cleaning cost?", clinic)
    expect(match?.id).toBe("fees")
    expect(match?.answer).toContain("[Placeholder: consultation and treatment fees go here]")
  })

  it("names the fictional doctors", () => {
    const match = matchFaq("Who are the doctors?", clinic)
    expect(match?.id).toBe("doctors")
    expect(match?.answer).toContain("Simran Kaur")
    expect(match?.answer.toLowerCase()).toContain("fictional")
  })

  it("answers languages and contact", () => {
    expect(matchFaq("Which languages do you speak?", clinic)?.id).toBe("languages")
    expect(matchFaq("How do I reach you on WhatsApp?", clinic)?.id).toBe("contact")
  })

  it("says the clinic is fictional", () => {
    const match = matchFaq("Is this a real clinic?", clinic)
    expect(match?.id).toBe("demo")
    expect(match?.answer.toLowerCase()).toContain("fictional")
  })

  it("explains how to book without starting from a how-question", () => {
    expect(matchFaq("How do I book an appointment?", clinic)?.id).toBe("booking-how")
  })

  it("returns null when nothing in the notes matches", () => {
    expect(matchFaq("asdf qwerty", clinic)).toBeNull()
    expect(matchFaq("hello", clinic)).toBeNull()
    expect(matchFaq("   ", clinic)).toBeNull()
  })
})
