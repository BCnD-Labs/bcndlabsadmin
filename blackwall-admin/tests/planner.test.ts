import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, mergeWorkspace, validWorkspace } from "../shared/workspace.ts"
import { validDateKey } from "../shared/planner.ts"
import { chipOverflow, dayDots, isAllDayOn, isDeadlineOn, isEndOfDay, isTimedOn, startTimeOn, taskSlot, taskOnDate, timedLanes } from "../src/features/productivity/planner-utils.ts"
import type { Task } from "../src/lib/types.ts"
const timestamp = "2026-11-02T14:42:00Z"
const task = (patch: Partial<Task> = {}): Task => ({ id: "a", title: "A task", done: false, starred: false, createdAt: timestamp, updatedAt: timestamp, ...patch })
const validTask = (value: unknown) => validWorkspace({ ...emptyWorkspace(), tasks: [value] })

test("standalone calendar events are additive and require their own scheduled date", () => {
  const legacy = task({ due: "2026-11-03", learningType: "event" })
  assert.ok(validTask(JSON.parse(JSON.stringify(legacy))))
  const event = task({ kind: "event", scheduledDate: "2026-11-03", scheduledTime: "10:00", durationMinutes: 45, links: [{ label: "Call", url: "https://example.com" }] })
  assert.ok(validTask(JSON.parse(JSON.stringify(event))))
  assert.equal(event.due, undefined)
  assert.ok(!validTask({ ...event, scheduledDate: undefined }))
  assert.ok(!validTask({ ...event, scheduledDate: "2026-02-30" }))
  assert.ok(!validTask({ ...legacy, kind: "appointment" }))
})

test("legacy tasks remain valid; scheduling preserves independent deadlines", () => {
  assert.ok(validTask(task()))
  const value = task({ due: "2026-11-06", time: "10:00", scheduledDate: "2026-11-02", scheduledTime: "14:00" })
  assert.ok(validTask(value))
  assert.deepEqual(taskSlot(value), { date: "2026-11-02", time: "14:00" })
  assert.ok(taskOnDate(value, "2026-11-06"))
  assert.ok(taskOnDate(value, "2026-11-02"))
  assert.equal(value.due, "2026-11-06")
  assert.deepEqual(taskSlot(task({ due: "2026-11-06", time: "10:00" })), { date: "2026-11-06", time: "10:00" })
})
test("plain reflection and opt-in custom fields survive workspace serialization", () => {
  for (const items of [{}, { timeSpent: "42 min", difficulty: "Quite tricky", nextTime: "Draw the blocks" }]) {
    const value = task({ reflection: { text: "Needed help", items, updatedAt: timestamp }, recordLinks: [{ kind: "note", id: "n1" }, { kind: "log", id: "2026-11-02" }] })
    assert.ok(validTask(JSON.parse(JSON.stringify(value))))
    assert.equal(value.done, false, "writing never marks the task complete")
  }
})
test("malformed reflection, links and schedule fields are rejected", () => {
  const malformed = [
    { reflection: { text: "note", items: [], updatedAt: timestamp } },
    { reflection: { text: "note", items: { difficulty: 2 }, updatedAt: timestamp } },
    { reflection: { text: "note", items: { surprise: "no" }, updatedAt: timestamp } },
    { reflection: { text: "note", items: { toString: "no" }, updatedAt: timestamp } },
    { reflection: { text: "note", items: {}, updatedAt: "yesterday" } },
    { recordLinks: [{ kind: "script", id: "a" }] },
    { recordLinks: [{ kind: "log", id: "2026-02-30" }] },
    { scheduledDate: "2026-02-30" }, { focusDate: "oops" },
    { scheduledTime: "24:00", scheduledDate: "2026-11-02" },
    { scheduledTime: "10:00" }, { durationMinutes: -1 }, { durationMinutes: 0.5 },
  ]
  for (const patch of malformed) assert.ok(!validTask({ ...task(), ...patch }), JSON.stringify(patch))
  assert.ok(validDateKey("2028-02-29")); assert.ok(!validDateKey("2026-02-29"))
})
test("overlapping events get lanes, disjoint events reuse full width", () => {
  const values = [task({ id: "a", due: "2026-11-02", time: "14:00", durationMinutes: 60 }), task({ id: "b", due: "2026-11-02", time: "14:30", durationMinutes: 45 }), task({ id: "c", due: "2026-11-02", time: "16:00" })]
  const lanes = timedLanes(values, "2026-11-02")
  assert.equal(lanes[0].lanes, 2); assert.equal(lanes[1].lanes, 2)
  assert.notEqual(lanes[0].lane, lanes[1].lane)
  assert.equal(lanes[2].lanes, 1)
  assert.equal(timedLanes(values, "2026-11-03").length, 0)
})
test("reflection edits retain existing conflict protection and merge independent tasks", () => {
  const before = task()
  const reflected = task({ reflection: { text: "A short note", items: {}, updatedAt: timestamp } })
  const base = { ...emptyWorkspace(), tasks: [before, task({ id: "b" })] }
  const local = { ...base, tasks: [reflected, task({ id: "b" })] }
  const remote = { ...base, tasks: [before, task({ id: "b", done: true })] }
  const result = mergeWorkspace(base, local, remote)
  assert.deepEqual(result.conflicts, [])
  assert.equal(result.data.tasks[0].reflection?.text, "A short note")
  assert.equal(result.data.tasks[1].done, true)
  assert.deepEqual(mergeWorkspace(base, local, { ...base, tasks: [task({ title: "Concurrent edit" }), task({ id: "b" })] }).conflicts, ["tasks: a"])
})

