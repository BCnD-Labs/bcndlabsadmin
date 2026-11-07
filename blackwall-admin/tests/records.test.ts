import assert from "node:assert/strict"
import { test } from "node:test"
import { createNote, createTask, defaultMakeId, moveJournal, removeCourseRecords, removeNote, removeTask, saveJournal, saveJournalItem, toggleStar, togglePin, toggleTask, updateNote, updateTask } from "../shared/records.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import type { Note, Task } from "../src/lib/types.ts"

const T0 = "2026-11-01T08:00:00.000Z"
const T1 = "2026-11-02T09:30:00.000Z"
let counter = 0
const opts = (at = T1) => ({ now: () => at, makeId: (prefix: string) => `${prefix}_fixed${++counter}` })
const task = (patch: Partial<Task> = {}): Task => ({ id: "t1", title: "Read chapter", starred: false, done: false, createdAt: T0, updatedAt: T0, ...patch })
const note = (patch: Partial<Note> = {}): Note => ({ id: "n1", text: "Sticky", color: "plain", pinned: false, createdAt: T0, updatedAt: T0, ...patch })
const frozen = <T>(value: T): T => JSON.parse(JSON.stringify(value))

test("createTask prepends a task with the tsk prefix and one timestamp for created and updated", () => {
  const data = { tasks: [task()] }
  const before = frozen(data)
  const made = createTask(data, { title: "New", starred: true, done: false, due: "2026-11-05" }, opts())
  assert.match(made.record.id, /^tsk_fixed\d+$/)
  assert.deepEqual(made.record, { title: "New", starred: true, done: false, due: "2026-11-05", id: made.record.id, createdAt: T1, updatedAt: T1 })
  assert.deepEqual(made.data.tasks.map((x) => x.id), [made.record.id, "t1"])
  assert.deepEqual(data, before, "input is not mutated")
  assert.match(createTask({ tasks: [] }, { title: "x", starred: false, done: false }).record.id, /^tsk_[a-z0-9]{8}$/, "default id generator")
  assert.match(defaultMakeId("zzz"), /^zzz_/)
})

test("updateTask merges the patch, stamps updatedAt and ignores unknown ids", () => {
  const data = { tasks: [task(), task({ id: "t2", title: "Other" })], extra: "kept" }
  const before = frozen(data)
  const next = updateTask(data, "t1", { title: "Renamed", scheduledDate: "2026-11-03", scheduledTime: "14:00", durationMinutes: 30 }, opts())
  assert.deepEqual(next.tasks[0], { ...task(), title: "Renamed", scheduledDate: "2026-11-03", scheduledTime: "14:00", durationMinutes: 30, updatedAt: T1 })
  assert.deepEqual(next.tasks[1], data.tasks[1], "other tasks untouched")
  assert.equal(next.extra, "kept", "unrelated keys carried through")
  assert.deepEqual(data, before)
  assert.deepEqual(updateTask(data, "missing", { title: "x" }, opts()).tasks, data.tasks)
  assert.ok("due" in updateTask(data, "t1", { due: undefined }, opts()).tasks[0], "an explicit undefined stays an explicit key, as in the store")
})

test("toggleTask completes with completedAt and reopens by clearing it, both ways", () => {
  const data = { tasks: [task()] }
  const done = toggleTask(data, "t1", opts(T1))
  assert.equal(done.tasks[0].done, true)
  assert.equal(done.tasks[0].completedAt, T1)
  assert.equal(done.tasks[0].updatedAt, T1)
  const reopened = toggleTask(done, "t1", opts("2026-11-03T00:00:00.000Z"))
  assert.equal(reopened.tasks[0].done, false)
  assert.equal(reopened.tasks[0].completedAt, undefined)
  assert.equal(reopened.tasks[0].updatedAt, "2026-11-03T00:00:00.000Z")
  assert.equal(data.tasks[0].done, false, "input is not mutated")
  assert.equal(done.tasks[0].completedAt, T1, "the intermediate result is not mutated either")
  assert.deepEqual(toggleTask(data, "missing", opts()).tasks, data.tasks)
})

