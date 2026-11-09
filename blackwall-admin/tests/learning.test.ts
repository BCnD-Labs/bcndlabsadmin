import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import { applyFocusPlan, setTaskStatus, toggleTask } from "../shared/records.ts"
import { degreeMap, meetingCourseId, meetingEvents, meetingsOn, planWeek, startBy, statusOf, termTimeline, todayPlan, weekLoad } from "../shared/learning.ts"
import type { Course, Task } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
const course = (patch: Partial<Course> = {}): Course => ({ id: "crs_a", title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall 2026", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", createdAt: ts, updatedAt: ts, ...patch })
const task = (patch: Partial<Task> = {}): Task => ({ id: "t1", title: "Homework", courseId: "crs_a", learningType: "assignment", starred: false, done: false, createdAt: ts, updatedAt: ts, ...patch })
const meeting = { id: "m1", kind: "class" as const, days: [1, 3], start: "10:00", end: "11:15", location: "Hall 2" }
// 2026-11-09 is a Monday.

test("older workspaces without meetings, status or effort still load", () => {
  assert.ok(validWorkspace(JSON.parse(JSON.stringify({ ...emptyWorkspace(), courses: [course()], tasks: [task()] }))))
  assert.ok(validWorkspace({ ...emptyWorkspace(), courses: [course({ meetings: [meeting], syllabus: "Week 1", policies: "Late: -10%", repoUrl: "https://github.com/x/y" })], tasks: [task({ status: "in_progress", effort: "big" })] }))
})

test("bad meetings, statuses and efforts are rejected", () => {
  const bad = (m: unknown) => !validWorkspace({ ...emptyWorkspace(), courses: [course({ meetings: [m] as never })] })
  assert.ok(bad({ ...meeting, days: [] }))
  assert.ok(bad({ ...meeting, days: [7] }))
  assert.ok(bad({ ...meeting, start: "11:00", end: "10:00" }))
  assert.ok(bad({ ...meeting, start: "9:00" }))
  assert.ok(bad({ ...meeting, kind: "party" }))
  assert.ok(bad({ ...meeting, id: "a:b" }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task({ status: "done" as never })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task({ effort: "huge" as never })] }))
})

test("meetings repeat weekly inside the term dates only", () => {
  const c = course({ meetings: [meeting], startDate: "2026-11-09", endDate: "2026-11-18" })
  assert.equal(meetingsOn(c, "2026-11-09").length, 1)
  assert.equal(meetingsOn(c, "2026-11-10").length, 0)
  assert.equal(meetingsOn(c, "2026-11-23").length, 0, "after the end date")
  const events = meetingEvents([c], "2026-11-09", "2026-11-22")
  assert.deepEqual(events.map((e) => e.scheduledDate), ["2026-11-09", "2026-11-11", "2026-11-16", "2026-11-18"])
  assert.equal(events[0].scheduledTime, "10:00")
  assert.equal(events[0].durationMinutes, 75)
  assert.equal(meetingCourseId(events[0].id), "crs_a")
  assert.ok(validWorkspace({ ...emptyWorkspace(), tasks: events }), "calendar events are valid task shapes")
})

test("status moves work through its life and keeps done in step", () => {
  const data = { tasks: [task(), task({ id: "t2", status: "in_progress" })] }
  const submitted = setTaskStatus(data, "t1", "submitted", { now: () => ts })
  assert.equal(submitted.tasks[0].done, true)
  assert.equal(submitted.tasks[0].completedAt, ts)
  const back = setTaskStatus(submitted, "t1", "in_progress")
  assert.equal(back.tasks[0].done, false)
  assert.equal(back.tasks[0].completedAt, undefined)
  const toggled = toggleTask(data, "t2", { now: () => ts })
  assert.equal(toggled.tasks[1].status, "submitted")
  assert.equal(toggleTask(toggled, "t2").tasks[1].status, "in_progress")
  assert.equal(toggleTask(data, "t1").tasks[0].status, undefined, "tasks without a status stay without one")
  assert.equal(statusOf(task({ done: true })), "submitted")
})

