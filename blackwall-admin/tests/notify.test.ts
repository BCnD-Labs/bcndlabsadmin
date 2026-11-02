import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { emptyWorkspace, type Collections } from "../shared/workspace.ts"
import { Notifier, localDay } from "../server/notify.ts"
import { FileConnectionStore } from "../server/store.ts"

const ts = "2026-11-01T00:00:00Z"
function setup(ws: Collections, opts: { now: () => number; up: () => boolean }) {
  const root = mkdtempSync(path.join(tmpdir(), "bw-notify-"))
  const store = new FileConnectionStore(root)
  const pushed: string[] = []
  const n = new Notifier({
    store,
    readWorkspace: async () => ({ data: ws }),
    checkServices: async (urls) => urls.map((url) => ({ url, up: opts.up(), ms: 12, error: opts.up() ? undefined : "ECONNREFUSED" })),
    now: opts.now,
    sendNtfy: async (_c, m) => void pushed.push(m.title),
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
