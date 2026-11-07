import assert from "node:assert/strict"
import test from "node:test"
import { hasCheckIn, nextPeriod, periodStart, readCheckIn, reviewId, writeCheckIn } from "../src/native/screens/journal-review.ts"

test("review periods anchor and step across year boundaries", () => {
  assert.equal(periodStart("weekly", "2026-01-01"), "2025-12-29")
  assert.equal(nextPeriod("weekly", "2025-12-29", 1), "2026-01-05")
  assert.equal(nextPeriod("monthly", "2026-01-01", -1), "2025-12-01")
  assert.equal(nextPeriod("yearly", "2025-01-01", 1), "2026-01-01")
  assert.equal(reviewId("weekly", "2025-12-29"), "journal-weekly-2025-12-29")
})

test("one-word and checkbox answers save as readable text and can be edited", () => {
  const form = { mood: "Okay", energy: "", win: "Study", hard: "", grateful: "", checks: ["Learned", "Rested"], notes: "An optional longer thought.\nSecond line." }
  assert.equal(hasCheckIn(form), true)
  const text = writeCheckIn("daily", form)
  assert.match(text, /- \[x\] Learned/)
  assert.deepEqual(readCheckIn(text), form)
  assert.equal(hasCheckIn({ mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }), false)
})

import { CHECKS, CHECK_LABELS, SLOTS, checkInSummary, formWording, slotForHour } from "../src/native/screens/journal-review.ts"

test("a day has morning, afternoon and evening check-ins with their own ids", () => {
  assert.deepEqual(SLOTS.map(s => s.key), ["morning", "afternoon", "evening"])
  assert.equal(reviewId("daily", "2026-11-07", "morning"), "journal-daily-2026-11-07-morning")
  assert.equal(reviewId("daily", "2026-11-07"), "journal-daily-2026-11-07")
  const ids = SLOTS.map(s => reviewId("daily", "2026-11-07", s.key))
  assert.equal(new Set([...ids, reviewId("daily", "2026-11-07")]).size, 4)
  assert.deepEqual([0, 11, 12, 16, 17, 23].map(slotForHour), ["morning", "morning", "afternoon", "afternoon", "evening", "evening"])
})

test("each check-in saves under its own wording and reads back into the same fields", () => {
  const form = { mood: "Great", energy: "High", win: "Ship the PR", hard: "A long meeting", grateful: "Coffee", checks: ["Rested"], notes: "More later." }
  for (const slot of ["morning", "afternoon", "evening"] as const) {
    const text = writeCheckIn("daily", form, slot)
    assert.match(text, new RegExp(`^## ${slot[0].toUpperCase()}${slot.slice(1)} check-in`))
    assert.deepEqual(readCheckIn(text), form)
  }
  assert.match(writeCheckIn("daily", form, "morning"), /Focus: Ship the PR/)
  assert.match(writeCheckIn("daily", form, "afternoon"), /Stuck on: A long meeting/)
  assert.match(writeCheckIn("daily", form, "evening"), /Grateful: Coffee/)
  // Entries written before slots existed still open.
  assert.deepEqual(readCheckIn("## Daily check-in\nMood: Okay\nWin: Study\n- [x] Learned"), { mood: "Okay", energy: "", win: "Study", hard: "", grateful: "", checks: ["Learned"], notes: "" })
})

test("form wording is plain, per slot, and every saved check has a readable label", () => {
  assert.equal(formWording("daily", "morning").title, "Morning check-in")
  assert.equal(formWording("daily", "evening").save, "Save evening check-in")
  assert.equal(formWording("weekly").title, "Weekly review")
  assert.equal(formWording("daily", "morning").mood, "How are you feeling this morning?")
  for (const period of ["daily", "weekly", "monthly", "yearly"] as const) for (const p of formWording(period).prompts) assert.ok(p.question.endsWith("?"))
  for (const check of CHECKS) assert.ok(CHECK_LABELS[check])
  assert.ok(!JSON.stringify(formWording("daily", "evening")).includes("How did it feel"))
})

test("check-in summary shows mood, energy, ticks and the first thing written", () => {
  assert.equal(checkInSummary({ mood: "Okay", energy: "High", win: "", hard: "  Long\nmeeting ", grateful: "", checks: ["Rested", "Moved"], notes: "" }), "Okay · High energy · 2 ticked · Long meeting")
  assert.equal(checkInSummary({ mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }), "")
})
