import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizeViewMode, VIEW_MODES } from "../src/lib/view-mode.ts"

test("native is the default when available; an explicit web choice remains", () => {
  assert.equal(sanitizeViewMode(null, true), "native")
  assert.equal(sanitizeViewMode("native", true), "native")
  assert.equal(sanitizeViewMode("native", false), "web")
  assert.equal(sanitizeViewMode("web", true), "web")
  assert.ok(VIEW_MODES.find((m) => m.mode === "web")?.available)
})
