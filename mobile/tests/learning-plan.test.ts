import assert from "node:assert/strict"
import { test } from "node:test"
import { applyFocusPlan, emptyWorkspace, isMeetingId, meetingEvents, planWeek, setTaskStatus, todayPlan, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { agendaItems, tasksByDay, timedLanes } from "../src/native/screens/planner/calendar/schedule.ts"
import { meetingsProblem } from "../src/native/screens/learning/meetings-rules.ts"

const ts = "2026-11-01T00:00:00Z"
const course = { id: "crs_a", title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall 2026", schedule: "", location: "", url: "", description: "", tags: [], color: "blue" as const, createdAt: ts, updatedAt: ts, startDate: "2026-08-24", endDate: "2026-12-18", meetings: [{ id: "m1", kind: "class" as const, days: [1, 3], start: "10:00", end: "11:15", location: "Hall 2" }] }
const task = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, courseId: "crs_a", learningType: "assignment" as const, starred: false, done: false, createdAt: ts, updatedAt: ts, ...extra })
const data = (tasks: unknown[] = []): Collections => ({ ...emptyWorkspace(), courses: [course], tasks: tasks as Collections["tasks"] })

test("class times appear on the phone calendar as timed events and never as overdue work", () => {
  const items = [...data().tasks, ...meetingEvents(data().courses, "2026-11-09", "2026-11-15")]
  assert.deepEqual(items.map(t => t.scheduledDate), ["2026-11-09", "2026-11-11"])
  assert.ok(items.every(t => isMeetingId(t.id)))
  assert.equal(tasksByDay(items, ["2026-11-09", "2026-11-10"]).get("2026-11-09")!.length, 1)
  assert.equal(tasksByDay(items, ["2026-11-09", "2026-11-10"]).get("2026-11-10")!.length, 0)
  const agenda = agendaItems(items, "2026-11-09", "2026-11-12", data().courses)
  assert.equal(agenda[0].time, "10:00")
  assert.equal(agenda[0].overdue, false)
  assert.equal(timedLanes(items, "2026-11-09")[0].end - timedLanes(items, "2026-11-09")[0].start, 75)
})

test("the phone plan and today view use the same rules as the Mac", () => {
  const w = data([task("late", { due: "2026-11-07" }), task("a", { due: "2026-11-12", effort: "quick" })])
  const plan = todayPlan(w, "2026-11-09")
  assert.equal(plan.classes.length, 1)
  assert.equal(plan.next?.task.id, "late")
  const proposals = planWeek(w, "2026-11-09")
  const saved = applyFocusPlan(w, proposals.map(p => ({ id: p.task.id, date: p.date })))
  assert.ok(validWorkspace(saved), "a saved plan is a valid workspace")
  assert.equal(saved.tasks.find(t => t.id === "a")!.focusDate, "2026-11-11")
  const started = setTaskStatus(saved, "a", "in_progress")
  assert.equal(started.tasks.find(t => t.id === "a")!.status, "in_progress")
  assert.ok(validWorkspace(started))
})

test("class time entry rejects bad times", () => {
  assert.equal(meetingsProblem(course.meetings), undefined)
  assert.ok(meetingsProblem([{ ...course.meetings[0], start: "9:00" }]))
  assert.ok(meetingsProblem([{ ...course.meetings[0], end: "09:00" }]))
})
