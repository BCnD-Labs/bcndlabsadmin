import assert from "node:assert/strict"
import { test } from "node:test"
import { averagePerDay, doneCounts, heatCells, heatLevel, lastDays, localKey, percent, streak, taskBalance, weekDays } from "../src/native/kit/stats.ts"

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
const done = (y: number, m: number, d: number, extra: object = {}) => ({ done: true, completedAt: at(y, m, d), ...extra })

test("localKey uses the phone's calendar day, not UTC", () => {
  assert.equal(localKey(at(2026, 11, 7, 23)), "2026-11-07")
  assert.equal(localKey(at(2026, 11, 7, 0)), "2026-11-07")
  assert.equal(localKey("nope"), undefined)
  assert.equal(localKey(undefined), undefined)
})

test("lastDays ends on today and weekDays runs Monday to Sunday", () => {
  assert.deepEqual(lastDays("2026-11-07", 3), ["2026-11-05", "2026-11-06", "2026-11-07"])
  assert.deepEqual(weekDays("2026-11-07"), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
  assert.equal(weekDays("2026-11-02")[0], "2026-11-02")
  assert.equal(weekDays("2026-11-08")[0], "2026-11-02")
})

test("doneCounts counts completed tasks per day and ignores events, open tasks and bad stamps", () => {
  const tasks = [done(2026, 11, 2), done(2026, 11, 2), done(2026, 11, 4), done(2026, 11, 4, { kind: "event" }), { done: false, completedAt: at(2026, 11, 4) }, { done: true, completedAt: "bad" }]
  assert.deepEqual(doneCounts(tasks, weekDays("2026-11-07")), [2, 0, 1, 0, 0, 0, 0])
})

test("streak counts back from today, or from yesterday while today is empty", () => {
  const tasks = [done(2026, 11, 7), done(2026, 11, 6), done(2026, 11, 5), done(2026, 11, 3)]
  assert.equal(streak(tasks, "2026-11-07").length, 3)
  assert.equal(streak(tasks.slice(1), "2026-11-07").length, 2)
  assert.equal(streak([], "2026-11-07").length, 0)
  assert.deepEqual(streak(tasks, "2026-11-07").last7, [false, false, true, false, true, true, true])
})

test("heatCells covers whole Monday-first weeks and marks days after today", () => {
  const cells = heatCells([done(2026, 11, 2), done(2026, 11, 2), done(2026, 11, 2), done(2026, 11, 2), done(2026, 11, 2)], "2026-11-07", 5)
  assert.equal(cells.length, 35)
  assert.equal(cells[0].key, "2026-10-05")
  assert.equal(cells[34].key, "2026-11-08")
  assert.equal(cells[34].future, true)
  assert.equal(cells[33].today, true)
  const monday = cells.find(c => c.key === "2026-11-02")!
  assert.equal(monday.count, 5)
  assert.equal(monday.level, 4)
})

test("heat levels stop at four", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(heatLevel), [0, 1, 2, 3, 4, 4])
})

test("taskBalance splits done, open and overdue without double counting", () => {
  const tasks = [{ done: true }, { done: true }, { done: false, due: "2026-11-01" }, { done: false, due: "2026-11-09" }, { done: false }, { done: false, kind: "event", due: "2026-11-01" }]
  assert.deepEqual(taskBalance(tasks, "2026-11-07"), { done: 2, open: 2, overdue: 1, total: 5, completePct: 40 })
  assert.deepEqual(taskBalance([], "2026-11-07"), { done: 0, open: 0, overdue: 0, total: 0, completePct: 0 })
})

test("averagePerDay and percent never divide by zero or overflow", () => {
  assert.equal(averagePerDay([2, 1, 3, 0, 2, 1, 0], 6), 1.5)
  assert.equal(averagePerDay([], 0), 0)
  assert.equal(percent(0.625), 63)
  assert.equal(percent(2), 100)
  assert.equal(percent(NaN), 0)
})

test("dateParts gives a month abbreviation and a two-digit day", async () => {
  const { dateParts } = await import("../src/native/kit/stats.ts")
  assert.deepEqual(dateParts("2026-11-09"), { month: "NOV", day: "09" })
  assert.deepEqual(dateParts("2026-01-31"), { month: "JAN", day: "31" })
  assert.deepEqual(dateParts("garbage"), { month: "", day: "" })
})
