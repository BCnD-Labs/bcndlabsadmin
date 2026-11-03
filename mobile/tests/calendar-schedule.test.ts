import assert from "node:assert/strict"
import { test } from "node:test"
import { axisHeight, blockBox, DEFAULT_HOURS, hourRange, minuteToTime } from "../src/native/screens/planner/calendar/layout.ts"
import { agendaItems, allDayOn, chipOverflow, dayDots, dayMeta, isDeadlineOn, localKeyOf, startTimeOn, taskOnDate, tasksByDay, taskSlot, timedLanes, type Task } from "../src/native/screens/planner/calendar/schedule.ts"
import * as web from "../../blackwall-admin/src/features/productivity/planner-utils.ts"
import { task as fake } from "./workspace-fake.ts"

const today = "2026-11-04"
const t = (id: string, extra: Record<string, unknown> = {}) => fake(id, extra) as unknown as Task
const ids = (list: { id: string }[]) => list.map((x) => x.id)

// Every shape of schedule the workspace can hold.
const SAMPLE: Task[] = [
  t("none"),
  t("due", { due: "2026-11-04" }),
  t("due-time", { due: "2026-11-04", time: "14:30" }),
  t("due-eod", { due: "2026-11-04", time: "23:55" }),
  t("sched", { scheduledDate: "2026-11-04" }),
  t("sched-time", { scheduledDate: "2026-11-04", scheduledTime: "09:00", durationMinutes: 90 }),
  t("sched-elsewhere", { scheduledDate: "2026-11-02", scheduledTime: "10:00", due: "2026-11-04" }),
  t("sched-late-due", { scheduledDate: "2026-11-04", scheduledTime: "10:15", due: "2026-11-09", time: "08:00" }),
  t("sched-eod", { scheduledDate: "2026-11-04", scheduledTime: "23:50" }),
  t("done", { due: "2026-11-04", done: true }),
]
const DAYS = ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-10"]

test("a task sits on its schedule, else its due date; a different due date shows it again as a deadline", () => {
  assert.deepEqual(taskSlot(t("a", { scheduledDate: "2026-11-02", scheduledTime: "10:00", due: "2026-11-04", time: "08:00" })), { date: "2026-11-02", time: "10:00" })
  assert.deepEqual(taskSlot(t("b", { due: "2026-11-04", time: "08:00" })), { date: "2026-11-04", time: "08:00" })
  const moved = t("c", { scheduledDate: "2026-11-02", due: "2026-11-04" })
  assert.equal(taskOnDate(moved, "2026-11-02"), true)
  assert.equal(taskOnDate(moved, "2026-11-04"), true)
  assert.equal(taskOnDate(moved, "2026-11-03"), false)
  assert.equal(isDeadlineOn(moved, "2026-11-04"), true)
  assert.equal(isDeadlineOn(moved, "2026-11-02"), false)
  assert.equal(taskOnDate(t("d"), today), false)
})

test("an unscheduled end-of-day deadline is not a start time, a scheduled one is", () => {
  assert.equal(startTimeOn(t("a", { due: today, time: "23:45" }), today), undefined)
  assert.equal(startTimeOn(t("b", { scheduledDate: today, scheduledTime: "23:50" }), today), "23:50")
  assert.equal(startTimeOn(t("c", { due: today, time: "23:44" }), today), "23:44")
  assert.equal(isDeadlineOn(t("a", { due: today, time: "23:59" }), today), true)
})

test("a malformed time never becomes a start time", () => {
  assert.equal(startTimeOn(t("a", { due: today, time: "9am" }), today), undefined)
  assert.equal(startTimeOn(t("b", { scheduledDate: today, scheduledTime: "24:30" }), today), undefined)
})

test("parity with the web: which tasks are on which day, in the all-day row and as deadlines", () => {
  const w = (task: Task) => task as unknown as Parameters<typeof web.taskOnDate>[0]
  for (const day of DAYS) {
    assert.deepEqual(ids(SAMPLE.filter((x) => taskOnDate(x, day))), ids(SAMPLE.filter((x) => web.taskOnDate(w(x), day))), `taskOnDate ${day}`)
    assert.deepEqual(ids(SAMPLE.filter((x) => isDeadlineOn(x, day))), ids(SAMPLE.filter((x) => web.isDeadlineOn(w(x), day))), `deadline ${day}`)
    for (const x of SAMPLE) assert.equal(startTimeOn(x, day), web.startTimeOn(w(x), day), `${x.id} start ${day}`)
    // The web's all-day row rule, verbatim from schedule-calendar.tsx.
    const webAllDay = SAMPLE.filter((x) => { const slot = web.taskSlot(w(x)); return (slot.date === day && !slot.time) || (x.due === day && slot.date !== day) })
    // The one deliberate difference: an unscheduled end-of-day deadline is listed in the all-day / due row, not on the 23:xx axis.
    const mine = allDayOn(SAMPLE, day)
    assert.deepEqual(ids(mine.filter((x) => x.id !== "due-eod")), ids(webAllDay), `all-day ${day}`)
    assert.equal(mine.some((x) => x.id === "due-eod"), day === today)
  }
})