test("today: start with what is late, then due today, then what to begin", () => {
  const data = { courses: [course({ meetings: [meeting] })], tasks: [task({ id: "late", due: "2026-11-07" }), task({ id: "today", due: "2026-11-09" }), task({ id: "soon", due: "2026-11-11" }), task({ id: "far", due: "2026-12-20" })] }
  const plan = todayPlan(data, "2026-11-09")
  assert.equal(plan.classes.length, 1)
  assert.deepEqual(plan.overdue.map((t) => t.id), ["late"])
  assert.deepEqual(plan.startNow.map((t) => t.id), ["soon"])
  assert.equal(plan.next?.task.id, "late")
  assert.equal(todayPlan({ ...data, tasks: data.tasks.slice(2) }, "2026-11-09").next?.task.id, "soon")
  assert.equal(todayPlan({ ...data, tasks: [data.tasks[3]] }, "2026-11-09").next, undefined, "nothing to start yet")
})

test("start-by follows effort; exams get a longer runway", () => {
  assert.equal(startBy(task({ due: "2026-11-20" })), "2026-11-17")
  assert.equal(startBy(task({ due: "2026-11-20", effort: "big" })), "2026-11-13")
  assert.equal(startBy(task({ due: "2026-11-20", effort: "quick" })), "2026-11-19")
  assert.equal(startBy(task({ due: "2026-11-20", learningType: "exam" })), "2026-11-15")
})

test("the week plan starts work early, spreads full days, and leaves your own plans alone", () => {
  const tasks = ["a", "b", "c", "d"].map((id) => task({ id, due: "2026-11-12", effort: "quick" }))
  const data = { courses: [course()], tasks: [...tasks, task({ id: "own", due: "2026-11-12", focusDate: "2026-11-10" }), task({ id: "done", done: true, due: "2026-11-12" }), task({ id: "far", due: "2027-03-01" })] }
  const plan = planWeek(data, "2026-11-09")
  assert.deepEqual(plan.map((p) => p.task.id), ["a", "b", "c", "d"])
  assert.deepEqual(plan.map((p) => p.date), ["2026-11-11", "2026-11-11", "2026-11-11", "2026-11-12"], "three a day, the fourth moves to the due date")
  assert.ok(plan[3].why.includes("full"))
  const applied = applyFocusPlan({ tasks: data.tasks }, plan.map((p) => ({ id: p.task.id, date: p.date })))
  assert.equal(applied.tasks.find((t) => t.id === "a")!.focusDate, "2026-11-11")
  assert.equal(applied.tasks.find((t) => t.id === "own")!.focusDate, "2026-11-10")
  assert.equal(planWeek({ ...data, tasks: applied.tasks }, "2026-11-09").length, 0, "applying twice proposes nothing new")
  assert.equal(planWeek({ courses: [course()], tasks: [task({ due: "2026-11-05" })] }, "2026-11-09")[0].date, "2026-11-09", "late work starts today")
})

test("week load rates heavy days; timeline counts per course per week; degree map groups terms", () => {
  const c = course({ meetings: [meeting] })
  const data = { courses: [c, course({ id: "crs_b", title: "Calculus", term: "Spring 2026", startDate: "2026-01-12", endDate: "2026-05-01", credits: 4 })], tasks: [task({ id: "e", learningType: "exam", due: "2026-11-11" }), task({ id: "h", due: "2026-11-11" }), task({ id: "p", due: "2026-11-11" })] }
  const week = weekLoad(data, "2026-11-09")
  assert.equal(week[0].load, "light")
  assert.equal(week[2].load, "heavy")
  assert.equal(week[2].exams.length, 1)
  const line = termTimeline(data, "2026-11-09", 3)
  assert.deepEqual(line.weeks.map((w) => w.count), [3, 0, 0])
  assert.equal(line.weeks[0].exam, true)
  assert.equal(line.rows.length, 1, "a finished course is not on the timeline")
  const map = degreeMap(data.courses)
  assert.deepEqual(map.map((g) => g.term), ["Spring 2026", "Fall 2026"])
  assert.equal(map[0].credits, 4)
})
