import assert from "node:assert/strict"
import { test } from "node:test"
import { createCourse, createTask, emptyWorkspace, type NewCourse, type NewTask } from "../src/lib/shared.ts"
import { dueGroup, learningProgress, upcomingLearning } from "../src/native/screens/learning/learning-view.ts"

const now = "2026-11-03T12:00:00.000Z"
const today = "2026-11-03"
const courseBase: NewCourse = { title: "Network certification", kind: "certification", code: "", instructor: "", instructorEmail: "", term: "", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", endDate: "2026-11-10" }
const taskBase: NewTask = { title: "Domain 1", courseId: "cert", learningType: "milestone", starred: false, done: false }
const opts = (id: string) => ({ makeId: () => id, now: () => now })

test("Learning shows measured progress for exam domains and keeps practice scores separate", () => {
  let data = createCourse(emptyWorkspace(), courseBase, opts("cert")).data
  data = createTask(data, { ...taskBase, done: true }, opts("domain1")).data
  data = createTask(data, { ...taskBase, title: "Domain 2" }, opts("domain2")).data
  data = createTask(data, { ...taskBase, title: "Practice test", learningType: "exam", score: 78 }, opts("practice")).data
  const p = learningProgress(data.courses[0], data.tasks)
  assert.equal(p.label, "1 of 2 exam domains")
  assert.equal(p.value, 0.5)
  assert.equal(p.best, 78)
  assert.deepEqual([learningProgress(data.courses[0], data.tasks.filter(t => t.learningType === "exam")).measured, learningProgress(data.courses[0], data.tasks.filter(t => t.learningType === "exam")).best], [false, 78])
})

test("an empty skill has no fabricated percentage; a reading item uses actual pages", () => {
  const skill = createCourse(emptyWorkspace(), { ...courseBase, kind: "skill", title: "Rust" }, opts("skill")).record
  const book = createCourse(emptyWorkspace(), { ...courseBase, kind: "reading", title: "Book", pagesRead: 45, pagesTotal: 180 }, opts("book")).record
  assert.deepEqual([learningProgress(skill, []).measured, learningProgress(skill, []).label], [false, "Add a milestone to track progress"])
  assert.deepEqual([learningProgress(book, []).value, learningProgress(book, []).label], [0.25, "p. 45 of 180"])
})

test("Upcoming includes dated linked work and a future exam date, with honest grouping", () => {
  let data = createCourse(emptyWorkspace(), courseBase, opts("cert")).data
  data = createTask(data, { ...taskBase, due: "2026-11-02" }, opts("overdue")).data
  data = createTask(data, { ...taskBase, title: "Done", due: today, done: true }, opts("done")).data
  const rows = upcomingLearning(data.courses, data.tasks, today)
  assert.deepEqual(rows.map(x => x.id), ["overdue", "exam-cert"])
  assert.equal(dueGroup(rows[0].due, today), "Overdue")
  assert.equal(dueGroup(rows[1].due, today), "Next 7 days")
})


test("scheduled sessions across every learning kind stay separate from deadlines, including older event records", async () => {
  const { learningToday } = await import("../src/native/screens/learning/learning-view.ts")
  let data = emptyWorkspace()
  for (const kind of ["course", "certification", "selfpaced", "skill", "reading"] as const) {
    data = createCourse(data, { ...courseBase, title: kind, kind, endDate: undefined }, opts(kind)).data
    data = createTask(data, { ...taskBase, courseId: kind, title: `${kind} session`, kind: "event", learningType: "event", scheduledDate: today, scheduledTime: "09:30", due: "2026-11-01" }, opts(`session-${kind}`)).data
  }
  data = createTask(data, { ...taskBase, courseId: "skill", title: "Legacy session", learningType: "event", due: today }, opts("legacy-event")).data
  const day = learningToday(data.courses, data.tasks, today)
  assert.equal(day.schedule.length, 6)
  assert.equal(day.overdue.length, 0)
  assert.equal(day.due.length, 0)
  const upcoming = upcomingLearning(data.courses, data.tasks, today)
  assert.equal(upcoming.length, 6)
  assert.ok(upcoming.every(row => row.occasion === "event" && row.due === today))
  assert.equal(learningToday([], data.tasks, today).schedule.length, 0)
})
