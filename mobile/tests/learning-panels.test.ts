import assert from "node:assert/strict"
import { test } from "node:test"
import { PANELS, activePanels, initialPanels, panelCount, panelList, panelSubtitle, panelsOn, togglePanel } from "../src/native/screens/learning/panels.ts"
import { SAMPLE_COURSEWORK } from "../src/native/sample.ts"

test("all four panels start off, in the popover order", () => {
  assert.deepEqual(PANELS.map((p) => p.label), ["Assignments", "Exams", "Milestones", "Events"])
  const state = initialPanels()
  assert.equal(panelsOn(state), 0)
  assert.deepEqual(activePanels(state), [])
})

test("toggling counts panels on, is immutable, and lists them in PANELS order", () => {
  const start = initialPanels()
  const a = togglePanel(togglePanel(start, "event"), "assignment")
  assert.equal(panelsOn(start), 0)
  assert.equal(panelsOn(a), 2)
  assert.deepEqual(activePanels(a).map((p) => p.type), ["assignment", "event"])
  const b = togglePanel(a, "event")
  assert.equal(panelsOn(b), 1)
  assert.equal(b.event, false)
})

test("panel lists count and sort by due date for one type", () => {
  for (const p of PANELS) {
    const list = panelList(SAMPLE_COURSEWORK, p.type)
    assert.equal(list.length, panelCount(SAMPLE_COURSEWORK, p.type))
    assert.ok(list.every((w) => w.type === p.type))
    assert.deepEqual(list.map((w) => w.due), list.map((w) => w.due).sort())
  }
  assert.equal(PANELS.reduce((n, p) => n + panelCount(SAMPLE_COURSEWORK, p.type), 0), SAMPLE_COURSEWORK.length)
  const before = SAMPLE_COURSEWORK.map((w) => w.id)
  panelList(SAMPLE_COURSEWORK, "assignment")
  assert.deepEqual(SAMPLE_COURSEWORK.map((w) => w.id), before)
})

test("panel subtitle adds Done only for finished items", () => {
  assert.equal(panelSubtitle("Nov 4", false), "Due Nov 4")
  assert.equal(panelSubtitle("Nov 4", true), "Due Nov 4 · Done")
})
