import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_RETRIES, createWorkspaceClient } from "../src/lib/workspace-client.ts"
import { ADDRESS, fakeServer, memoryStore, note, task, ws } from "./workspace-fake.ts"

const setup = (server = fakeServer(), store = memoryStore()) => ({ server, store, client: createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store }) })
const toggle = (id: string) => (d: ReturnType<typeof ws>) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, updatedAt: "2026-11-02T00:00:00Z" } : t)) })
const retitle = (id: string, title: string) => (d: ReturnType<typeof ws>) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, title, updatedAt: "2026-11-02T00:00:00Z" } : t)) })

test("load: GET with the Blackwall header and cookies, validated, cached as the baseline", async () => {
  const { server, store, client } = setup(fakeServer(ws({ tasks: [task("a")] }), 3))
  const r = await client.load()
  assert.equal(r.status, "ok")
  assert.equal(r.snapshot?.revision, 3)
  assert.equal(r.snapshot?.data.tasks[0].id, "a")
  const call = server.calls[0]
  assert.equal(call.url, "https://blackwall.example.ts.net/api/workspace")
  assert.equal(call.init.method, "GET")
  assert.equal(call.init.credentials, "include")
  assert.equal((call.init.headers as Record<string, string>)["X-Blackwall"], "1")
  assert.equal(JSON.parse(store.text!).baseline.revision, 3)
  assert.equal(client.getState().status, "ok")
  assert.equal(client.getState().pending, false)
})

test("load: 401 is signed-out and nothing is cached", async () => {
  const { server, store, client } = setup()
  server.signedIn = false
  const r = await client.load()
  assert.equal(r.status, "signed-out")
  assert.equal(r.snapshot, undefined)
  assert.equal(store.writes, 0)
})

