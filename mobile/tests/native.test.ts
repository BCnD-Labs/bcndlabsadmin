import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizeViewMode, VIEW_MODES, webStart } from "../src/lib/view-mode.ts"

test("native is the default when available; an explicit web choice remains", () => {
  assert.equal(sanitizeViewMode(null, true), "native")
  assert.equal(sanitizeViewMode("native", true), "native")
  assert.equal(sanitizeViewMode("native", false), "web")
  assert.equal(sanitizeViewMode("web", true), "web")
  assert.ok(VIEW_MODES.find((m) => m.mode === "web")?.available)
})

test("Web view starts on the page a native screen asked for, and only on this server", () => {
  const A = "https://blackwall.example.ts.net/"
  assert.equal(webStart(A), "https://blackwall.example.ts.net")
  assert.equal(webStart(A, "/cms/pages?panel=forms"), "https://blackwall.example.ts.net/cms/pages?panel=forms")
  assert.equal(webStart(A, "//evil.example/x"), "https://blackwall.example.ts.net")
  assert.equal(webStart(A, "/\\evil.example"), "https://blackwall.example.ts.net")
  assert.equal(webStart(A, "https://evil.example"), "https://blackwall.example.ts.net")
  assert.equal(webStart(A, "/a b"), "https://blackwall.example.ts.net")
  assert.equal(webStart(A, { type: "press" }), "https://blackwall.example.ts.net")
})
