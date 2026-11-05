import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_DOCK, MIN_DOCK, TOOL_IDS, sanitizeDock } from "../src/mac/dock/dock-layout.ts"

test("a first run opens the dock with Calendar, Tasks and Daily log", () => {
  const d = sanitizeDock(undefined)
  assert.deepEqual(d.tools.map((t) => t.id), ["calendar", "today", "log"])
  assert.ok(d.open && d.navOpen)
  assert.ok(d.width >= MIN_DOCK && d.width <= MAX_DOCK)
})

test("a saved layout keeps its order, collapsed state and hidden sidebars", () => {
  const d = sanitizeDock({ open: false, navOpen: false, width: 400, tools: [{ id: "notes", collapsed: true }, { id: "calendar", collapsed: false }] })
  assert.deepEqual(d.tools, [{ id: "notes", collapsed: true }, { id: "calendar", collapsed: false }])
  assert.equal(d.open, false)
  assert.equal(d.navOpen, false)
  assert.equal(d.width, 400)
})

test("old or hand-edited layouts are repaired, never trusted", () => {
  const d = sanitizeDock({ width: 99999, tools: [{ id: "calendar" }, { id: "calendar" }, { id: "removed-tool" }, null, "log", { id: "log", collapsed: "yes" }] })
  assert.deepEqual(d.tools.map((t) => t.id), ["calendar", "log"], "unknown and duplicate tools are dropped")
  assert.equal(d.tools[1].collapsed, false, "only a real true collapses a tool")
  assert.equal(d.width, MAX_DOCK)
  assert.equal(sanitizeDock({ width: 10 }).width, MIN_DOCK)
  assert.equal(sanitizeDock({ width: Number.NaN }).width, 320)
  for (const junk of [null, 5, "x", [], { tools: "nope" }]) assert.ok(sanitizeDock(junk).tools.every((t) => TOOL_IDS.includes(t.id)))
})

test("an empty dock is allowed (every tool removed)", () => {
  assert.deepEqual(sanitizeDock({ tools: [] }).tools, [])
})