test("toggleStar flips starred only", () => {
  const data = { tasks: [task()] }
  const starred = toggleStar(data, "t1", opts())
  assert.deepEqual(starred.tasks[0], { ...task(), starred: true, updatedAt: T1 })
  assert.equal(toggleStar(starred, "t1", opts()).tasks[0].starred, false)
  assert.equal(data.tasks[0].starred, false)
})

test("removeTask deletes only that task and leaves notes, journal and links alone", () => {
  const linked = task({ id: "t2", recordLinks: [{ kind: "task", id: "t1" }, { kind: "note", id: "n1" }] })
  const data = { ...emptyWorkspace(), tasks: [task(), linked], notes: [note()], journal: [{ id: "2026-11-02", text: "log", createdAt: T0, updatedAt: T0 }] }
  const before = frozen(data)
  const next = removeTask(data, "t1")
  assert.deepEqual(next.tasks, [linked], "links in other records are not rewritten (the web store does not)")
  assert.deepEqual(next.notes, data.notes)
  assert.deepEqual(next.journal, data.journal)
  assert.deepEqual(data, before)
})

test("notes: create, update, pin toggle and remove", () => {
  const data = { notes: [note()] }
  const before = frozen(data)
  const made = createNote(data, { text: "Fresh", color: "teal", pinned: false }, opts())
  assert.match(made.record.id, /^nte_fixed\d+$/)
  assert.deepEqual(made.data.notes.map((x) => x.id), [made.record.id, "n1"])
  assert.equal(made.record.createdAt, T1)
  const edited = updateNote(made.data, "n1", { text: "Changed", color: "rose", courseId: "c1" }, opts("2026-11-04T00:00:00.000Z"))
  assert.deepEqual(edited.notes[1], { ...note(), text: "Changed", color: "rose", courseId: "c1", updatedAt: "2026-11-04T00:00:00.000Z" })
  assert.equal(edited.notes[0], made.data.notes[0], "other notes keep their identity")
  const pinned = togglePin(edited, "n1", opts())
  assert.equal(pinned.notes[1].pinned, true)
  assert.equal(togglePin(pinned, "n1", opts()).notes[1].pinned, false)
  assert.deepEqual(removeNote(pinned, "n1").notes.map((x) => x.id), [made.record.id])
  assert.deepEqual(data, before)
  assert.deepEqual(updateNote(data, "nope", { text: "x" }, opts()).notes, data.notes)
})

test("removeCourseRecords deletes coursework and unlinks notes, keeping everything else", () => {
  const data = {
    tasks: [task({ id: "a", courseId: "c1", learningType: "exam" }), task({ id: "b", courseId: "c2" }), task({ id: "c" })],
    notes: [note({ id: "x", courseId: "c1" }), note({ id: "y", courseId: "c2" }), note({ id: "z" })],
  }
  const before = frozen(data)
  const next = removeCourseRecords(data, "c1")
  assert.deepEqual(next.tasks.map((x) => x.id), ["b", "c"])
  assert.deepEqual(next.notes.map((x) => [x.id, x.courseId]), [["x", undefined], ["y", "c2"], ["z", undefined]])
  assert.equal(next.notes[0].updatedAt, T0, "unlinking does not restamp the note, as in the store")
  assert.deepEqual(data, before)
})

