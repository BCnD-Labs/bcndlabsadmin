import assert from "node:assert/strict"
import { test } from "node:test"
import { durationText, formatTime, hourLabel, longDay, monthDay, titleFor, weekdayHeaders, weekdayName } from "../src/native/screens/planner/calendar/format.ts"
import { addMonths, columnsFor, daysInMonth, monthEndKey, monthGrid, monthStartKey, sameMonth, stepBy, weekOf, weekStartKey } from "../src/native/screens/planner/calendar/grid.ts"

// 2026-11-04 is a Wednesday; 2026-11-01 a Sunday.
test("weekOf runs Sunday to Saturday or Monday to Sunday, including across a month and a year", () => {
  assert.deepEqual(weekOf("2026-11-04", 0), ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"])
  assert.deepEqual(weekOf("2026-11-04", 1), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
  // A Sunday belongs to the week that starts the day itself (Sunday start) or the Monday before (Monday start).
  assert.equal(weekStartKey("2026-11-01", 0), "2026-11-01")
  assert.equal(weekStartKey("2026-11-01", 1), "2026-10-26")
  assert.deepEqual(weekOf("2026-12-31", 0).slice(0, 1).concat(weekOf("2026-12-31", 0).slice(-1)), ["2026-12-27", "2027-01-02"])
})

test("weekOf and monthGrid never throw on a broken key", () => {
  assert.equal(weekOf("nope", 0).length, 7)
  assert.equal(weekStartKey("2026-13-45", 1), "2026-13-45")
})

test("daysInMonth knows leap years and the century rules", () => {
  assert.deepEqual([2024, 2026, 2028, 1900, 2000].map((y) => daysInMonth(y, 2)), [29, 28, 29, 28, 29])
  assert.deepEqual([1, 4, 6, 9, 11, 12].map((m) => daysInMonth(2026, m)), [31, 30, 30, 30, 30, 31])
  assert.equal(monthEndKey("2028-02-10"), "2028-02-29")
  assert.equal(monthStartKey("2028-02-10"), "2028-02-01")
})

test("addMonths clamps to the shorter month and crosses years both ways", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28")
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29")
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28")
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15")
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15")
  assert.equal(addMonths("2026-11-04", 14), "2028-01-04")
  assert.equal(addMonths("2026-11-04", -23), "2024-12-04")
})

test("monthGrid is whole weeks: 4 rows for a Sunday-start February that begins on Sunday", () => {
  const g = monthGrid("2026-02-14", 0)
  assert.equal(g.length, 4)
  assert.equal(g[0][0], "2026-02-01")
  assert.equal(g[3][6], "2026-02-28")
})

test("monthGrid row counts for odd months, a leap February and both week starts", () => {
  const rows = (key: string, ws: 0 | 1) => monthGrid(key, ws).length
  assert.equal(rows("2026-02-14", 1), 5) // Feb 2026 starts Sunday: Monday-start needs the Monday before
  assert.equal(rows("2028-02-10", 0), 5) // leap February starting Tuesday
  assert.equal(rows("2028-02-10", 1), 5)
  assert.equal(rows("2026-11-04", 0), 5) // Nov 2026 starts Sunday, 30 days
  assert.equal(rows("2026-11-04", 1), 6)
  assert.equal(rows("2026-08-04", 0), 6) // Aug 2026 starts Saturday, 31 days
  assert.equal(rows("2026-08-04", 1), 6)
  assert.equal(rows("2026-04-01", 0), 5)
})

test("monthGrid starts on the week start, ends on the week end, is gapless and holds every day of the month", () => {
  for (const key of ["2026-02-14", "2028-02-29", "2026-11-04", "2026-08-31", "2027-01-01", "1999-12-31"]) {
    for (const ws of [0, 1] as const) {
      const g = monthGrid(key, ws)
      const flat = g.flat()
      assert.ok(g.length >= 4 && g.length <= 6, `${key} ${ws} rows`)
      assert.ok(g.every((r) => r.length === 7))
      assert.equal(weekdayName(flat[0]), ws === 0 ? "Sunday" : "Monday")
      assert.equal(weekdayName(flat[flat.length - 1]), ws === 0 ? "Saturday" : "Sunday")
      const inMonth = flat.filter((d) => sameMonth(d, key))
      assert.equal(inMonth.length, daysInMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7))))
      assert.ok(flat.includes(monthStartKey(key)) && flat.includes(monthEndKey(key)))
      // No missing or repeated days: consecutive keys differ by exactly one day.
      for (let i = 1; i < flat.length; i++) assert.equal(weekOf(flat[i - 1], ws).includes(flat[i]) || weekStartKey(flat[i], ws) === flat[i], true)
      // The first week contains the 1st, and the last row contains the final day (no empty trailing week).
      assert.ok(g[0].includes(monthStartKey(key)))
      assert.ok(g[g.length - 1].includes(monthEndKey(key)))
    }
  }
})

test("stepBy moves a day, a week or a month; columnsFor lays out one or seven days", () => {
  assert.equal(stepBy("day", "2026-11-04", 1), "2026-11-05")
  assert.equal(stepBy("day", "2026-12-31", 1), "2027-01-01")
  assert.equal(stepBy("week", "2026-11-04", -1), "2026-10-28")
  assert.equal(stepBy("month", "2026-01-31", 1), "2026-02-28")
  assert.deepEqual(columnsFor("day", "2026-11-04", 1), ["2026-11-04"])
  assert.equal(columnsFor("week", "2026-11-04", 1)[0], "2026-11-02")
  assert.equal(columnsFor("month", "2026-11-04", 0).length, 7)
})

test("labels come from the key, not the phone", () => {
  assert.equal(weekdayName("2024-02-29"), "Thursday")
  assert.equal(monthDay("2026-11-04"), "Nov 4")
  assert.equal(longDay("2026-11-04"), "Wednesday, November 4")
  assert.deepEqual(weekdayHeaders(0), ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"])
  assert.deepEqual(weekdayHeaders(1), ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"])
  assert.equal(titleFor("month", "2026-11-04", []), "November 2026")
  assert.equal(titleFor("day", "2026-11-04", []), "Wednesday, Nov 4")
  assert.equal(titleFor("week", "2026-11-04", weekOf("2026-11-04", 0)), "Nov 1 – Nov 7, 2026")
  assert.equal(titleFor("week", "2026-12-30", weekOf("2026-12-30", 0)), "Dec 27 – Jan 2, 2027")
})

test("12-hour and 24-hour time", () => {
  assert.deepEqual(["00:00", "00:05", "09:30", "12:00", "12:45", "13:00", "23:59"].map((t) => formatTime(t, "12h")), ["12:00 AM", "12:05 AM", "9:30 AM", "12:00 PM", "12:45 PM", "1:00 PM", "11:59 PM"])
  assert.equal(formatTime("09:30", "24h"), "09:30")
  assert.equal(formatTime("soon", "12h"), "soon")
  assert.deepEqual([0, 9, 12, 15, 24].map((h) => hourLabel(h, "12h")), ["12 AM", "9 AM", "12 PM", "3 PM", "12 AM"])
  assert.deepEqual([0, 9, 15].map((h) => hourLabel(h, "24h")), ["00:00", "09:00", "15:00"])
  assert.deepEqual([45, 60, 90, 120].map(durationText), ["45 min", "1 h", "1 h 30 min", "2 h"])
})
