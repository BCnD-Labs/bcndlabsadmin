import assert from "node:assert/strict"
import { test } from "node:test"
import { createCourse, createTask, saveJournalItem, toggleTask, updateTask, reflectionToLog, type NewCourse } from "../src/lib/shared.ts"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"
import { buildNewTask, emptyDraft } from "../src/native/screens/planner/task-form.ts"
import { learningToday, upcomingLearning } from "../src/native/screens/learning/learning-view.ts"
import { weekStrip } from "../src/native/screens/planner/log/log-rules.ts"
import { fakeServer, memoryStore, ws, ADDRESS } from "./workspace-fake.ts"

const now = "2026-11-02T12:00:00Z"
const courseBase: NewCourse = { title: "Guitar", kind: "skill", code: "", instructor: "", instructorEmail: "", term: "", schedule: "Practice when free", location: "", url: "", description: "", tags: [], color: "blue" }

test("a learning week spans twelve tasks/events, deadlines, logs, reflection and an offline round trip", async () => {
  const options = { now: () => now }
  let data = createCourse(ws(), courseBase, { ...options, makeId: () => "skill" }).data
  for (let i = 0; i < 12; i++) {
    const day = `2026-11-${String(2 + i % 7).padStart(2, "0")}`
    const draft = emptyDraft(day, i % 3 === 0 ? "event" : "task")
    draft.title = `Practice ${i}`; draft.extras!.courseId = "skill"; draft.extras!.learningType = i % 3 === 0 ? "event" : "assignment"
    data = createTask(data, buildNewTask(draft, now), { ...options, makeId: () => `task${i}` }).data
  }
  for (let n = 2; n <= 8; n++) {
    const day = `2026-11-${String(n).padStart(2, "0")}`
    data = saveJournalItem(data, day, { id: `entry${n}`, text: `Day ${n}: practised`, createdAt: now, updatedAt: now }, n === 4, options)
  }
  data = updateTask(data, "task1", { scheduledDate: "2026-11-04", scheduledTime: "16:00" }, options)
  const due = data.tasks.find(task => task.id === "task1")!.due
  data = reflectionToLog(data, "task1", "2026-11-04", { reflection: { text: "Slow practice helped", items: { difficulty: "Moderate" }, updatedAt: now } }, options)
  data = toggleTask(toggleTask(data, "task1", options), "task1", options)
  assert.equal(data.tasks.find(task => task.id === "task1")!.due, due)
  assert.equal(data.tasks.find(task => task.id === "task1")!.done, false)
  assert.equal(data.tasks.length, 12); assert.equal(data.journal.length, 7); assert.equal(data.notes.length, 1)
  assert.ok(weekStrip("2026-11-04", "2026-11-04", data.journal, {}).every(day => day.has))
  assert.ok(learningToday(data.courses, data.tasks, "2026-11-04").schedule.some(task => task.id === "task1"))
  assert.ok(upcomingLearning(data.courses, data.tasks, "2026-11-02").some(row => row.id === "planned-task1"))
  const server = fakeServer(data), store = memoryStore()
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store })
  await client.load(); server.down = true
  await client.mutate(["tasks"], current => toggleTask(current, "task2", options))
  assert.equal(client.getState().pending, true)
  server.down = false; await client.flush()
  assert.equal(client.getState().pending, false)
  assert.equal(server.snap.data.tasks.find(task => task.id === "task2")!.done, true)
})