test("saveJournal upserts by date and deletes on blank text", () => {
  const data = { journal: [{ id: "2026-11-01", text: "one", createdAt: T0, updatedAt: T0 }] }
  const before = frozen(data)
  const added = saveJournal(data, "2026-11-02", "two", opts())
  assert.deepEqual(added.journal[1], { id: "2026-11-02", text: "two", createdAt: T1, updatedAt: T1 })
  const edited = saveJournal(added, "2026-11-02", "two!", opts("2026-11-05T00:00:00.000Z"))
  assert.deepEqual(edited.journal[1], { id: "2026-11-02", text: "two!", createdAt: T1, updatedAt: "2026-11-05T00:00:00.000Z" })
  assert.deepEqual(saveJournal(edited, "2026-11-02", "  \n ", opts()).journal.map((x) => x.id), ["2026-11-01"])
  assert.deepEqual(saveJournal(data, "2026-12-31", "", opts()).journal, data.journal, "blank text for a missing day is a no-op")
  assert.deepEqual(data, before)
})

test("older journal text edits preserve learning links unless explicitly cleared", () => {
  const original = { id: "lrn_1", text: "Clicked: Wind", courseId: "course-1", taskId: "task-1", createdAt: T0, updatedAt: T0 }
  const data = { ...emptyWorkspace(), journal: [{ id: "2026-11-02", text: "", entries: [original], createdAt: T0, updatedAt: T0 }] }
  const edited = saveJournalItem(data, "2026-11-02", { id: original.id, text: "Clicked: Gas", createdAt: T0, updatedAt: T1 }, false, opts())
  assert.equal(edited.journal[0].entries?.[0].courseId, "course-1")
  assert.equal(edited.journal[0].entries?.[0].taskId, "task-1")
  const unlinked = saveJournalItem(edited, "2026-11-02", { id: original.id, text: "Clicked: Gas", createdAt: T0, updatedAt: T1, courseId: "course-1", taskId: undefined }, false, opts())
  assert.equal(unlinked.journal[0].entries?.[0].taskId, undefined)
})
test("moveJournal moves, appends onto an existing day, and ignores bad moves", () => {
  const entry = (id: string, text: string) => ({ id, text, createdAt: T0, updatedAt: T0 })
  const data = { journal: [entry("2026-11-01", "a"), entry("2026-11-02", "b")] }
  const before = frozen(data)
  const merged = moveJournal(data, "2026-11-01", "2026-11-02", opts())
  assert.deepEqual(merged.journal.map((x) => [x.id, x.text]), [["2026-11-02", "b\n\na"]])
  const moved = moveJournal(data, "2026-11-01", "2026-11-09", opts())
  assert.deepEqual(moved.journal.map((x) => [x.id, x.text]), [["2026-11-02", "b"], ["2026-11-09", "a"]])
  assert.equal(moveJournal(data, "2026-11-01", "2026-11-01", opts()), data)
  assert.equal(moveJournal(data, "2026-10-01", "2026-11-02", opts()), data)
  assert.deepEqual(data, before)
})

test("records from an older-shape workspace (no optional fields) work and still validate", () => {
  // A v3-era snapshot: tasks and notes carry none of the Planner, link or course fields.
  const old = { ...emptyWorkspace(), tasks: [{ id: "old", title: "Legacy", done: false, starred: false, createdAt: T0, updatedAt: T0 }], notes: [{ id: "oldn", text: "Legacy note", color: "plain", pinned: false, createdAt: T0, updatedAt: T0 }] }
  assert.ok(validWorkspace(frozen(old)))
  let data = toggleTask(old, "old", opts())
  data = updateTask(data, "old", { scheduledDate: "2026-11-03" }, opts())
  data = createTask(data, { title: "Fresh", starred: false, done: false }, opts()).data
  data = togglePin(updateNote(data, "oldn", { text: "Edited" }, opts()), "oldn", opts())
  data = removeCourseRecords(data, "no-such-course")
  data = saveJournal(data, "2026-11-02", "Log", opts())
  assert.ok(validWorkspace(frozen(data)), "result is a valid workspace")
  assert.equal(data.tasks.find((x) => x.id === "old")?.completedAt, T1)
  assert.deepEqual(removeNote(removeTask(data, "old"), "oldn").tasks.map((x) => x.title), ["Fresh"])
})
