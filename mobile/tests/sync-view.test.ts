import assert from "node:assert/strict"
import { test } from "node:test"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"
import { countUnsent } from "../src/lib/workspace-diff.ts"
import { toggleTask } from "../src/lib/shared.ts"
import { POLL_MS, SIGNED_OUT_POLL_MS, conflictRows, pollDelay, syncChip, todayKey } from "../src/native/data/sync-view.ts"
import { ADDRESS, fakeServer, memoryStore, note, task, ws } from "./workspace-fake.ts"

test("todayKey is the phone's local calendar date, padded", () => {
  assert.equal(todayKey(new Date(2026, 10, 3, 23, 59, 59)), "2026-11-03")
  assert.equal(todayKey(new Date(2026, 0, 5, 0, 0, 1)), "2026-01-05")
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/)
})

test("polling: every 20 s, sooner only while signed out", () => {
  assert.equal(POLL_MS, 20_000)
  for (const s of ["loading", "ok", "offline", "error", "conflict"] as const) assert.equal(pollDelay(s), POLL_MS)
  assert.equal(pollDelay("signed-out"), SIGNED_OUT_POLL_MS)
})

test("the chip says only what is known", () => {
  assert.deepEqual(syncChip("loading", false, 0), { label: "Loading…", tint: "grey", target: null })
  assert.equal(syncChip("ok", false, 0).label, "Synced")
  assert.equal(syncChip("ok", true, 1).label, "Saving…")
  assert.equal(syncChip("offline", false, 0).label, "Offline")
  assert.equal(syncChip("offline", true, 1).label, "Offline, 1 change waiting")
  assert.equal(syncChip("offline", true, 3).label, "Offline, 3 changes waiting")
  assert.equal(syncChip("offline", true, 0).label, "Offline, 1 change waiting")
  assert.deepEqual(syncChip("signed-out", false, 0), { label: "Signed out", tint: "red", target: "settings" })
  assert.equal(syncChip("signed-out", true, 2).label, "Signed out, 2 changes waiting")
  assert.equal(syncChip("conflict", true, 1).target, "conflict")
  assert.equal(syncChip("error", false, 0).target, "refresh")
  assert.equal(syncChip("error", true, 2).label, "Not saved, 2 changes waiting")
})

test("conflict rows name tasks and notes, from either side, and never invent a title", () => {
  const mine = ws({ tasks: [task("t1", { title: "Mine" })], notes: [note("n1", "First line\nsecond")] })
  const theirs = ws({ tasks: [task("t1", { title: "Theirs" }), task("t2", { title: "Only theirs" })] })
  const rows = conflictRows(["tasks: t1", "notes: n1", "tasks: t2", "tasks: gone", "weird"], mine, theirs)
  assert.deepEqual(rows.map((r) => r.label), ["Task: Mine", "Note: First line", "Task: Only theirs", "Task (no title)", "Record (no title)"])
  assert.equal(rows[0].id, "t1")
})

test("countUnsent counts added, changed and removed records in touched collections only", () => {
  const base = ws({ tasks: [task("a"), task("b"), task("c")], notes: [note("n")] })
  const local = ws({ tasks: [task("a", { done: true }), task("b"), task("d")], notes: [note("n", "edited")] })
  assert.equal(countUnsent(base, local, ["tasks"]), 3) // a changed, c removed, d added
  assert.equal(countUnsent(base, local, ["tasks", "notes"]), 4)
  assert.equal(countUnsent(base, base, ["tasks", "notes"]), 0)
})

test("client.pendingCount: edits made offline are counted, then cleared once saved", async () => {
  const server = fakeServer(ws({ tasks: [task("a"), task("b")] }))
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: memoryStore() })
  await client.load()
  assert.equal(client.pendingCount(), 0)
  server.down = true
  await client.mutate(["tasks"], (d) => toggleTask(d, "a"))
  await client.mutate(["tasks"], (d) => toggleTask(d, "b"))
  assert.equal(client.getState().status, "offline")
  assert.equal(client.pendingCount(), 2)
  server.down = false
  await client.flush()
  assert.equal(client.pendingCount(), 0)
  assert.equal(client.getState().pending, false)
  assert.equal(server.snap.data.tasks.every((x) => x.done), true)
})
