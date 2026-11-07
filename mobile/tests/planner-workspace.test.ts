import assert from "node:assert/strict"
import { test } from "node:test"
import { calendarHeight, moveSection, sanitizeWorkspacePrefs } from "../src/native/screens/planner/calendar/workspace-prefs.ts"
import { columnsFor, stepBy } from "../src/native/screens/planner/calendar/grid.ts"
test("seven-day calendar crosses month and year, while day stepping remains one day", () => {
  assert.deepEqual(columnsFor("week", "2026-12-31", 1), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"])
  assert.equal(stepBy("week", "2026-12-31", 1), "2027-01-07")
  assert.equal(stepBy("day", "2026-12-31", 1), "2027-01-01")
})
test("corrupt saved layout cannot duplicate sections or overflow calendar bounds", () => {
  const prefs = sanitizeWorkspacePrefs({ fraction: Infinity, order: ["notes", "notes", "unknown"], hidden: ["unknown", "log", "log"], showTimes: false })
  assert.deepEqual(prefs.order, ["notes", "agenda", "log"])
  assert.deepEqual(prefs.hidden, ["log"])
  assert.equal(prefs.fraction, 0.55)
  assert.equal(prefs.showTimes, false)
  for (const available of [100, 150, 240, 400, 800, 1200]) for (const fraction of [-1, 0.25, 0.8, 3]) {
    const h = calendarHeight(available, fraction)
    assert.ok(h >= 0)
    assert.ok(available - h - 24 >= Math.min(144, available / 2))
  }
})
test("reordering never loses sections and edge moves are stable", () => {
  const order = sanitizeWorkspacePrefs(null).order
  assert.deepEqual(moveSection(order, "log", -1), ["log", "agenda", "notes"])
  assert.deepEqual(moveSection(order, "agenda", -1), order)
  assert.deepEqual(moveSection(order, "notes", 1), order)
  assert.deepEqual(order, ["agenda", "log", "notes"])
})
