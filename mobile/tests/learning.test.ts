import assert from "node:assert/strict"
import { test } from "node:test"
import { groupAgenda } from "../src/native/screens/learning/agenda.ts"
import { addDays, dayNumber, fromDayNumber } from "../src/native/screens/learning/dates.ts"
import { SAMPLE_COURSEWORK, SAMPLE_TODAY } from "../src/native/sample.ts"

test("day numbers match the real calendar across leap years and month ends", () => {
  for (let ms = Date.UTC(2023, 0, 1); ms <= Date.UTC(2029, 0, 1); ms += 86_400_000 * 7 + 86_400_000) {
    const d = new Date(ms)
    const ymd = d.toISOString().slice(0, 10)
    assert.equal(dayNumber(ymd), Math.round(ms / 86_400_000), ymd)
    assert.equal(fromDayNumber(dayNumber(ymd)), ymd)
  }
  assert.equal(addDays("2026-12-30", 3), "2027-01-02")
  assert.equal(addDays("2028-02-28", 1), "2028-02-29")
  assert.equal(addDays("2026-11-02", -2), "2026-10-31")
})

test("agenda groups: overdue, this week (today through +7), later, done", () => {
  const agenda = groupAgenda(SAMPLE_COURSEWORK, SAMPLE_TODAY, (w) => w.done)
  assert.deepEqual(agenda.done.map((w) => w.id).sort(), ["w6", "w7"])
  assert.equal(agenda.overdue.length, 0)
  assert.deepEqual(agenda.thisWeek.map((w) => w.id), ["w5", "w1", "w3", "w2"]) // Nov 3, 4, 5, 9
  assert.deepEqual(agenda.later.map((w) => w.id), ["w4"]) // Nov 12
  const marked = groupAgenda(SAMPLE_COURSEWORK, SAMPLE_TODAY, (w) => w.done || w.id === "w5")
  assert.ok(marked.done.some((w) => w.id === "w5"))
  assert.ok(!marked.thisWeek.some((w) => w.id === "w5"))
  const lateView = groupAgenda(SAMPLE_COURSEWORK, "2026-11-20", (w) => w.done)
  assert.equal(lateView.overdue.length, 5)
})
