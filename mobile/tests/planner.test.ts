import assert from "node:assert/strict"
import { test } from "node:test"
import { addDays, formatDay, weekDays, weekdayIndex, weekRangeLabel } from "../src/native/screens/planner/dates.ts"

test("planner weekdays and weeks match the real calendar", () => {
  for (let ms = Date.UTC(2024, 0, 1); ms < Date.UTC(2028, 0, 1); ms += 86_400_000 * 3) {
    const d = new Date(ms)
    const ymd = d.toISOString().slice(0, 10)
    assert.equal(weekdayIndex(ymd), (d.getUTCDay() + 6) % 7, ymd)
  }
  assert.equal(formatDay("2026-11-02"), "Mon, Nov 2")
  assert.deepEqual(weekDays("2026-11-05"), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
  assert.equal(weekRangeLabel("2026-11-08"), "Nov 2 – Nov 8")
  assert.equal(addDays("2026-12-28", 7), "2027-01-04")
  assert.equal(weekDays("2026-12-31")[6], "2027-01-03")
})
