import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_HOME_PREFS, HOME_PANELS, moveHomePanel, sanitizeHomePrefs, toggleItem } from "../src/native/screens/home-prefs.ts"

test("older Home choices load with every section available", () => {
  assert.deepEqual(sanitizeHomePrefs(null), DEFAULT_HOME_PREFS)
  assert.deepEqual(sanitizeHomePrefs({ order: ["journal", "today"], collapsed: ["learning"] }), {
    ...DEFAULT_HOME_PREFS,
    order: ["journal", "today", ...HOME_PANELS.filter(panel => panel !== "journal" && panel !== "today")],
    collapsed: ["learning"],
  })
})

test("Home preferences discard unknown and duplicate values, and move without losing sections", () => {
  const prefs = sanitizeHomePrefs({ order: ["journal", "journal", "unknown"], collapsed: ["today", "unknown"], closedGroups: ["a", "a", 2], expandedGroups: ["b"], expandedToday: true })
  assert.equal(prefs.order.length, HOME_PANELS.length)
  assert.deepEqual(prefs.collapsed, ["today"])
  assert.deepEqual(prefs.closedGroups, ["a"])
  assert.deepEqual(moveHomePanel(prefs.order, "journal", -1), prefs.order)
  assert.deepEqual(moveHomePanel(prefs.order, "journal", 1).slice(0, 2), ["today", "journal"])
  assert.deepEqual(toggleItem(prefs.closedGroups, "a"), [])
})
