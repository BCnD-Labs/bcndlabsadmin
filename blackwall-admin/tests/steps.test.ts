import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, mergeWorkspace, validWorkspace } from "../shared/workspace.ts"
import { addSubtasks, removeCourseTopic, toggleSubtask } from "../shared/records.ts"
import { planWeek, startBy, studyPlan, todayPlan, topicUsage, weekLoad } from "../shared/learning.ts"
import { stepProgress } from "../shared/steps.ts"
import type { Course, Task } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
const topics = [{ id: "tp1", title: "Recursion" }, { id: "tp2", title: "Trees" }, { id: "tp3", title: "Graphs", done: true }]
const course = (patch: Partial<Course> = {}): Course => ({ id: "crs_a", title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall 2026", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", createdAt: ts, updatedAt: ts, ...patch })
const task = (patch: Partial<Task> = {}): Task => ({ id: "t1", title: "Homework", courseId: "crs_a", learningType: "assignment", starred: false, done: false, createdAt: ts, updatedAt: ts, ...patch })
const ids = () => { let n = 0; return () => `sub_${++n}` }
// 2026-11-09 is a Monday.

test("older shapes still load; bad topics and steps are rejected", () => {
  assert.ok(validWorkspace(JSON.parse(JSON.stringify({ ...emptyWorkspace(), courses: [course()], tasks: [task()] }))))
  assert.ok(validWorkspace({ ...emptyWorkspace(), courses: [course({ topics })], tasks: [task({ topicIds: ["tp1"], subtasks: [{ id: "s1", title: "Outline", done: false, date: "2026-11-10", topicId: "tp1" }] })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), courses: [course({ topics: [{ id: "a", title: 3 }] as never })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), courses: [course({ topics: [{ id: "a", title: "x" }, { id: "a", title: "y" }] })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task({ subtasks: [{ id: "s1", title: "x", done: "no" }] as never })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task({ subtasks: [{ id: "s1", title: "x", done: false, date: "tomorrow" }] })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task({ topicIds: [4] as never })] }))
})

test("steps add, finish and start the work; deleting a topic unlinks it", () => {
  let d = { ...emptyWorkspace(), courses: [course({ topics })], tasks: [task({ topicIds: ["tp1"] })] }
  d = addSubtasks(d, "t1", [{ title: "Outline", date: "2026-11-10" }, { title: "  " }, { title: "Draft", topicId: "tp1" }], { makeId: ids() })
  assert.deepEqual(d.tasks[0].subtasks!.map((s) => s.title), ["Outline", "Draft"])
  assert.deepEqual(stepProgress(d.tasks[0]), { done: 0, total: 2 })
  d = toggleSubtask(d, "t1", "sub_1")
  assert.equal(d.tasks[0].status, "in_progress", "finishing a step starts unstarted coursework")
  assert.deepEqual(stepProgress(d.tasks[0]), { done: 1, total: 2 })
  d = removeCourseTopic(d, "crs_a", "tp1")
  assert.deepEqual(d.courses[0].topics!.map((t) => t.id), ["tp2", "tp3"])
  assert.deepEqual(d.tasks[0].topicIds, [])
  assert.equal(d.tasks[0].subtasks![1].topicId, undefined)
  assert.ok(validWorkspace(JSON.parse(JSON.stringify(d))))
})

test("a study plan counts back from the exam, one review per covered topic plus a final review", () => {
  const exam = task({ id: "ex", title: "Midterm", learningType: "exam", due: "2026-11-20", topicIds: ["tp1", "tp2", "tp3"] })
  const data = { tasks: [exam], courses: [course({ topics })] }
  const plan = studyPlan(data, "ex", "2026-11-09")
  assert.deepEqual(plan.map((p) => p.title), ["Review: Recursion", "Review: Trees", "Final review"], "a topic marked known is skipped")
  assert.equal(plan.at(-1)!.date, "2026-11-19", "final review the day before")
  assert.ok(plan.every((p) => p.date >= "2026-11-09" && p.date < "2026-11-20"))
  assert.deepEqual(plan.map((p) => p.date), [...plan.map((p) => p.date)].sort())
  assert.deepEqual(plan.slice(0, 2).map((p) => p.topicId), ["tp1", "tp2"])
})

test("with no topics the plan is general, and it never doubles up on a second run", () => {
  const exam = task({ id: "ex", learningType: "exam", due: "2026-11-12" })
  const first = studyPlan({ tasks: [exam], courses: [course()] }, "ex", "2026-11-09")
  assert.deepEqual(first.map((p) => p.title), ["Review your notes", "Practice questions", "Final review"])
  const applied = addSubtasks({ tasks: [exam], courses: [course()] }, "ex", first, { makeId: ids() })
  assert.deepEqual(studyPlan(applied, "ex", "2026-11-09"), [])
  assert.deepEqual(studyPlan({ tasks: [{ ...exam, due: "2026-11-09" }], courses: [course()] }, "ex", "2026-11-09"), [], "nothing to plan once the exam is today")
})

