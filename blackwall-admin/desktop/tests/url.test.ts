import assert from "node:assert/strict"
import { test } from "node:test"
import { addressToUrl, classifyLink, normalizeWebAddress, sameOrigin } from "../src/main/url.ts"

const ddg = (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`

test("address bar: URLs load, bare hosts get a scheme, anything else searches", () => {
  assert.equal(addressToUrl("https://example.com/a?b=1"), "https://example.com/a?b=1")
  assert.equal(addressToUrl("http://example.com"), "http://example.com/")
  assert.equal(addressToUrl("example.com"), "https://example.com/")
  assert.equal(addressToUrl("blackwall.example.ts.net/planner"), "https://blackwall.example.ts.net/planner")
  assert.equal(addressToUrl("localhost:5173"), "http://localhost:5173/")
  assert.equal(addressToUrl("127.0.0.1:8780/healthz"), "http://127.0.0.1:8780/healthz")
  assert.equal(addressToUrl("mikoshi:8780"), "http://mikoshi:8780/")
  assert.equal(addressToUrl("  how do tabs work  "), ddg("how do tabs work"))
  assert.equal(addressToUrl("electron"), ddg("electron"))
  assert.equal(addressToUrl("v2.3"), ddg("v2.3"))
  assert.equal(addressToUrl("999.1.1.1"), ddg("999.1.1.1"))
  assert.equal(addressToUrl(""), null)
})

test("address bar never produces a non-web URL", () => {
  for (const text of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,hi", "bw-shell://chrome/index.html", "chrome://gpu"]) {
    const url = addressToUrl(text)
    assert.ok(url?.startsWith("https://duckduckgo.com/"), `${text} → ${url}`)
  }
})

test("links: web, external apps after confirmation, dangerous schemes blocked", () => {
  assert.equal(classifyLink("https://a.test/"), "web")
  assert.equal(classifyLink("http://a.test/"), "web")
  assert.equal(classifyLink("mailto:a@b.test"), "external")
  assert.equal(classifyLink("obsidian://open?vault=x"), "external")
  for (const url of ["javascript:alert(1)", "file:///etc/hosts", "data:text/html,x", "blob:https://a.test/1", "about:blank", "bw-shell://chrome/x", "chrome://settings", "not a url"]) {
    assert.equal(classifyLink(url), "blocked", url)
  }
})

test("web address: http(s) only, scheme added, no credentials", () => {
  assert.equal(normalizeWebAddress("blackwall.example.ts.net"), "https://blackwall.example.ts.net/")
  assert.equal(normalizeWebAddress(" https://a.test/app "), "https://a.test/app")
  assert.equal(normalizeWebAddress("http://127.0.0.1:8780"), "http://127.0.0.1:8780/")
  assert.equal(normalizeWebAddress("ftp://a.test"), null)
  assert.equal(normalizeWebAddress("javascript:alert(1)"), null)
  assert.equal(normalizeWebAddress("https://user:pw@a.test"), null)
  assert.equal(normalizeWebAddress(""), null)
})

test("same origin", () => {
  assert.ok(sameOrigin("https://a.test/x", "https://a.test/y?z"))
  assert.ok(!sameOrigin("https://a.test/", "http://a.test/"))
  assert.ok(!sameOrigin("https://a.test/", "https://b.test/"))
  assert.ok(!sameOrigin("nope", "https://a.test/"))
})
