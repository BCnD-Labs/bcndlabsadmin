import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
// The REAL server API (loaded inside the test) and the real shared record rules from blackwall-admin. Node runs
// the .ts directly and mobile's tsconfig excludes tests/, so nothing here is typechecked against the server.
// The server needs blackwall-admin's own packages (marked, nodemailer, pg), so this test only runs where
// `npm --prefix blackwall-admin ci` has run too; otherwise it is reported as skipped, never failed.
import type { WorkspaceStore } from "../../blackwall-admin/server/workspace.ts"
import { createTask, toggleStar, toggleTask } from "../../blackwall-admin/shared/records.ts"
import { emptyWorkspace, type Collections, type WorkspaceSnapshot } from "../src/lib/shared.ts"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"
import { memoryStore, note } from "./workspace-fake.ts"

/** The server's WorkspaceStore contract, in memory: same revision check as FileWorkspaceStore. */
class MemoryWorkspaceStore implements WorkspaceStore {
  snapshot: WorkspaceSnapshot = { id: "api-test-db", revision: 0, data: emptyWorkspace() }
  async readWorkspace() { return structuredClone(this.snapshot) }
  async writeWorkspace(id: string, revision: number, data: Collections) {
    if (this.snapshot.id !== id || this.snapshot.revision !== revision) return null
    this.snapshot = { id, revision: revision + 1, data: structuredClone(data) }
    return structuredClone(this.snapshot)
  }
}

const adminDeps = existsSync(path.join(import.meta.dirname, "../../blackwall-admin/node_modules/marked"))

test("integration: the client against the real server API (sign-in cookie, revisions, 409 merge, conflict)", { skip: adminDeps ? false : "blackwall-admin packages are not installed" }, async () => {
  const { createApi } = await import("../../blackwall-admin/server/app.ts")
  const { hashPassword, Sessions } = await import("../../blackwall-admin/server/auth.ts")
  const { FileConnectionStore } = await import("../../blackwall-admin/server/store.ts")
  const root = mkdtempSync(path.join(tmpdir(), "bw-mobile-client-"))
  const workspace = new MemoryWorkspaceStore()
  const sessions = new Sessions(Buffer.alloc(32, 7))
  const api = createApi({ store: new FileConnectionStore(root), workspace, auth: { sessions, passwordHash: hashPassword("test-password") } })
  const server = createServer((req, res) => { void api(req, res) })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = `http://127.0.0.1:${(server.address() as { port: number }).port}/`
  // Node's fetch has no cookie jar; this is what Android's shared cookie store does for the app.
  const cookie = sessions.issue(false).split(";")[0]
  const withCookie = ((url: string, init: RequestInit) => fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Cookie: cookie } })) as typeof fetch
  const make = () => createWorkspaceClient({ address, fetchImpl: withCookie, store: memoryStore() })
  try {
    // Signed out: the real server answers 401.
    assert.equal((await createWorkspaceClient({ address }).load()).status, "signed-out")

    // load, then add and toggle a task with the shared record rules: each save is a new revision on the real server.
    const a = make()
    const loaded = await a.load()
    assert.equal(loaded.status, "ok")
    assert.equal(loaded.snapshot?.revision, 0)
    let taskId = ""
    const created = await a.mutate(["tasks"], (d) => {
      const r = createTask(d, { title: "Read chapter 4", starred: false, done: false })
      taskId = r.record.id
      return { ...d, ...r.data }
    })
    assert.equal(created.status, "ok")
    assert.equal(workspace.snapshot.revision, 1)
    const toggled = await a.mutate(["tasks"], (d) => ({ ...d, ...toggleTask(d, taskId) }))
    assert.equal(toggled.status, "ok")
    assert.equal(workspace.snapshot.revision, 2)
    assert.equal(workspace.snapshot.data.tasks[0].done, true)
    assert.ok(workspace.snapshot.data.tasks[0].completedAt)

    // A second client loads at revision 2, then client A saves again: B is now stale.
    const b = make()
    assert.equal((await b.load()).snapshot?.revision, 2)
    await a.mutate(["tasks"], (d) => ({ ...d, ...toggleStar(d, taskId) }))
    assert.equal(workspace.snapshot.revision, 3)

    // B edits a different collection with its stale revision: real 409, re-read, clean merge, saved as revision 4.
    const merged = await b.mutate(["notes"], (d) => ({ ...d, notes: [note("n-from-b", "hello"), ...d.notes] }))
    assert.equal(merged.status, "ok")
    assert.equal(workspace.snapshot.revision, 4)
    assert.equal(workspace.snapshot.data.notes[0].id, "n-from-b")
    assert.equal(workspace.snapshot.data.tasks[0].starred, true, "A's star was not overwritten by B's stale copy")
    assert.equal(merged.snapshot?.data.tasks[0].starred, true, "and B now shows it")

    // Same record edited on both: B (stale again) gets a conflict from the real merge and nothing is written.
    await a.load()
    await b.load()
    await a.mutate(["tasks"], (d) => ({ ...d, ...toggleTask(d, taskId) }))
    const before = workspace.snapshot.revision
    const clash = await b.mutate(["tasks"], (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, title: "Renamed on the phone", updatedAt: "2026-11-03T00:00:00Z" } : t)) }))
    assert.equal(clash.status, "conflict")
    assert.deepEqual(clash.conflicts, [`tasks: ${taskId}`])
    assert.equal(workspace.snapshot.revision, before, "a conflict never writes")
    const resolved = await b.resolveConflict("mine")
    assert.equal(resolved.status, "ok")
    assert.equal(workspace.snapshot.revision, before + 1)
    assert.equal(workspace.snapshot.data.tasks[0].title, "Renamed on the phone")
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    rmSync(root, { recursive: true, force: true })
  }
})
