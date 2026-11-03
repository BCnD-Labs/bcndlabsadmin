import assert from "node:assert/strict"
import { test } from "node:test"
import { createCourse, createTask, emptyWorkspace, updateCourse, validWorkspace, type NewCourse } from "../src/lib/shared.ts"
import { buildNewTask, emptyDraft } from "../src/native/screens/planner/task-form.ts"
import { emptyExtras } from "../src/native/screens/planner/task-extras.ts"

const now = "2026-11-03T12:00:00.000Z"
const input: NewCourse = {
  kind: "reading", title: "Design of Everyday Things", code: "", instructor: "Don Norman",
  instructorEmail: "", term: "", schedule: "", location: "", url: "", description: "",
  tags: [], color: "blue", pagesRead: 20, pagesTotal: 350,
}

test("a new learning record and its course-linked task are valid workspace data", () => {
  const created = createCourse(emptyWorkspace(), input, { makeId: () => "crs_a", now: () => now })
  assert.equal(created.record.id, "crs_a")
  assert.equal(created.record.pagesRead, 20)
  const draft = { ...emptyDraft(), title: "Read chapter 2", extras: { ...emptyExtras(), courseId: created.record.id } }
  const task = createTask(created.data, buildNewTask(draft, now), { makeId: () => "tsk_a", now: () => now }).data
  assert.equal(task.tasks[0].courseId, "crs_a")
  assert.ok(validWorkspace(task))
})

test("editing an older course preserves its unedited fields and absent kind", () => {
  const old = createCourse(emptyWorkspace(), { ...input, kind: undefined, pagesRead: undefined, pagesTotal: undefined, title: "Old class", code: "CS 101" }, { makeId: () => "crs_old", now: () => now }).data
  const next = updateCourse(old, "crs_old", { title: "Updated class" }, { now: () => "2026-11-04T12:00:00.000Z" })
  assert.equal(next.courses[0].code, "CS 101")
  assert.equal(next.courses[0].kind, undefined)
  assert.equal(next.courses[0].title, "Updated class")
  assert.equal(old.courses[0].title, "Old class")
  assert.ok(validWorkspace(next))
})
