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