test("parity with the web: lanes for overlapping hour-or-longer items", () => {
  const sample = [
    t("a", { due: today, time: "09:00" }),
    t("b", { scheduledDate: today, scheduledTime: "09:30", durationMinutes: 60 }),
    t("c", { scheduledDate: today, scheduledTime: "09:45", durationMinutes: 120 }),
    t("d", { scheduledDate: today, scheduledTime: "13:00" }),
    t("e", { scheduledDate: today, scheduledTime: "13:00" }),
    t("f", { scheduledDate: today, scheduledTime: "22:30", durationMinutes: 300 }),
  ]
  const mine = timedLanes(sample, today).map((l) => ({ id: l.task.id, start: l.start, end: l.end, lane: l.lane, lanes: l.lanes }))
  const theirs = web.timedLanes(sample as unknown as Parameters<typeof web.timedLanes>[0], today).map((l) => ({ id: l.task.id, start: l.start, end: l.end, lane: l.lane, lanes: l.lanes }))
  assert.deepEqual(mine, theirs)
})

test("lane layout: overlaps split the width, gaps reset it, real duration is preserved, the day ends at midnight", () => {
  const lanes = timedLanes(
    [
      t("a", { scheduledDate: today, scheduledTime: "09:00" }), // 09:00-10:00
      t("b", { scheduledDate: today, scheduledTime: "09:30", durationMinutes: 15 }), // overlaps a; ends before c starts
      t("c", { scheduledDate: today, scheduledTime: "09:45" }), // overlaps a, reuses b's lane
      t("d", { scheduledDate: today, scheduledTime: "10:00" }), // starts as a ends: reuses lane 0
      t("e", { scheduledDate: today, scheduledTime: "15:00" }), // alone
      t("f", { scheduledDate: today, scheduledTime: "23:30", durationMinutes: 600 }), // clipped at 24:00
    ],
    today,
  )
  const by = Object.fromEntries(lanes.map((l) => [l.task.id, l]))
  assert.deepEqual([by.a.lane, by.b.lane, by.c.lane, by.d.lane], [0, 1, 1, 0])
  assert.deepEqual([by.a.lanes, by.b.lanes, by.c.lanes, by.d.lanes], [2, 2, 2, 2])
  assert.deepEqual([by.e.lane, by.e.lanes], [0, 1])
  assert.equal(by.b.end - by.b.start, 15)
  assert.equal(by.f.end, 1440)
  assert.deepEqual(ids(lanes.map((l) => l.task)), ["a", "b", "c", "d", "e", "f"])
  // Two items that touch (one ends exactly when the next starts) do not share a lane group.
  const touching = timedLanes([t("x", { scheduledDate: today, scheduledTime: "08:00" }), t("y", { scheduledDate: today, scheduledTime: "09:00" })], today)
  assert.deepEqual(touching.map((l) => [l.lane, l.lanes]), [[0, 1], [0, 1]])
})

test("hour range grows to fit and block boxes follow it", () => {
  assert.deepEqual(hourRange([]), DEFAULT_HOURS)
  const early = timedLanes([t("a", { scheduledDate: today, scheduledTime: "05:30" }), t("b", { scheduledDate: today, scheduledTime: "21:00", durationMinutes: 150 })], today)
  assert.deepEqual(hourRange(early), { from: 5, to: 24 })
  const lanes = timedLanes([t("a", { scheduledDate: today, scheduledTime: "09:30", durationMinutes: 90 }), t("b", { scheduledDate: today, scheduledTime: "09:45", durationMinutes: 15 })], today)
  const range = { from: 8, to: 12 }
  assert.equal(axisHeight(range, 50), 200)
  const a = blockBox(lanes[0], range, 50, 30)
  assert.deepEqual([a.top, a.height, a.leftPct, a.widthPct], [75, 75, 0, 50])
  // Short items retain real timing; the visual minimum keeps them tappable.
  const b = blockBox(lanes[1], range, 50, 30)
  assert.deepEqual([b.top, b.leftPct, b.widthPct], [87.5, 50, 50])
  assert.equal(blockBox({ ...lanes[0], end: lanes[0].start + 5 }, range, 10, 30).height, 30)
})

