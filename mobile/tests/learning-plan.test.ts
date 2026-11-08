import assert from "node:assert/strict"
import { test } from "node:test"
import { addSubtasks, applyFocusPlan, emptyWorkspace, studyPlan, toggleSubtask, weekLoad, isMeetingId, meetingEvents, planWeek, setTaskStatus, todayPlan, validWorkspace, type Collections } from "../src/lib/shared.ts"
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

// Mac and phone are two clients of one server workspace; class times, status and plans made on one show up on the other.
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import type { WorkspaceStore } from "../../blackwall-admin/server/workspace.ts"
import { createCourse, createTask } from "../../blackwall-admin/shared/records.ts"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"
import { memoryStore } from "./workspace-fake.ts"
import type { WorkspaceSnapshot } from "../src/lib/shared.ts"

class MemoryStore implements WorkspaceStore {
  snapshot: WorkspaceSnapshot = { id: "learning-sync", revision: 0, data: emptyWorkspace() }
  async readWorkspace() { return structuredClone(this.snapshot) }
  async writeWorkspace(id: string, revision: number, d: Collections) {
    if (this.snapshot.id !== id || this.snapshot.revision !== revision) return null
    this.snapshot = { id, revision: revision + 1, data: structuredClone(d) }
    return structuredClone(this.snapshot)
  }
}
const adminDeps = existsSync(path.join(import.meta.dirname, "../../blackwall-admin/node_modules/marked"))

test("integration: class times, status and a week plan made on the Mac reach the phone and back through the real server", { skip: adminDeps ? false : "blackwall-admin packages are not installed" }, async () => {
  const { createApi } = await import("../../blackwall-admin/server/app.ts")
  const { hashPassword, Sessions } = await import("../../blackwall-admin/server/auth.ts")
  const { FileConnectionStore } = await import("../../blackwall-admin/server/store.ts")
  const root = mkdtempSync(path.join(tmpdir(), "bw-learning-sync-"))
  const workspace = new MemoryStore()
  const sessions = new Sessions(Buffer.alloc(32, 9))
  const api = createApi({ store: new FileConnectionStore(root), workspace, auth: { sessions, passwordHash: hashPassword("test-password") } })
  const server = createServer((req, res) => { void api(req, res) })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = `http://127.0.0.1:${(server.address() as { port: number }).port}/`
  const cookie = sessions.issue(false).split(";")[0]
  const withCookie = ((url: string, init: RequestInit) => fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Cookie: cookie } })) as typeof fetch
  const make = () => createWorkspaceClient({ address, fetchImpl: withCookie, store: memoryStore() })
  try {
    const mac = make(), phone = make()
    await mac.load()
    let courseId = "", taskId = ""
    const made = await mac.mutate(["courses", "tasks"], (d) => {
      const c = createCourse(d, { title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall 2026", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", startDate: "2026-08-24", endDate: "2026-12-18", meetings: course.meetings })
      courseId = c.record.id
      const t = createTask(c.data, { title: "Lab 5", courseId, learningType: "assignment", due: "2026-11-12", effort: "quick", starred: false, done: false })
      taskId = t.record.id
      return { ...d, ...t.data }
    })
    assert.equal(made.status, "ok")

    const seen = (await phone.load()).snapshot!.data
    assert.equal(seen.courses[0].meetings?.[0].location, "Hall 2", "class times reach the phone")
    assert.equal(meetingEvents(seen.courses, "2026-11-09", "2026-11-09")[0].scheduledTime, "10:00")

    const planned = planWeek(seen, "2026-11-09")
    assert.equal((await phone.mutate(["tasks"], (d) => applyFocusPlan(d, planned.map((p) => ({ id: p.task.id, date: p.date }))))).status, "ok")
    assert.equal((await phone.mutate(["tasks"], (d) => setTaskStatus(d, taskId, "submitted"))).status, "ok")

    const back = (await mac.load()).snapshot!.data
    const row = back.tasks.find((t) => t.id === taskId)!
    assert.equal(row.focusDate, "2026-11-11", "the phone's plan reaches the Mac")
    assert.equal(row.status, "submitted")
    assert.equal(row.done, true, "submitted on the phone is done on the Mac")
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    rmSync(root, { recursive: true, force: true })
  }
})

test("topics, steps and a study plan made on the Mac reach the phone, and ticking a step on the phone reaches the Mac", { skip: adminDeps ? false : "blackwall-admin packages are not installed" }, async () => {
  const { createApi } = await import("../../blackwall-admin/server/app.ts")
  const { hashPassword, Sessions } = await import("../../blackwall-admin/server/auth.ts")
  const { FileConnectionStore } = await import("../../blackwall-admin/server/store.ts")
  const root = mkdtempSync(path.join(tmpdir(), "bw-steps-sync-"))
  const workspace = new MemoryStore()
  const sessions = new Sessions(Buffer.alloc(32, 7))
  const api = createApi({ store: new FileConnectionStore(root), workspace, auth: { sessions, passwordHash: hashPassword("test-password") } })
  const server = createServer((req, res) => { void api(req, res) })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = `http://127.0.0.1:${(server.address() as { port: number }).port}/`
  const cookie = sessions.issue(false).split(";")[0]
  const withCookie = ((url: string, init: RequestInit) => fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Cookie: cookie } })) as typeof fetch
  const make = () => createWorkspaceClient({ address, fetchImpl: withCookie, store: memoryStore() })
  try {
    const mac = make(), phone = make()
    await mac.load()
    let examId = ""
    const made = await mac.mutate(["courses", "tasks"], (d) => {
      const c = createCourse(d, { title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall 2026", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", topics: [{ id: "tp1", title: "Recursion" }, { id: "tp2", title: "Trees" }] })
      const t = createTask(c.data, { title: "Midterm", courseId: c.record.id, learningType: "exam", due: "2026-11-16", topicIds: ["tp1", "tp2"], starred: false, done: false })
      examId = t.record.id
      const plan = studyPlan({ tasks: t.data.tasks, courses: t.data.courses }, examId, "2026-11-09")
      return { ...d, ...addSubtasks(t.data, examId, plan) }
    })
    assert.equal(made.status, "ok")
    const seen = (await phone.load()).snapshot!.data
    const exam = seen.tasks.find((t) => t.id === examId)!
    assert.deepEqual(seen.courses[0].topics!.map((t) => t.title), ["Recursion", "Trees"], "topics reach the phone")
    assert.deepEqual(exam.subtasks!.map((s) => s.title), ["Review: Recursion", "Review: Trees", "Final review"], "the Mac's study plan reaches the phone")
    assert.equal(weekLoad(seen, "2026-11-09").flatMap((d) => d.steps).length, 3, "and shows on the phone's week")
    const first = exam.subtasks![0]
    assert.equal((await phone.mutate(["tasks"], (d) => toggleSubtask(d, examId, first.id))).status, "ok")
    const back = (await mac.load()).snapshot!.data.tasks.find((t) => t.id === examId)!
    assert.equal(back.subtasks![0].done, true, "a step ticked on the phone is ticked on the Mac")
    assert.equal(back.status, "in_progress", "and starts the exam")
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    rmSync(root, { recursive: true, force: true })
  }
})
