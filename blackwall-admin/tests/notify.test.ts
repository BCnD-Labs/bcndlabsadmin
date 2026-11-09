import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { emptyWorkspace, type Collections } from "../shared/workspace.ts"
import { Notifier, localDay } from "../server/notify.ts"
import { FileConnectionStore } from "../server/store.ts"

const ts = "2026-11-01T00:00:00Z"
function setup(ws: Collections, opts: { now: () => number; up: () => boolean; pushFails?: boolean }) {
  const root = mkdtempSync(path.join(tmpdir(), "bw-notify-"))
  const store = new FileConnectionStore(root)
  const pushed: string[] = []
  const n = new Notifier({
    store,
    readWorkspace: async () => ({ data: ws }),
    checkServices: async (urls) => urls.map((url) => ({ url, up: opts.up(), ms: 12, error: opts.up() ? undefined : "ECONNREFUSED" })),
    now: opts.now,
    sendNtfy: async (_c, m) => { if (opts.pushFails) throw Error("ntfy unavailable"); pushed.push(m.title) },
  })
  return { n, store, pushed, done: () => rmSync(root, { recursive: true, force: true }) }
}

test("services: first sight is quiet; down needs two failed checks; recovery is announced", async () => {
  let up = true
  const ws = { ...emptyWorkspace(), services: [{ id: "s", name: "Portainer", url: "https://p.test", description: "", group: "Infra", pinned: false, createdAt: ts, updatedAt: ts }] }
  const t = setup(ws, { now: () => Date.parse("2026-11-02T03:00:00Z"), up: () => up })
  await t.store.create({ provider: "ntfy", label: "ntfy", config: { url: "https://ntfy.test", topic: "x" }, secrets: {} })
  const c = (await t.store.list())[0]
  await t.store.setResult(c.id, { status: "ok" })
  await t.n.tick()
  assert.equal((await t.n.feed()).length, 0, "starting up never floods")
  up = false
  await t.n.tick()
  assert.equal((await t.n.feed()).length, 0, "one failed check isn't down yet")
  await t.n.tick()
  assert.deepEqual((await t.n.feed()).map((f) => f.title), ["Portainer is down"])
  assert.deepEqual(t.pushed, ["Portainer is down"], "pushed to ntfy by default")
  up = true
  await t.n.tick()
  assert.equal((await t.n.feed())[0].title, "Portainer is back")
  t.done()
})

test("rules: turning a channel off stops it; the daily summary waits for its hour in your time zone", async () => {
  let now = Date.parse("2026-11-02T12:00:00Z") // 06:00 in Chicago
  const ws = { ...emptyWorkspace(), tasks: [
    { id: "a", title: "Lab report", due: "2026-11-02", starred: false, done: false, createdAt: ts, updatedAt: ts },
    { id: "b", title: "Renew cert", due: "2026-10-30", starred: false, done: false, createdAt: ts, updatedAt: ts },
  ] }
  const t = setup(ws, { now: () => now, up: () => true })
  await t.n.saveSettings({ rules: { "work.digest": ["bell"] }, digestHour: 8, timeZone: "America/Chicago" })
  await t.n.tick()
  assert.equal((await t.n.feed()).length, 0, "before 8 AM local")
  now = Date.parse("2026-11-02T14:30:00Z") // 08:30 Chicago
  await t.n.tick()
  const feed = await t.n.feed()
  assert.equal(feed.length, 1)
  assert.equal(feed[0].title, "1 item due today, 1 overdue")
  assert.deepEqual(t.pushed, [], "ntfy was turned off for the summary")
  await t.n.tick()
  assert.equal((await t.n.feed()).length, 1, "once a day")
  assert.equal(localDay(now, "America/Chicago"), "2026-11-02")
  t.done()
})

test("feed: mark one or all read", async () => {
  const t = setup(emptyWorkspace(), { now: () => Date.now(), up: () => true })
  await t.n.emit("system.update", { title: "A", body: "" }, { force: ["bell"] })
  await t.n.emit("system.update", { title: "B", body: "" }, { force: ["bell"] })
  const [b] = await t.n.feed()
  assert.equal((await t.n.markRead([b.id])).filter((x) => !x.read).length, 1)
  assert.equal((await t.n.markRead("all")).filter((x) => !x.read).length, 0)
  t.done()
})

