import assert from "node:assert/strict"
import { register } from "node:module"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { saveState } from "../src/services/draft-status.ts"

register("./alias-loader.mjs", import.meta.url)

/* The real sync engine and store, run in Node against the practice run's real workspace API. The browser's storage and window are
   stood in for by a plain map; the second "device" is a raw client of the same server. */
const storage = new Map<string, string>()
const g = globalThis as Record<string, unknown>
g.window = { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) } }
let base = ""
let offline = false
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.startsWith("/api/")) {
    if (offline) throw new TypeError("offline")
    return realFetch(base + url, init)
  }
  return realFetch(input, init)
}) as typeof fetch

const { useWorkspace } = await import("../src/stores/workspace.ts")
const sync = await import("../src/services/workspace-sync.ts")

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
const until = async (check: () => boolean, what: string, ms = 8000) => {
  const end = Date.now() + ms
  while (!check()) { if (Date.now() > end) assert.fail(`timed out waiting for: ${what}`); await new Promise((r) => setTimeout(r, 25)) }
}
const status = () => sync.useWorkspaceSync.getState().status
const remote = async () => (await (await realFetch(`${base}/api/workspace`, { headers })).json()) as { revision: number; data: { drafts: { id: string; title: string; body: string; publishedAt?: string }[] } }
/** Another device writing to the same server. */
async function otherDevice(change: (data: Awaited<ReturnType<typeof remote>>["data"]) => void) {
  const w = await remote()
  change(w.data)
  const r = await realFetch(`${base}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })
  assert.equal(r.status, 200, await r.clone().text())
}
const draftNow = () => useWorkspace.getState().drafts.find((d) => d.id === "post-1")!

test("the sync engine, driven the way the editor drives it", async (t) => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  base = lab.panel
  try {
    sync.startWorkspaceSync()
    await until(() => status() === "saved", "the first sync")
    useWorkspace.setState({ drafts: [...useWorkspace.getState().drafts, { id: "post-1", title: "Typing test", slug: "typing-test", kind: "post", status: "idea", excerpt: "", body: "", siteId: "lab", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] })
    await until(() => status() === "saved", "the draft reaching the server")

    await t.test("rapid typing, then closing and reopening, loses nothing", async () => {
      let text = ""
      for (let i = 0; i < 400; i++) { text += `word${i} `; useWorkspace.getState().update("drafts", "post-1", { body: text }) }
      assert.equal(status(), "pending", "the status says the server doesn't have it yet")
      assert.equal(saveState(status()).label, "Saving…")
      assert.equal(draftNow().body, text, "every keystroke is in the local state at once")
      assert.ok(JSON.parse(storage.get("blackwall.workspace")!).state.drafts.find((d: { id: string }) => d.id === "post-1").body === text, "and on this device's storage at once")

      // Close the tab before the server ever heard: stop syncing, drop the in-memory state, come back from the stored copy.
      sync.stopWorkspaceSync()
      const stored = storage.get("blackwall.workspace")!
      useWorkspace.setState({ drafts: [] })
      storage.set("blackwall.workspace", stored) // a closed tab doesn't rewrite its storage; only what was on disk comes back
      await useWorkspace.persist.rehydrate()
      assert.equal(draftNow().body, text, "reopened: the full text is back")
      sync.startWorkspaceSync()
      await until(() => status() === "saved", "the reopened page syncing")
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body, text, "and the server has all of it")
    })

    await t.test("offline editing is kept and honestly labelled, then sent when the server is back", async () => {
      offline = true
      useWorkspace.getState().update("drafts", "post-1", { body: "written on a train" })
      await sync.syncWorkspace()
      assert.equal(status(), "offline")
      const label = saveState(status())
      assert.equal(label.label, "Saved on this device only")
      assert.equal(label.tone, "warn")
      assert.match(sync.useWorkspaceSync.getState().message, /Saved on this device only/)
      assert.equal(draftNow().body, "written on a train")
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body.startsWith("word0 "), true, "the server still has the old text")

      offline = false
      await sync.syncWorkspace()
      await until(() => status() === "saved", "reconnecting")
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body, "written on a train")
    })

    await t.test("two devices editing the same post: nothing is overwritten until the writer chooses", async () => {
      await otherDevice((d) => { d.drafts.find((x) => x.id === "post-1")!.body = "the other device's version" })
      useWorkspace.getState().update("drafts", "post-1", { body: "this device's version" })
      await sync.syncWorkspace()
      assert.equal(status(), "conflict")
      assert.deepEqual(sync.useWorkspaceSync.getState().conflicts, ["drafts: post-1"])
      assert.equal(saveState(status()).tone, "error")
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body, "the other device's version", "the server still has the other version")
      assert.equal(draftNow().body, "this device's version", "this device still has its own")
      const detail = sync.workspaceConflictDetails()[0].fields.find((f) => f.label === "body")!
      assert.deepEqual([detail.device, detail.server], ["this device's version", "the other device's version"], "both versions are shown")

      sync.resolveWorkspaceConflict("device")
      await until(() => status() === "saved", "resolving in favour of this device")
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body, "this device's version")
      assert.ok(storage.get("blackwall.workspace.before-server")!.includes("this device's version"), "a recovery copy was kept")

      // And the other way round.
      await otherDevice((d) => { d.drafts.find((x) => x.id === "post-1")!.body = "kept from the server" })
      useWorkspace.getState().update("drafts", "post-1", { body: "to be set aside" })
      await sync.syncWorkspace()
      assert.equal(status(), "conflict")
      sync.resolveWorkspaceConflict("server")
      await until(() => status() === "saved", "resolving in favour of the server")
      assert.equal(draftNow().body, "kept from the server")
      assert.ok(storage.get("blackwall.workspace.before-server")!.includes("to be set aside"), "the set-aside text is still recoverable")
    })

    await t.test("leaving the page sends pending edits at once", async () => {
      useWorkspace.getState().update("drafts", "post-1", { body: "sent as the page was hidden" })
      assert.equal(status(), "pending")
      sync.flushWorkspace()
      await until(() => status() === "saved", "the flush", 3000)
      assert.equal((await remote()).data.drafts.find((d) => d.id === "post-1")!.body, "sent as the page was hidden")
    })
  } finally {
    sync.stopWorkspaceSync()
    await lab.close()
  }
})

test("the save state is worded for what the sync engine says", () => {
  assert.deepEqual(["loading", "saved", "pending", "offline", "conflict"].map((s) => saveState(s as never).label), ["Loading…", "Saved on server", "Saving…", "Saved on this device only", "Conflict: choose a version"])
})

test("a failed publish leaves the whole draft as it was and does not mark it published", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  base = lab.panel
  try {
    const body = "# A long draft\n\n" + "A paragraph of real writing. ".repeat(200)
    await otherDevice((d) => { d.drafts.push({ id: "keep", title: "Keep me", slug: "keep-me", kind: "post", status: "ready", excerpt: "e", body, siteId: "lab", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" } as never) })
    const before = JSON.stringify((await remote()).data.drafts)
    // The site's address and the repository disagree, so the publish is refused before anything is written.
    const wrong = await lab.store.create({ provider: "website", label: "Mismatched", config: { repo: "lab/site", branch: "main", siteUrl: "https://someone-else.github.io/site", blogIndex: "blog/blog.html", postsDir: "blog/posts", imagesDir: "img" }, secrets: { token: "lab" } })
    const r = await realFetch(`${lab.panel}/api/site/posts/keep-me?connection=${wrong.id}`, { method: "PUT", headers, body: JSON.stringify({ post: { title: "Keep me", markdown: body }, plan: true }) })
    assert.equal(r.status, 409)
    const after = await remote()
    assert.equal(JSON.stringify(after.data.drafts), before, "every draft is byte-for-byte unchanged")
    assert.equal(after.data.drafts.find((d) => d.id === "keep")!.body, body, "the full text is still there")
    assert.equal(after.data.drafts.find((d) => d.id === "keep")!.publishedAt, undefined, "and it is not marked published")
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})
