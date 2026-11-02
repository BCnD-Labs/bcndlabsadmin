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
