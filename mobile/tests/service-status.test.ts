import assert from "node:assert/strict"
import { test } from "node:test"
import { fetchServiceStatus, parseStatus, statusUrl } from "../src/lib/service-status.ts"

const reply = (status: number, body?: unknown) => (async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch

test("the status address is the server's /api/services/status", () => {
  assert.equal(statusUrl("https://blackwall.example.ts.net/"), "https://blackwall.example.ts.net/api/services/status")
})

test("a good answer becomes a map by address; odd fields are dropped", () => {
  const out = parseStatus({ checkedAt: "2026-11-04T10:00:00Z", results: [{ url: "https://a/", up: true, ms: 12, status: 200, extra: "x" }, { url: "https://b/", up: false, error: "ECONNREFUSED" }] })
  assert.ok(out)
  assert.deepEqual(out.byUrl.get("https://a/"), { url: "https://a/", up: true, ms: 12, status: 200 })
  assert.deepEqual(out.byUrl.get("https://b/"), { url: "https://b/", up: false, ms: undefined, status: undefined })
})

test("a malformed answer is refused", () => {
  for (const bad of [null, "x", {}, { checkedAt: 1, results: [] }, { checkedAt: "t", results: [{ url: 1, up: true }] }, { checkedAt: "t", results: [null] }]) assert.equal(parseStatus(bad), null)
})

test("the request is a POST with the Blackwall header, the cookie, and only http(s) addresses once each", async () => {
  let seen: { url: string; init: RequestInit } | undefined
  const f = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ checkedAt: "t", results: [] }), { status: 200 }) }) as unknown as typeof fetch
  const out = await fetchServiceStatus("https://blackwall.example.ts.net", ["https://a/", "https://a/", "javascript:1", "http://b:9090"], f)
  assert.equal(out.kind, "ok")
  assert.equal(seen?.url, "https://blackwall.example.ts.net/api/services/status")
  assert.equal(seen?.init.method, "POST")
  assert.equal(seen?.init.credentials, "include")
  assert.equal((seen?.init.headers as Record<string, string>)["X-Blackwall"], "1")
  assert.deepEqual(JSON.parse(String(seen?.init.body)), { urls: ["https://a/", "http://b:9090"] })
})

test("nothing to check sends nothing", async () => {
  let called = false
  const out = await fetchServiceStatus("https://bw", [], (async () => { called = true; return new Response("{}") }) as unknown as typeof fetch)
  assert.equal(out.kind, "ok")
  assert.equal(called, false)
})

test("401 means signed out; other failures are short fixed messages with nothing from the server in them", async () => {
  assert.deepEqual(await fetchServiceStatus("https://bw", ["https://a/"], reply(401)), { kind: "signed-out" })
  const bad = await fetchServiceStatus("https://bw", ["https://a/"], reply(500, { error: "secret detail" }))
  assert.equal(bad.kind, "error")
  assert.ok(bad.kind === "error" && !bad.message.includes("secret"))
  const down = await fetchServiceStatus("https://bw", ["https://a/"], (async () => { throw new Error("boom https://bw cookie=abc") }) as unknown as typeof fetch)
  assert.ok(down.kind === "error" && !down.message.includes("cookie"))
})
