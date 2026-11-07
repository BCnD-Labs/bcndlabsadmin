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

import { CHECKS, CHECK_LABELS, SLOTS, checkInSummary, formWording, hasAnswers, readSlotCheckIn, slotForHour, slotForm, slotSummary, toggleTick, writeSlotCheckIn } from "../src/native/screens/journal-review.ts"

test("a day has morning, afternoon and evening check-ins with their own ids", () => {
  assert.deepEqual(SLOTS.map(s => s.key), ["morning", "afternoon", "evening"])
  assert.equal(reviewId("daily", "2026-11-07", "morning"), "journal-daily-2026-11-07-morning")
  assert.equal(reviewId("daily", "2026-11-07"), "journal-daily-2026-11-07")
  const ids = SLOTS.map(s => reviewId("daily", "2026-11-07", s.key))
  assert.equal(new Set([...ids, reviewId("daily", "2026-11-07")]).size, 4)
  assert.deepEqual([0, 11, 12, 16, 17, 23].map(slotForHour), ["morning", "morning", "afternoon", "afternoon", "evening", "evening"])
})

test("the three forms are taps: scales, picks and ticks, with at most one optional typed line", () => {
  for (const slot of ["morning", "afternoon", "evening"] as const) {
    const fields = slotForm(slot, ["Finish report"])
    assert.ok(fields.length >= 5, slot)
    assert.equal(fields.filter(f => f.kind === "text").length, 1)
    assert.equal(fields.at(-1)!.kind, "text")
    assert.ok(fields.filter(f => f.kind !== "text").length >= 5)
    assert.equal(new Set(fields.map(f => f.id)).size, fields.length)
    assert.equal(new Set(fields.map(f => f.label)).size, fields.length)
    for (const f of fields) {
      assert.ok(f.question.endsWith("?"), f.question)
      if (f.kind === "scale") assert.ok(f.low && f.high)
      if (f.kind === "pick" || f.kind === "tick") assert.ok(f.options!.length >= 2 || f.fromTasks)
    }
    assert.equal(fields.filter(f => f.kind === "scale" && f.id !== "mood" && f.id !== "energy").length > 0 || slot === "morning", true)
  }
  assert.ok(slotForm("morning").every(f => f.id !== "focus"), "no task choices when nothing is due")
  assert.deepEqual(slotForm("morning", ["A", "B"]).find(f => f.id === "focus")!.options, ["A", "B"])
})

test("answers save as readable lines and read back the same, per check-in", () => {
  const morning = { mood: "4", energy: "3", sleep: "5", plan: "Learning, Exercise", focus: "Finish report", note: "Long day ahead" }
  const text = writeSlotCheckIn("morning", morning)
  assert.equal(text.split("\n")[0], "## Morning check-in")
  assert.match(text, /^Mood: 4\/5$/m)
  assert.match(text, /^Plan: Learning, Exercise$/m)
  assert.match(text, /^Top priority: Finish report$/m)
  assert.deepEqual(readSlotCheckIn("morning", text), morning)
  const evening = { mood: "2", energy: "1", overall: "3", stress: "5", goal: "Partly", done: "Rested", blocked: "Tired, Distractions", grateful: "Health" }
  assert.deepEqual(readSlotCheckIn("evening", writeSlotCheckIn("evening", evening)), evening)
  // Blank answers are not written; unknown or out-of-range lines are ignored.
  assert.equal(writeSlotCheckIn("afternoon", { mood: "", pace: "  " }), "## Afternoon check-in")
  assert.deepEqual(readSlotCheckIn("afternoon", "## Afternoon check-in\nMood: 9/5\nPace: Behind\nWho knows: x"), { pace: "Behind" })
  assert.equal(hasAnswers({ mood: "", pace: " " }), false)
  assert.equal(hasAnswers({ pace: "Behind" }), true)
})

test("ticks toggle in order and the list summary stays short", () => {
  assert.equal(toggleTick(undefined, "Rested"), "Rested")
  assert.equal(toggleTick("Rested", "Tired"), "Rested, Tired")
  assert.equal(toggleTick("Rested, Tired", "Rested"), "Tired")
  assert.equal(toggleTick("Tired", "Tired"), "")
  assert.equal(slotSummary("morning", { mood: "4", energy: "3", plan: "Learning, Exercise", focus: "Finish report" }), "Mood 4/5 · Energy 3/5 · 2 ticked · Finish report")
  assert.equal(slotSummary("evening", {}), "")
})

test("review wording is plain and every saved check has a readable label", () => {
  assert.equal(formWording("weekly").title, "Weekly review")
  assert.equal(formWording("daily").title, "Earlier check-in")
  for (const period of ["daily", "weekly", "monthly", "yearly"] as const) for (const p of formWording(period).prompts) assert.ok(p.question.endsWith("?"))
  for (const check of CHECKS) assert.ok(CHECK_LABELS[check])
  assert.equal(checkInSummary({ mood: "Okay", energy: "High", win: "", hard: "  Long\nmeeting ", grateful: "", checks: ["Rested", "Moved"], notes: "" }), "Okay · High energy · 2 ticked · Long meeting")
  assert.equal(checkInSummary({ mood: "", energy: "", win: "", hard: "", grateful: "", checks: [], notes: "" }), "")
})