test("study days respect the three-a-day cap when there is room elsewhere", () => {
  const busy = ["2026-11-10", "2026-11-11"].flatMap((date, i) => [1, 2, 3].map((n) => task({ id: `b${i}${n}`, focusDate: date })))
  const exam = task({ id: "ex", learningType: "exam", due: "2026-11-14" })
  const plan = studyPlan({ tasks: [...busy, exam], courses: [course()] }, "ex", "2026-11-09")
  assert.ok(plan.every((p) => p.date !== "2026-11-10" && p.date !== "2026-11-11"), JSON.stringify(plan))
})

test("Today shows planned steps and nudges an exam with no plan; planned work is not re-proposed", () => {
  const exam = task({ id: "ex", title: "Midterm", learningType: "exam", due: "2026-11-15" })
  const hw = task({ id: "hw", due: "2026-11-30", subtasks: [{ id: "s1", title: "Outline", done: false, date: "2026-11-09" }] })
  const data = { tasks: [exam, hw], courses: [course()] }
  const plan = todayPlan(data, "2026-11-09")
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.next?.step?.title, "Outline")
  assert.deepEqual(plan.studyNudges.map((t) => t.id), ["ex"])
  const done = todayPlan({ ...data, tasks: [exam, { ...hw, subtasks: [{ id: "s1", title: "Outline", done: true, date: "2026-11-09" }] }] }, "2026-11-09")
  assert.equal(done.steps.length, 0)
  assert.ok(!planWeek(data, "2026-11-09", 30).some((p) => p.task.id === "hw"), "already has dated steps")
  assert.equal(weekLoad(data, "2026-11-09")[0].steps.length, 1)
})

test("topic usage counts open assignments and exams per topic; a step edit on another device merges", () => {
  const data = { tasks: [task({ topicIds: ["tp1"] }), task({ id: "e", learningType: "exam", topicIds: ["tp1", "tp2"] })], courses: [course({ topics })] }
  assert.deepEqual(topicUsage(data, "crs_a").slice(0, 2), [{ topicId: "tp1", assignments: 1, exams: 1 }, { topicId: "tp2", assignments: 0, exams: 1 }])
  const base = { ...emptyWorkspace(), tasks: [task()] }
  const phone = addSubtasks(base, "t1", [{ title: "Outline" }], { makeId: ids() })
  const mac = { ...base, tasks: [task({ title: "Other" }), ...base.tasks.slice(1)] }
  assert.deepEqual(mergeWorkspace(base, phone, mac).conflicts, ["tasks: t1"], "same record edited on both: reviewed, not lost")
})

test("quizzes and an assignment type: older records load, long types are refused, quizzes start two days ahead and can be studied for", () => {
  const quiz = task({ id: "qz", title: "Reading quiz", learningType: "quiz", workType: "Reading", due: "2026-11-12" })
  assert.ok(validWorkspace({ ...emptyWorkspace(), courses: [course()], tasks: [quiz, task({ workType: undefined })] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), courses: [course()], tasks: [task({ workType: "x".repeat(61) })] }))
  assert.equal(startBy(quiz), "2026-11-10", "a quiz starts two days ahead")
  const plan = studyPlan({ tasks: [quiz], courses: [course()] }, "qz", "2026-11-09")
  assert.equal(plan.at(-1)?.title, "Final review")
  assert.equal(plan.at(-1)?.date, "2026-11-11")
})

test("notes, tasks and modules link both ways from one stored field", async () => {
  const { notesOfTask, tasksOfNote, tasksLinkingTask, setNoteTaskLinks, withLink, modulesOf } = await import("../shared/links.ts")
  const note = { id: "n1", text: "Recursion cheat sheet\nbase case first", color: "plain" as const, pinned: false, courseId: "crs_a", topicIds: ["tp1"], createdAt: ts, updatedAt: ts }
  const a = task({ id: "a" }), b = task({ id: "b", recordLinks: [{ kind: "task", id: "a" }] })
  let data = { ...emptyWorkspace(), courses: [course({ topics })], tasks: [a, b], notes: [note] }
  assert.ok(validWorkspace(data))
  data = setNoteTaskLinks(data, "n1", ["a", "b"], ts)
  assert.deepEqual(tasksOfNote(data, "n1").map((t) => t.id), ["a", "b"], "a link made from the note shows on both tasks")
  assert.deepEqual(notesOfTask(data, data.tasks[0]).map((n) => n.id), ["n1"], "and the task sees the note")
  assert.deepEqual(tasksLinkingTask(data, "a").map((t) => t.id), ["b"], "linked from")
  data = setNoteTaskLinks(data, "n1", ["b"], ts)
  assert.equal(data.tasks[0].recordLinks, undefined, "unlinking empties the field")
  assert.equal(data.tasks[0].updatedAt, ts)
  assert.equal(withLink(undefined, { kind: "note", id: "n1" }, true).length, 1)
  assert.deepEqual(modulesOf(data.courses[0], note).map((m) => m.title), ["Recursion"])
  const gone = removeCourseTopic(data, "crs_a", "tp1")
  assert.deepEqual(gone.notes[0].topicIds, [], "deleting a module unlinks its notes too")
  assert.ok(!validWorkspace({ ...data, notes: [{ ...note, topicIds: [3] as never }] }))
})