test("calendar items show a start time only when there is a real one", () => {
  const day = "2026-11-03"
  assert.equal(startTimeOn(task({ due: day, time: "09:30" }), day), "09:30")
  for (const time of ["23:55", "23:59", "23:45"]) {
    const value = task({ due: day, time })
    assert.ok(isEndOfDay(time))
    assert.equal(startTimeOn(value, day), undefined, `${time} is an end-of-day deadline`)
    assert.ok(isDeadlineOn(value, day))
  }
  assert.ok(!isEndOfDay("23:30"))
  assert.ok(isDeadlineOn(task({ due: day }), day))
  // A scheduled slot is a real start even late at night, and never turns the deadline day into a timed one.
  const scheduled = task({ due: "2026-11-06", scheduledDate: day, scheduledTime: "23:55" })
  assert.equal(startTimeOn(scheduled, day), "23:55")
  assert.ok(!isDeadlineOn(scheduled, day))
  assert.equal(startTimeOn(scheduled, "2026-11-06"), undefined)
  assert.ok(isDeadlineOn(scheduled, "2026-11-06"))
  assert.equal(startTimeOn(task({ due: day, time: "10:00" }), "2026-11-04"), undefined)
})
test("month chips cap at three rows with a +N more row", () => {
  assert.deepEqual(chipOverflow([1, 2, 3]), { shown: [1, 2, 3], more: 0 })
  assert.deepEqual(chipOverflow([1, 2, 3, 4]), { shown: [1, 2], more: 2 })
  assert.deepEqual(chipOverflow([1, 2, 3, 4, 5, 6], 2), { shown: [1], more: 5 })
  assert.deepEqual(chipOverflow([]), { shown: [], more: 0 })
})
test("narrow month dots: done, overdue and open, at most three plus a count", () => {
  const today = "2026-11-02"
  const items = [task({ done: true, due: "2026-10-01" }), task({ due: "2026-10-30" }), task({ due: today }), task(), task()]
  assert.deepEqual(dayDots(items.slice(0, 3), today), { dots: ["done", "overdue", "open"], more: 0 })
  assert.deepEqual(dayDots(items, today), { dots: ["done", "overdue", "open"], more: 2 })
  assert.deepEqual(dayDots([], today), { dots: [], more: 0 })
})
test("week and day views: end-of-day deadlines sit in the All-day / Due row, real times stay timed", () => {
  const day = "2026-11-03"
  const endOfDay = task({ id: "eod", due: day, time: "23:55" })
  const lateEdge = task({ id: "edge", due: day, time: "23:45" })
  const real = task({ id: "real", due: day, time: "09:30" })
  const late = task({ id: "late", due: day, time: "23:30" })
  const allDay = task({ id: "all", due: day })
  const scheduledLate = task({ id: "sched", due: "2026-11-06", scheduledDate: day, scheduledTime: "23:55" })
  for (const value of [endOfDay, lateEdge, allDay]) {
    assert.ok(isAllDayOn(value, day), `${value.id} is all-day / due`)
    assert.ok(!isTimedOn(value, day), `${value.id} is not timed`)
  }
  for (const value of [real, late, scheduledLate]) {
    assert.ok(isTimedOn(value, day), `${value.id} keeps its time`)
    assert.ok(!isAllDayOn(value, day), `${value.id} is not all-day`)
  }
  // A scheduled item's deadline day shows it as due, not timed.
  assert.ok(isAllDayOn(scheduledLate, "2026-11-06"))
  assert.ok(!isTimedOn(scheduledLate, "2026-11-06"))
  // Nothing appears on an unrelated day.
  assert.ok(!isAllDayOn(endOfDay, "2026-11-04") && !isTimedOn(endOfDay, "2026-11-04"))
  const lanes = timedLanes([endOfDay, lateEdge, real, late, allDay, scheduledLate], day)
  assert.deepEqual(lanes.map((lane) => lane.task.id), ["real", "late", "sched"])
  assert.equal(lanes[2].start, 23 * 60 + 55, "a scheduled 23:55 slot is a real start")
  // Display only: the stored due time is untouched.
  assert.equal(endOfDay.time, "23:55")
})
