import assert from "node:assert/strict"
import { test } from "node:test"
import type { JournalEntry, Task } from "../src/lib/types.ts"
import { attachedReflections, learningReflections } from "../src/features/journal/reflection-lists.ts"
import { hasLearningAnswers, learningPreview, readLearningReflection, writeLearningReflection } from "../shared/learning-reflection.ts"

const t = "2026-11-09T10:00:00.000Z"
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, done: false, starred: false, createdAt: t, updatedAt: t, ...extra }) as Task
const item = (id: string, text: string, createdAt: string, extra: object = {}) => ({ id, text, createdAt, updatedAt: createdAt, ...extra })
const day = (id: string, entries: object[]): JournalEntry => ({ id, text: "", createdAt: t, updatedAt: t, entries } as JournalEntry)

test("learning reflections are written as the readable lines the Android app writes", () => {
  const text = writeLearningReflection({ clicked: "thesis first", fuzzy: "counter-arguments", next: "draft the outline", notes: "Ask about\nsources" })
  assert.equal(text, "## Learning reflection\nClicked: thesis first\nStill fuzzy: counter-arguments\nNext step: draft the outline\n\nNotes:\nAsk about\nsources")
  assert.deepEqual(readLearningReflection(text), { clicked: "thesis first", fuzzy: "counter-arguments", next: "draft the outline", notes: "Ask about\nsources" })
  // Text exactly as the Android app saved it reads the same.
  assert.deepEqual(readLearningReflection("## Learning reflection\nClicked: ratios"), { clicked: "ratios", fuzzy: "", next: "", notes: "" })
  assert.equal(writeLearningReflection({ clicked: "", fuzzy: "", next: "", notes: "" }), "## Learning reflection")
  assert.equal(writeLearningReflection({ clicked: "a\n  b", fuzzy: "", next: "", notes: "" }), "## Learning reflection\nClicked: a b")
})

test("an older plain reflection is kept whole as the notes, and previews show the first answer", () => {
  assert.deepEqual(readLearningReflection("Lectures made sense today.\nStill unsure about week 4."), { clicked: "", fuzzy: "", next: "", notes: "Lectures made sense today.\nStill unsure about week 4." })
  assert.equal(learningPreview("Lectures made sense today.\nMore"), "Lectures made sense today.")
  assert.equal(learningPreview(writeLearningReflection({ clicked: "", fuzzy: "week 4", next: "", notes: "x" })), "week 4")
  assert.equal(hasLearningAnswers({ clicked: " ", fuzzy: "", next: "", notes: "" }), false)
  assert.equal(hasLearningAnswers({ clicked: "", fuzzy: "", next: "", notes: "n" }), true)
})

test("learning reflections can be filtered to a course or a task, newest first", () => {
  const tasks = [task("t1", { courseId: "c1" }), task("t2", { courseId: "c2" })]
  const journal = [
    day("2026-11-08", [item("a", "x", "2026-11-08T09:00:00.000Z", { courseId: "c1" }), item("plain", "just a log line", t)]),
    day("2026-11-09", [item("b", "y", "2026-11-09T09:00:00.000Z", { taskId: "t1" }), item("c", "z", "2026-11-09T11:00:00.000Z", { taskId: "t2" })]),
  ]
  assert.deepEqual(learningReflections(journal, tasks).map((e) => e.item.id), ["c", "b", "a"])
  assert.deepEqual(learningReflections(journal, tasks, { courseId: "c1" }).map((e) => e.item.id), ["b", "a"])
  assert.deepEqual(learningReflections(journal, tasks, { taskId: "t2" }).map((e) => e.item.id), ["c"])
})

test("attached reflections gather from tasks, events and plain log entries only", () => {
  const r = (text: string, updatedAt: string) => ({ text, items: {}, updatedAt })
  const tasks = [task("t1", { due: "2026-11-05", reflection: r("went fine", "2026-11-05T10:00:00.000Z") }), task("e1", { kind: "event", scheduledDate: "2026-11-06", reflection: r("fun", "2026-11-07T10:00:00.000Z") }), task("t3")]
  const journal = [day("2026-11-08", [item("log1", "Gym", t, { reflection: r("felt strong", "2026-11-08T10:00:00.000Z") }), item("journal-daily-2026-11-08-morning", "check-in", t, { reflection: r("no", "2026-11-09T10:00:00.000Z") }), item("lrn1", "learning", t, { courseId: "c1", reflection: r("no", "2026-11-09T11:00:00.000Z") })])]
  const reviews = attachedReflections(tasks, journal)
  assert.deepEqual(reviews.map((x) => [x.kind, x.source]), [["Log", "Gym"], ["Event", "e1"], ["Task", "t1"]])
  assert.equal(reviews[2].day, "2026-11-05")
})