test("the Mac feed records only successful ntfy deliveries", async () => {
  const t = setup(emptyWorkspace(), { now: () => Date.parse(ts), up: () => true })
  const connection = await t.store.create({ provider: "ntfy", label: "ntfy", config: { url: "https://ntfy.test", topic: "x" }, secrets: {} })
  await t.store.setResult(connection.id, { status: "ok" })
  await t.n.emit("work.digest", { title: "Sent", body: "Due work" }, { force: ["ntfy"] })
  assert.ok((await t.n.feed())[0].ntfyAt, "ntfy-only delivery appears in the Mac feed")
  await t.n.emit("work.digest", { title: "Bell only", body: "Due work" }, { force: ["bell"] })
  assert.equal((await t.n.feed())[0].ntfyAt, undefined)
  t.done()

  const failed = setup(emptyWorkspace(), { now: () => Date.parse(ts), up: () => true, pushFails: true })
  const broken = await failed.store.create({ provider: "ntfy", label: "ntfy", config: { url: "https://ntfy.test", topic: "x" }, secrets: {} })
  await failed.store.setResult(broken.id, { status: "ok" })
  await failed.n.emit("work.digest", { title: "Not sent", body: "Due work" }, { force: ["ntfy"] })
  assert.equal((await failed.n.feed()).length, 0, "failed ntfy delivery does not appear")
  failed.done()
})

test("learning reminders: class 15 minutes ahead (once), start-by day, planned steps, and a study-plan nudge once per exam", async () => {
  const course = { id: "crs", title: "Data Structures", code: "CS 2110", instructor: "", instructorEmail: "", term: "Fall", schedule: "", location: "", url: "", description: "", tags: [], color: "blue" as const, createdAt: ts, updatedAt: ts, meetings: [{ id: "m1", kind: "class" as const, days: [1], start: "10:00", end: "11:15", location: "Hall 2" }, { id: "m2", kind: "office" as const, days: [1], start: "10:05", end: "11:00" }] }
  const hw = { id: "hw", title: "Project", courseId: "crs", learningType: "assignment" as const, due: "2026-11-12", effort: "medium" as const, starred: false, done: false, createdAt: ts, updatedAt: ts }
  const exam = { id: "ex", title: "Midterm", courseId: "crs", learningType: "exam" as const, due: "2026-11-16", starred: false, done: false, createdAt: ts, updatedAt: ts }
  const withSteps = { id: "t3", title: "Essay", courseId: "crs", learningType: "assignment" as const, due: "2026-11-30", starred: false, done: false, createdAt: ts, updatedAt: ts, subtasks: [{ id: "s1", title: "Outline", done: false, date: "2026-11-09" }] }
  // 2026-11-09 is a Monday. Chicago is UTC-6 in November.
  let now = Date.parse("2026-11-09T15:30:00Z") // 09:30 Chicago, before the 10:00 class
  const t = setup({ ...emptyWorkspace(), courses: [course], tasks: [hw, exam, withSteps] }, { now: () => now, up: () => true })
  await t.n.saveSettings({ rules: {}, digestHour: 8, timeZone: "America/Chicago" })
  await t.n.tick()
  const titles = async () => (await t.n.feed()).map((f) => f.title)
  assert.ok(!(await titles()).some((x) => x.startsWith("Data Structures")), "30 minutes before class is too early to remind")
  now = Date.parse("2026-11-09T15:50:00Z") // 09:50
  await t.n.tick()
  await t.n.tick()
  const all = await titles()
  assert.equal(all.filter((x) => x === "Data Structures starts in 10 min").length, 1, "class reminder once, not for office hours")
  assert.ok(all.includes("Time to start: Project"), "hw is due 3 days after start-by (Nov 9)")
  assert.ok(all.includes("1 step planned for today"))
  assert.ok(all.includes("Plan your studying: Midterm"))
  now = Date.parse("2026-11-10T15:50:00Z")
  await t.n.tick()
  assert.equal((await titles()).filter((x) => x.startsWith("Plan your studying")).length, 1, "the study nudge is once per exam")
  t.done()
})
