import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createServer } from "node:http"
import { test } from "node:test"
import { emptyWorkspace, mergeWorkspace, same, validWorkspace } from "../shared/workspace.ts"
import { FileWorkspaceStore } from "../server/workspace.ts"
import { FileConnectionStore } from "../server/store.ts"
import { createApi } from "../server/app.ts"
import { hashPassword, Sessions } from "../server/auth.ts"

const note = (id: string, text = id) => ({ id, text, pinned: false, color: "plain" as const, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" })
test("three-way merge preserves independent edits, additions, and deletions", () => {
  const base = { ...emptyWorkspace(), notes: [note("a"), note("b"), note("delete")] }
  const local = { ...base, notes: [note("a", "local"), note("b"), note("new")] }
  const remote = { ...base, notes: [note("a"), note("b", "remote"), note("delete")] }
  const merged = mergeWorkspace(base, local, remote)
  assert.deepEqual(merged.conflicts, [])
  assert.deepEqual(merged.data.notes.map((n) => [n.id, n.text]), [["a", "local"], ["b", "remote"], ["new", "new"]])
  const conflict = mergeWorkspace(base, { ...base, notes: [note("a", "local")] }, { ...base, notes: [note("a", "remote")] })
  assert.deepEqual(conflict.conflicts, ["notes: a"])
  assert.equal(conflict.data.notes[0].text, "local")
  assert.ok(mergeWorkspace(base, { ...base, notes: [] }, { ...base, notes: [note("a", "edited")] }).conflicts.includes("notes: a"))
})
test("validation rejects partial snapshots, duplicate IDs and wrong types", () => {
  assert.ok(same({ id: "a", text: "b" }, { text: "b", id: "a" }))
  assert.ok(validWorkspace(emptyWorkspace()))
  assert.ok(!validWorkspace({ tasks: [] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), notes: [note("a"), note("a")] }))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [note("a")] }))
})
test("authenticated API persists across restarts and rejects stale or malformed writes", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bw-workspace-test-"))
  const workspace = new FileWorkspaceStore(root)
  const sessions = new Sessions(Buffer.alloc(32, 42))
  const api = createApi({ store: new FileConnectionStore(root), workspace, auth: { sessions, passwordHash: hashPassword("test-password") } })
  const server = createServer((req, res) => { void api(req, res) })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}/api/workspace`
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json", Cookie: sessions.issue(false).split(";")[0] }
  try {
    assert.equal((await fetch(url)).status, 403)
    assert.equal((await fetch(url, { headers: { "X-Blackwall": "1" } })).status, 401)
    const first = await (await fetch(url, { headers })).json()
    const body = { ...first, data: { ...emptyWorkspace(), notes: [note("a")] } }
    const saved = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) })
    assert.equal(saved.status, 200)
    assert.equal((await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) })).status, 409)
    assert.equal((await fetch(url, { method: "PUT", headers, body: JSON.stringify({ ...body, data: {} }) })).status, 400)
    const restarted = await new FileWorkspaceStore(root).readWorkspace()
    assert.equal(restarted.revision, 1)
    assert.equal(restarted.data.notes[0].id, "a")
    assert.deepEqual((await new FileConnectionStore(root).list()), [])
    assert.equal((await fetch(url, { method: "PUT", headers: { "X-Blackwall": "1" }, body: JSON.stringify(body) })).status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()))
    rmSync(root, { recursive: true, force: true })
  }
})

test("Postgres migration, atomic revisions and restart", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const { default: pg } = await import("pg")
  const { PostgresConnectionStore } = await import("../server/store-postgres.ts")
  const url = new URL(process.env.TEST_DATABASE_URL!)
  const pool = new pg.Pool({ connectionString: url.toString() })
  const schema = `bw_test_${Date.now()}`
  await pool.query(`CREATE SCHEMA ${schema}`)
  url.searchParams.set("options", `-c search_path=${schema}`)
  const store = new PostgresConnectionStore(url.toString(), Buffer.alloc(32, 42))
  try {
    await store.migrate()
    await store.migrate()
    const first = await store.readWorkspace()
    const results = await Promise.all([
      store.writeWorkspace(first.id, first.revision, { ...first.data, notes: [note("a")] }),
      store.writeWorkspace(first.id, first.revision, { ...first.data, notes: [note("b")] }),
    ])
    assert.equal(results.filter(Boolean).length, 1)
    const second = new PostgresConnectionStore(url.toString(), Buffer.alloc(32, 42))
    try {
      const persisted = await second.readWorkspace()
      assert.equal(persisted.revision, 1)
      assert.ok(validWorkspace(persisted.data))
      assert.deepEqual(await second.list(), [])
    } finally { await second.close() }
  } finally {
    await store.close()
    await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool.end()
  }
})