test("load: offline falls back to the cached snapshot; with no cache there is no snapshot", async () => {
  const first = setup(fakeServer(ws({ notes: [note("n1")] }), 7))
  await first.client.load()
  const server = fakeServer()
  server.down = true
  const { client } = setup(server, memoryStore(first.store.text))
  const r = await client.load()
  assert.equal(r.status, "offline")
  assert.equal(r.snapshot?.revision, 7)
  assert.equal(r.snapshot?.data.notes[0].id, "n1")
  assert.match(r.message ?? "", /Can't reach the server/)
  const bare = await setup(server).client.load()
  assert.equal(bare.status, "offline")
  assert.equal(bare.snapshot, undefined)
})

test("load: an invalid or corrupt body is an error, not data, and is never cached", async () => {
  const server = fakeServer()
  server.snap = { id: "db1", revision: 1, data: { tasks: [] } as never }
  const { store, client } = setup(server)
  const r = await client.load()
  assert.equal(r.status, "error")
  assert.equal(r.snapshot, undefined)
  assert.equal(store.writes, 0)
  const html = createWorkspaceClient({ address: ADDRESS, fetchImpl: (async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch })
  assert.equal((await html.load()).status, "error")
  const bad500 = createWorkspaceClient({ address: ADDRESS, fetchImpl: (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch })
  const e = await bad500.load()
  assert.equal(e.status, "error")
  assert.equal(e.message, "The server answered 500.")
})

test("corrupt cache text is treated as no cache", async () => {
  for (const text of ["{nope", JSON.stringify({ v: 2 }), JSON.stringify({ v: 1, baseline: { id: "x", revision: -1, data: ws() } })]) {
    const server = fakeServer()
    server.down = true
    const r = await setup(server, memoryStore(text)).client.load()
    assert.equal(r.status, "offline")
    assert.equal(r.snapshot, undefined)
  }
})

test("mutate: saves with PUT {id, revision, data} and the new revision becomes the baseline", async () => {
  const { server, store, client } = setup(fakeServer(ws({ tasks: [task("a")] })))
  await client.load()
  const r = await client.mutate(["tasks"], toggle("a"))
  assert.equal(r.status, "ok")
  assert.equal(r.pending, false)
  assert.equal(r.snapshot?.revision, 1)
  assert.equal(server.snap.data.tasks[0].done, true)
  const put = server.puts()[0]
  assert.deepEqual(Object.keys(put.body!).sort(), ["data", "id", "revision"])
  assert.equal(put.body!.revision, 0)
  assert.equal(JSON.parse(store.text!).baseline.revision, 1)
  assert.equal(JSON.parse(store.text!).local, undefined, "nothing pending after a save")
})

test("mutate before load is refused, and a no-op edit sends nothing", async () => {
  const { server, client } = setup()
  await assert.rejects(() => client.mutate(["tasks"], (d) => d), /isn't loaded/)
  await client.load()
  const r = await client.mutate(["tasks"], (d) => ({ ...d }))
  assert.equal(r.status, "ok")
  assert.equal(server.puts().length, 0)
})

test("409 then a clean merge: both devices' edits survive and only one extra GET and PUT happen", async () => {
  const { server, client } = setup(fakeServer(ws({ tasks: [task("a")], notes: [note("n1")] })))
  await client.load()
  server.other((d) => ({ ...d, notes: [note("n2"), ...d.notes] })) // another device adds a note
  const r = await client.mutate(["tasks"], toggle("a"))
  assert.equal(r.status, "ok")
  assert.deepEqual(server.calls.map((c) => c.method), ["GET", "PUT", "GET", "PUT"])
  assert.equal(server.snap.revision, 2)
  assert.equal(server.snap.data.tasks[0].done, true)
  assert.deepEqual(server.snap.data.notes.map((n) => n.id), ["n2", "n1"], "the other device's note and its order are kept")
  assert.equal(r.snapshot?.revision, 2)
})

test("409 with a true conflict stops: no write, then resolve mine / theirs", async () => {
  const mk = async () => {
    const t = setup(fakeServer(ws({ tasks: [task("a")] })))
    await t.client.load()
    t.server.other(retitle("a", "From the laptop"))
    const r = await t.client.mutate(["tasks"], retitle("a", "From the phone"))
    return { ...t, r }
  }
  const { server, client, r } = await mk()
  assert.equal(r.status, "conflict")
  assert.equal(r.mine?.tasks[0].title, "From the phone")
  assert.equal(r.theirs?.tasks[0].title, "From the laptop")
  assert.deepEqual(r.conflicts, ["tasks: a"])
  assert.equal(server.puts().length, 1, "only the PUT that got the 409; nothing was forced")
  assert.equal(server.snap.data.tasks[0].title, "From the laptop")
  assert.equal(client.getState().status, "conflict")
  assert.equal((await client.mutate(["tasks"], toggle("a"))).status, "conflict", "no edits pile on top of an open conflict")
  assert.equal(server.puts().length, 1)

  const mine = await client.resolveConflict("mine")
  assert.equal(mine.status, "ok")
  assert.equal(server.snap.data.tasks[0].title, "From the phone")
  assert.equal(client.getRecovery()?.tasks[0].title, "From the laptop", "the discarded side is kept")

  const t2 = await mk()
  const theirs = await t2.client.resolveConflict("theirs")
  assert.equal(theirs.status, "ok")
  assert.equal(t2.server.snap.data.tasks[0].title, "From the laptop")
  assert.equal(t2.server.puts().length, 1, "nothing to send when the server's version wins")
  assert.equal(t2.client.getRecovery()?.tasks[0].title, "From the phone")
})

test("4-retry limit: after the first save and four retries it stops and keeps the edit pending", async () => {
  const { server, store, client } = setup(fakeServer(ws({ tasks: [task("a")], notes: [note("n0")] })))
  await client.load()
  server.beforePut = (n) => server.other((d) => ({ ...d, notes: [note(`n${n}`), ...d.notes] })) // someone else always wins the race
  const r = await client.mutate(["tasks"], toggle("a"))
  assert.equal(MAX_RETRIES, 4)
  assert.equal(server.puts().length, 1 + MAX_RETRIES)
  assert.equal(r.status, "error")
  assert.equal(r.pending, true)
  assert.match(r.message ?? "", /Other devices are editing/)
  assert.equal(r.snapshot?.data.tasks[0].done, true, "the edit is still on the phone")
  assert.ok(JSON.parse(store.text!).local, "and in the cache")
  server.beforePut = undefined
  assert.equal((await client.flush()).status, "ok")
  assert.equal(server.snap.data.tasks[0].done, true)
})

test("offline: the edit is applied locally and marked pending, persisted, then flush sends it", async () => {
  const { server, store, client } = setup(fakeServer(ws({ tasks: [task("a")] })))
  await client.load()
  server.down = true
  const r = await client.mutate(["tasks"], toggle("a"))
  assert.equal(r.status, "offline")
  assert.equal(r.pending, true)
  assert.equal(r.snapshot?.data.tasks[0].done, true)
  assert.equal(client.getState().pending, true)
  assert.equal(server.snap.data.tasks[0].done, false)
  assert.deepEqual(JSON.parse(store.text!).touched, ["tasks"])
  assert.equal((await client.flush()).status, "offline", "still down: stays pending")
  server.down = false
  server.other((d) => ({ ...d, notes: [note("n9")] })) // and meanwhile another device saved
  const f = await client.flush()
  assert.equal(f.status, "ok")
  assert.equal(f.pending, false)
  assert.equal(server.snap.data.tasks[0].done, true)
  assert.equal(server.snap.data.notes[0].id, "n9")
})

test("pending edits survive an app restart and go out on the next load through the merge path", async () => {
  const first = setup(fakeServer(ws({ tasks: [task("a"), task("b")] })))
  await first.client.load()
  first.server.down = true
  await first.client.mutate(["tasks"], toggle("a"))
  first.server.down = false
  first.server.other(toggle("b"))
  const { client } = setup(first.server, memoryStore(first.store.text)) // new process, same cache file
  const r = await client.load()
  assert.equal(r.status, "ok")
  assert.deepEqual(first.server.snap.data.tasks.map((t) => [t.id, t.done]), [["a", true], ["b", true]])
})

test("signed out while saving keeps the edit pending", async () => {
  const { server, client } = setup(fakeServer(ws({ tasks: [task("a")] })))
  await client.load()
  server.signedIn = false
  const r = await client.mutate(["tasks"], toggle("a"))
  assert.equal(r.status, "signed-out")
  assert.equal(r.pending, true)
  server.signedIn = true
  assert.equal((await client.flush()).status, "ok")
})

test("pre-PUT guard: undeclared collections, in-place edits, invalid data and non-workspaces are rejected without sending", async () => {
  const { server, client } = setup(fakeServer(ws({ tasks: [task("a")], notes: [note("n1")] })))
  await client.load()
  await assert.rejects(() => client.mutate(["tasks"], (d) => ({ ...d, notes: [] })), /Refusing to change notes/)
  await assert.rejects(() => client.mutate(["tasks"], (d) => { d.notes[0].text = "sneaky"; return d }), /Refusing to change notes/)
  await assert.rejects(() => client.mutate([], toggle("a")), /Refusing to change tasks/)
  await assert.rejects(() => client.mutate(["tasks"], (d) => ({ ...d, tasks: [{ ...d.tasks[0], title: 5 as never }] })), /isn't valid/)
  await assert.rejects(() => client.mutate(["tasks"], (d) => ({ ...d, tasks: [d.tasks[0], d.tasks[0]] })), /isn't valid/)
  await assert.rejects(() => client.mutate(["tasks"], () => undefined as never), /didn't produce/)
  assert.equal(server.puts().length, 0)
  assert.equal(client.getState().pending, false)
  assert.equal(client.getState().snapshot?.data.notes[0].text, "n1", "rejected edits leave the local data untouched")
})

test("a workspace that would exceed the server's 16 MB limit is rejected before it is sent", async () => {
  const { server, client } = setup(fakeServer(ws({ tasks: [task("a")] })))
  await client.load()
  await assert.rejects(() => client.mutate(["tasks"], (d) => ({ ...d, tasks: [{ ...d.tasks[0], details: "x".repeat(16_000_000) }] })), /too large/)
  assert.equal(server.puts().length, 0)
})

test("large-ish documents: 6000 tasks and notes load, merge and save correctly", async () => {
  const tasks = Array.from({ length: 6000 }, (_, i) => task(`t${i}`, { details: "lorem ipsum ".repeat(20) }))
  const notes = Array.from({ length: 2000 }, (_, i) => note(`n${i}`, "text ".repeat(30)))
  const { server, client } = setup(fakeServer(ws({ tasks, notes })))
  await client.load()
  server.other((d) => ({ ...d, notes: d.notes.map((n) => (n.id === "n5" ? { ...n, text: "edited elsewhere" } : n)) }))
  const started = Date.now()
  const r = await client.mutate(["tasks"], toggle("t4000"))
  assert.equal(r.status, "ok")
  assert.ok(Date.now() - started < 5000, "stays quick")
  assert.equal(server.snap.data.tasks.length, 6000)
  assert.equal(server.snap.data.tasks.find((t) => t.id === "t4000")?.done, true)
  assert.equal(server.snap.data.notes.find((n) => n.id === "n5")?.text, "edited elsewhere")
})

test("subscribe and getState: listeners hear every change and can stop listening", async () => {
  const { client } = setup(fakeServer(ws({ tasks: [task("a")] })))
  assert.deepEqual(client.getState(), { status: "idle", pending: false })
  const seen: string[] = []
  const stop = client.subscribe(() => seen.push(client.getState().status))
  await client.load()
  assert.ok(seen.includes("ok"))
  const before = client.getState()
  await client.mutate(["tasks"], toggle("a"))
  assert.notEqual(client.getState(), before, "a new state object per change (React-friendly)")
  stop()
  const count = seen.length
  await client.mutate(["tasks"], toggle("a"))
  assert.equal(seen.length, count)
})

test("errors are short friendly strings with no address, cookie or body in them", async () => {
  const secret = "bw_session=SUPERSECRET"
  const fetchImpl = (async () => new Response(`${secret} blackwall.example.ts.net`, { status: 418 })) as unknown as typeof fetch
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl })
  const r = await client.load()
  assert.equal(r.message, "The server answered 418.")
  assert.ok(!JSON.stringify(client.getState()).includes("SUPERSECRET"))
  const server = fakeServer()
  server.down = true
  const o = await setup(server).client.load()
  assert.ok(!(o.message ?? "").includes("blackwall.example"))
})
