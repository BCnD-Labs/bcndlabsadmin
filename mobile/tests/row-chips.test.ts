import assert from "node:assert/strict"
import { test } from "node:test"
import type { PlannerRow } from "../src/native/screens/planner/rows.ts"
import { eventChips, taskChips } from "../src/native/screens/row-chips.ts"

const row = (over: Partial<PlannerRow> = {}): PlannerRow => ({ id: "t1", title: "Read ch 4", starred: false, done: false, overdue: false, dueText: "No date", focused: false, ...over })

test("a task with nothing set has no chips", () => {
  assert.deepEqual(taskChips(row()), [])
})

test("due date, time, course, focus and star each get a chip, in that order", () => {
  const chips = taskChips(row({ dueText: "Nov 4", time: "18:30", course: "Speech", focused: true, starred: true }))
  assert.deepEqual(chips.map((c) => [c.key, c.label, c.kind]), [["due", "Nov 4 · 18:30", "date"], ["course", "Speech", "course"], ["focus", "Focus", "focus"], ["star", "Starred", "star"]])
})

test("an overdue open task is red; a done one is not, and done tasks drop focus and star", () => {
  assert.equal(taskChips(row({ dueText: "Overdue · Oct 31", overdue: true }))[0].kind, "overdue")
  const done = taskChips(row({ dueText: "Oct 31", overdue: true, done: true, focused: true, starred: true }))
  assert.deepEqual(done.map((c) => [c.key, c.kind]), [["due", "date"]])
})

test("a time without a date still shows", () => {
  assert.deepEqual(taskChips(row({ time: "09:00" })).map((c) => c.label), ["09:00"])
})

test("event chips show the date and the start time when set", () => {
  assert.deepEqual(eventChips("2026-11-29", "10:15").map((c) => c.label), ["Nov 29", "10:15"])
  assert.deepEqual(eventChips("2026-11-29").map((c) => c.label), ["Nov 29"])
  assert.deepEqual(eventChips(), [])
})
