import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import { saveJournalItem } from "../shared/records.ts"
import { SLOTS, nextPeriod, periodStart, readSlotCheckIn, reviewId, slotForm, writeSlotCheckIn } from "../shared/journal-review.ts"

test("review periods start on the same day on every device (weeks run Monday to Sunday)", () => {
  assert.equal(periodStart("weekly", "2026-11-08"), "2026-11-02", "a Sunday belongs to the week that began Monday")
  assert.equal(periodStart("weekly", "2026-11-09"), "2026-11-09")
  assert.equal(periodStart("monthly", "2026-11-20"), "2026-11-01")
  assert.equal(periodStart("yearly", "2026-11-20"), "2026-01-01")
  assert.equal(nextPeriod("monthly", "2026-12-01", 1), "2027-01-01")
  assert.equal(reviewId("daily", "2026-11-08", "morning"), "journal-daily-2026-11-08-morning")
})

test("a check-in saved as text reads back, and saving it keeps a valid workspace", () => {
  const answers = { mood: "4", energy: "3", plan: "Learning, Exercise", note: "Slow start" }
  const text = writeSlotCheckIn("morning", answers)
  assert.deepEqual(readSlotCheckIn("morning", text), answers)
  const now = "2026-11-08T12:00:00Z"
  const data = saveJournalItem(emptyWorkspace(), "2026-11-08", { id: reviewId("daily", "2026-11-08", "morning"), text, createdAt: now, updatedAt: now })
  assert.ok(validWorkspace(JSON.parse(JSON.stringify(data))))
  assert.equal(data.journal[0].entries![0].text, text)
  assert.equal(SLOTS.length, 3)
  assert.ok(slotForm("evening").length > 5)
})