test("tasksByDay lists a task once per day it appears on, never invents days", () => {
  const map = tasksByDay(SAMPLE, DAYS)
  assert.deepEqual([...map.keys()], DAYS)
  assert.deepEqual(ids(map.get("2026-11-02")!), ["sched-elsewhere"])
  assert.deepEqual(ids(map.get("2026-11-09")!), ["sched-late-due"])
  assert.equal(map.get("2026-11-10")!.length, 0)
  // Same count as the web's per-day filter.
  for (const d of DAYS) assert.equal(map.get(d)!.length, SAMPLE.filter((x) => web.taskOnDate(x as never, d)).length)
  assert.equal(ids(map.get(today)!).filter((i) => i === "sched-late-due").length, 1)
})

test("month dots: done, overdue, open, capped with a count (web rule)", () => {
  const items = [t("a", { done: true, due: "2026-11-01" }), t("b", { due: "2026-11-02" }), t("c", { due: today }), t("d", { due: today }), t("e", { scheduledDate: today })]
  assert.deepEqual(dayDots(items, today), { dots: ["done", "overdue", "open"], more: 2 })
  assert.deepEqual(dayDots([], today), { dots: [], more: 0 })
  assert.deepEqual(dayDots(items, today, 10).dots, ["done", "overdue", "open", "open", "open"])
  const w = web.dayDots(items as never, today)
  assert.deepEqual(dayDots(items, today), w)
})

test("agenda: timed first by start time, then the rest by creation; deadlines, overdue and course are marked", () => {
  const course = { id: "c1", title: "Energy", code: "GEG-123" } as never
  const tasks = [
    t("late", { due: today, createdAt: "2026-11-01T00:00:00Z" }),
    t("sched", { scheduledDate: today, scheduledTime: "09:00", durationMinutes: 45, courseId: "c1", due: "2026-11-03" }),
    t("early", { scheduledDate: today, scheduledTime: "07:00" }),
    t("older", { due: today, createdAt: "2026-10-01T00:00:00Z", done: true }),
    t("other-day", { due: "2026-11-05" }),
  ]
  const list = agendaItems(tasks, today, today, [course])
  assert.deepEqual(ids(list), ["early", "sched", "older", "late"])
  assert.equal(list[1].time, "09:00")
  assert.equal(list[1].duration, 45)
  assert.equal(list[1].course, "Energy")
  assert.equal(list[1].overdue, true) // its due date (Nov 3) has passed
  assert.equal(list[2].deadline, true)
  assert.equal(list[2].overdue, false) // done tasks are never overdue
  assert.equal(list[3].time, undefined)
  assert.deepEqual(agendaItems([], today, today, []), [])
  assert.deepEqual(agendaItems(tasks, "2026-11-20", today, []), [])
})

test("day meta: a written log and tasks completed that day (phone-local date)", () => {
  const noon = new Date(2026, 10, 3, 12, 0, 0).toISOString()
  assert.equal(localKeyOf(noon), "2026-11-03")
  assert.equal(localKeyOf("not a time"), undefined)
  const journal = [{ id: "2026-11-03", text: " wrote ", createdAt: noon, updatedAt: noon }, { id: "2026-11-04", text: "   ", createdAt: noon, updatedAt: noon }] as never
  const tasks = [t("a", { done: true, completedAt: noon }), t("b", { done: false, completedAt: noon }), t("c", { done: true })]
  assert.deepEqual(dayMeta(tasks, journal, "2026-11-03"), { logged: true, completed: 1 })
  assert.deepEqual(dayMeta(tasks, journal, "2026-11-04"), { logged: false, completed: 0 })
})

test("chip overflow shows every item that fits, else one fewer plus a count (web rule)", () => {
  for (const n of [0, 1, 2, 3, 4, 7]) {
    const items = Array.from({ length: n }, (_, i) => i)
    assert.deepEqual(chipOverflow(items), web.chipOverflow(items))
  }
  assert.deepEqual(chipOverflow([1, 2, 3, 4]), { shown: [1, 2], more: 2 })
  assert.deepEqual(chipOverflow([1, 2, 3, 4], 1), { shown: [], more: 4 })
})

test("minuteToTime pads hours and minutes", () => {
  assert.deepEqual([0, 5, 570, 1439].map(minuteToTime), ["00:00", "00:05", "09:30", "23:59"])
})
