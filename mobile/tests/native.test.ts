import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizeViewMode, VIEW_MODES } from "../src/lib/view-mode.ts"

test("web is always the default; native is only used when stored and available", () => {
  assert.equal(sanitizeViewMode(null, true), "web")
  assert.equal(sanitizeViewMode("native", true), "native")
  assert.equal(sanitizeViewMode("native", false), "web")
  assert.ok(VIEW_MODES.find((m) => m.mode === "web")?.available)
})
