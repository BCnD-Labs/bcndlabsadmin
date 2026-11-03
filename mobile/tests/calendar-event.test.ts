import assert from "node:assert/strict"
import { test } from "node:test"
import { createTask, inTab, taskRows, toggleTask, updateTask, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { taskOnDate, timedLanes } from "../src/native/screens/planner/calendar/schedule.ts"
import { plannerRows } from "../src/native/screens/planner/rows.ts"
import { buildNewTask, buildPatch, draftErrors, draftFromTask, emptyDraft } from "../src/native/screens/planner/task-form.ts"
import { task, ts, ws } from "./workspace-fake.ts"

const day = "2026-11-03"
const now = "2026-11-03T10:00:00Z"

test("event creation schedules a real calendar item without inventing a task deadline", () => {
  const draft = { ...emptyDraft(day, "event"), title: "Dentist", extras: { ...emptyDraft(day, "event").extras!, scheduledTime: "9:30", duration: "45" } }
  assert.deepEqual(draftErrors(draft), {})
  const input = buildNewTask(draft, now)
  assert.equal(input.kind, "event")
  assert.equal(input.due, undefined)
  assert.equal(input.time, undefined)
  assert.equal(input.done, false)
  assert.equal(input.scheduledDate, day)
  assert.equal(input.scheduledTime, "09:30")
  assert.equal(input.durationMinutes, 45)
  const { data, record } = createTask(ws(), input, { now: () => now, makeId: () => "event" })
  assert.equal(validWorkspace(data), true)
  assert.equal(taskOnDate(record, day), true)
  assert.equal(taskOnDate(record, "2026-11-04"), false)
  for (const tab of ["today", "next", "all", "done"] as const) {
    assert.equal(inTab(record, tab, day), false)
    assert.deepEqual(taskRows(data.tasks, { tab, today: day, lingering: new Set([record.id]) }), [])
  }
  assert.equal(plannerRows([{ ...record, focusDate: day }], [], { tab: "today", today: day, search: "" }).total, 0)
  assert.equal(toggleTask(data, record.id).tasks[0].done, false)
})

test("events require a valid date, allow all-day, and preserve links and unknown fields on edit", () => {
  assert.match(draftErrors({ ...emptyDraft("", "event"), title: "Meeting" }).schedule!, /date/)
  assert.match(draftErrors({ ...emptyDraft("2026-02-30", "event"), title: "Meeting" }).schedule!, /date/)
  const original = { ...task("event"), kind: "event", scheduledDate: day, links: [{ label: "Call", url: "https://example.com/call" }], futureField: { untouched: true } } as unknown as Collections["tasks"][number]
  assert.equal(validWorkspace(ws({ tasks: [original] })), true)
  const draft = { ...draftFromTask(original), title: "Renamed meeting" }
  const result = updateTask(ws({ tasks: [original] }), original.id, buildPatch(draft, original, now), { now: () => now })
  const saved = JSON.parse(JSON.stringify(result.tasks[0]))
  assert.equal(saved.kind, "event")
  assert.equal(saved.scheduledDate, day)
  assert.equal(saved.scheduledTime, undefined)
  assert.equal(saved.due, undefined)
  assert.deepEqual(saved.links, original.links)
  assert.deepEqual(saved.futureField, { untouched: true })
})

test("legacy tasks and coursework events retain their original task meaning", () => {
  const old = { ...task("legacy"), createdAt: ts, updatedAt: ts, learningType: "event", due: day } as unknown as Collections["tasks"][number]
  assert.equal(validWorkspace(ws({ tasks: [old] })), true)
  const saved = updateTask(ws({ tasks: [old] }), old.id, buildPatch({ ...draftFromTask(old), title: "Renamed" }, old, now)).tasks[0]
  assert.equal(saved.kind, undefined)
  assert.equal(saved.learningType, "event")
  assert.equal(saved.due, day)
  assert.equal(inTab(saved, "today", day), true)
  for (const kind of ["appointment", null, 2]) assert.equal(validWorkspace(ws({ tasks: [{ ...old, kind }] })), false)
  assert.equal(validWorkspace(ws({ tasks: [{ ...old, kind: "event", scheduledDate: undefined }] })), false)
})


test("short events use their real end time and do not overlap a following appointment", () => {
  const lanes = timedLanes([
    { ...task("short"), kind: "event", scheduledDate: day, scheduledTime: "09:00", durationMinutes: 15 },
    { ...task("next"), kind: "event", scheduledDate: day, scheduledTime: "09:15", durationMinutes: 30 },
  ], day)
  assert.deepEqual(lanes.map(({ start, end, lane, lanes }) => ({ start, end, lane, lanes })), [
    { start: 540, end: 555, lane: 0, lanes: 1 },
    { start: 555, end: 585, lane: 0, lanes: 1 },
  ])
})
