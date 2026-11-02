import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createApi } from "../server/app.ts"
import { FileConnectionStore } from "../server/store.ts"
import { FileWorkspaceStore } from "../server/workspace.ts"

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}
const close = (server: Server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))

test("explicit feed selection reads the chosen account and never falls back on missing, wrong-provider or failed sources", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bw-feed-test-"))
  const requests: string[] = []
  const upstream = createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost")
    const site = url.searchParams.get("site_id")!
    requests.push(site)
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ results: url.searchParams.get("property") === "event:page" ? [{ page: `/${site}`, visitors: 2, pageviews: 3 }] : [] }))
  })
  const upstreamUrl = await listen(upstream)
  const store = new FileConnectionStore(root)
  const first = await store.create({ provider: "analytics", label: "First site", config: { provider: "plausible", baseUrl: upstreamUrl, siteId: "first" }, secrets: { apiKey: "test-first" } })
  const second = await store.create({ provider: "analytics", label: "Second site", config: { provider: "plausible", baseUrl: upstreamUrl, siteId: "second" }, secrets: { apiKey: "test-second" } })
  const wrongProvider = await store.create({ provider: "github", label: "GitHub", config: {} })
  await store.setResult(first.id, { status: "ok" })
  await store.setResult(second.id, { status: "ok" })
  const api = createApi({ store, workspace: new FileWorkspaceStore(root) })
  const server = createServer((req, res) => { void api(req, res) })
  const base = await listen(server)
  const read = (query: string) => fetch(`${base}/api/analytics/report?days=7${query}`, { headers: { "X-Blackwall": "1" } })
  try {
    const automatic = await read("")
    assert.equal(automatic.status, 200)
    assert.equal((await automatic.json()).pages[0].path, "/first")
    requests.length = 0
    const selected = await read(`&connection=${second.id}`)
    assert.equal(selected.status, 200)
    assert.equal((await selected.json()).pages[0].path, "/second")
    assert.deepEqual(new Set(requests), new Set(["second"]))
    requests.length = 0
    for (const id of ["removed", wrongProvider.id]) assert.equal((await read(`&connection=${id}`)).status, 409)
    await store.setResult(second.id, { status: "error", message: "Token expired" })
    assert.equal((await read(`&connection=${second.id}`)).status, 409)
    const githubWrong = await fetch(`${base}/api/github/overview?connection=${first.id}`, { headers: { "X-Blackwall": "1" } })
    assert.equal(githubWrong.status, 409)
    assert.equal(requests.length, 0, "invalid choices must not fetch another account")
  } finally {
    await Promise.all([close(server), close(upstream)])
    rmSync(root, { recursive: true, force: true })
  }
})

test("multi-account GitHub overview assigns repos per connection, skips unusable ones and isolates failures", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bw-gh-accounts-"))
  const store = new FileConnectionStore(root)
  // No tokens: each account fails locally before any network call, which is enough to check routing.
  const first = await store.create({ provider: "github", label: "Org", config: {} })
  const second = await store.create({ provider: "github", label: "Personal", config: {} })
  const broken = await store.create({ provider: "github", label: "Old", config: {} })
  await store.setResult(first.id, { status: "ok", account: "org-bot" })
  await store.setResult(second.id, { status: "ok" })
  await store.setResult(broken.id, { status: "error", message: "Token expired" })
  const api = createApi({ store, workspace: new FileWorkspaceStore(root) })
  const server = createServer((req, res) => { void api(req, res) })
  const base = await listen(server)
  try {
    const repos = ["org/site", `me/tool~${second.id}`, `me/old~${broken.id}`, "not a repo"].map(encodeURIComponent).join(",")
    const res = await fetch(`${base}/api/github/accounts?repos=${repos}`, { headers: { "X-Blackwall": "1" } })
    assert.equal(res.status, 200)
    const { accounts } = await res.json()
    assert.deepEqual(accounts.map((a: { label: string }) => a.label), ["Org", "Personal"], "only working connections are read")
    assert.deepEqual(accounts[0].repos, ["org/site", "me/old"], "unassigned and unusable assignments fall back to the first working account")
    assert.deepEqual(accounts[1].repos, ["me/tool"])
    assert.equal(accounts[0].account, "org-bot")
    assert.ok(accounts.every((a: { error?: string }) => a.error), "a failing account reports its own error instead of failing the request")
    await store.setResult(first.id, { status: "error" })
    await store.setResult(second.id, { status: "error" })
    assert.equal((await fetch(`${base}/api/github/accounts`, { headers: { "X-Blackwall": "1" } })).status, 409)
  } finally {
    await close(server)
    rmSync(root, { recursive: true, force: true })
  }
})
