import { describe, expect, it } from "vitest"

import { handleTurn, initialSession, isBookingRequest, parseName, parseReason } from "@/lib/booking"
import { getClinic } from "@/lib/clinic"

const clinic = getClinic()
const now = new Date("2026-10-29T04:30:00.000Z")

function say(message: string, session: unknown = initialSession(), intent?: "start_booking") {
  return handleTurn({ message, session, clinic, now, intent })
}

describe("booking validation", () => {
  it("accepts a person's name and rejects a number", () => {
    expect(parseName("  Ada   Kaur ").ok && parseName("  Ada   Kaur ")).toMatchObject({ ok: true, name: "Ada Kaur" })
    expect(parseName("A").ok).toBe(false)
    expect(parseName("98765").ok).toBe(false)
  })

  it("requires a short reason", () => {
    expect(parseReason("ok").ok).toBe(false)
    expect(parseReason("Check-up").ok).toBe(true)
    expect(parseReason("x".repeat(121)).ok).toBe(false)
    expect(parseReason("skip")).toMatchObject({ ok: true, reason: "" })
  })

  it("treats a direct request as booking and a how-question as not", () => {
    expect(isBookingRequest("I want to book an appointment")).toBe(true)
    expect(isBookingRequest("book")).toBe(true)
    expect(isBookingRequest("How do I book an appointment?")).toBe(false)
  })
})

describe("scripted booking flow", () => {
  it("collects details, rejects bad values, and confirms before a pending request", () => {
    let turn = say("", initialSession(), "start_booking")
    expect(turn.session.step).toBe("name")
    expect(turn.reply).toMatch(/name/i)

    turn = say("98765", turn.session)
    expect(turn.session.step).toBe("name")

    turn = say("Ada Kaur", turn.session)
    expect(turn.session.step).toBe("phone")

    turn = say("12345", turn.session)
    expect(turn.session.step).toBe("phone")
    expect(turn.reply).toMatch(/10 digits/)

    turn = say("+91 98765 43210", turn.session)
    expect(turn.session.step).toBe("when")
    expect(turn.session.draft.phone).toBe("9876543210")

    turn = say("tomorrow", turn.session)
    expect(turn.session.step).toBe("when")
    expect(turn.session.draft.date).toBe("2026-10-30")
    expect(turn.reply).toMatch(/time/i)

    turn = say("2:30 pm", turn.session)
    expect(turn.reply).toMatch(/outside clinic hours/i)

    turn = say("sunday 10:30 am", turn.session)
    expect(turn.reply).toMatch(/closed/i)

    turn = say("2 Nov 2026 10:30 am", turn.session)
    expect(turn.session.step).toBe("reason")
    expect(turn.session.draft.date).toBe("2026-11-02")
    expect(turn.session.draft.time).toBe("10:30")

    turn = say("ok", turn.session)
    expect(turn.session.step).toBe("reason")

    turn = say("Tooth check-up", turn.session)
    expect(turn.session.step).toBe("confirm")
    expect(turn.reply).toContain("Ada Kaur")
    expect(turn.reply).toContain("98765 43210")
    expect(turn.reply).toContain("Tooth check-up")
    expect(turn.pending).toBeUndefined()

    const confirmed = say("yes", turn.session)
    expect(confirmed.pending).toEqual({
      name: "Ada Kaur",
      phone: "9876543210",
      date: "2026-11-02",
      time: "10:30",
      reason: "Tooth check-up",
    })
    expect(confirmed.session.mode).toBe("faq")
    expect(confirmed.reply).toMatch(/Request received, not yet confirmed/)
  })

  it("answers a side question and then repeats the current question", () => {
    const started = say("book an appointment")
    const turn = say("what time do you open?", started.session)
    expect(turn.session.step).toBe("name")
    expect(turn.reply).toContain("Sunday")
    expect(turn.reply).toMatch(/name/i)
    expect(turn.llmEligible).toBe(true)
  })

  it("lets someone change the phone number from the confirmation", () => {
    let turn = say("I want to book an appointment")
    turn = say("Ada Kaur", turn.session)
    turn = say("9876543210", turn.session)
    turn = say("2 Nov 2026 4:30 pm", turn.session)
    turn = say("Follow-up", turn.session)
    expect(turn.session.step).toBe("confirm")

    turn = say("change the phone", turn.session)
    expect(turn.session.step).toBe("phone")
    turn = say("9123456789", turn.session)
    expect(turn.session.step).toBe("confirm")
    expect(turn.reply).toContain("91234 56789")
  })

  it("cancels back to questions", () => {
    const started = say("book")
    const turn = say("cancel", started.session)
    expect(turn.session).toEqual(initialSession())
    expect(turn.reply).toMatch(/Cancelled/)
  })

  it("rejects a past date and a time that has already passed today", () => {
    let turn = say("appointment")
    turn = say("Ada Kaur", turn.session)
    turn = say("9876543210", turn.session)
    expect(say("1 Oct 2026 10:00 am", turn.session).reply).toMatch(/already passed/)
    expect(say("today 10:00 am", turn.session).reply).toMatch(/already passed today/)
  })
})
