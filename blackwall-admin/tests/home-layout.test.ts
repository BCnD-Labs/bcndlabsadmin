import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_LAYOUT, layoutFromSlots, moveBlock, sanitizeLayout, stepBlock } from "../src/lib/home-layout.ts"

const ids = (l: { id: string }[]) => l.map((b) => b.id).join(",")

test("moving a block drops it at the target's position in either direction", () => {
  const base = sanitizeLayout(DEFAULT_LAYOUT)
  const later = moveBlock(base, "prs", "productivity")
  assert.equal(ids(later).split(",").slice(0, 3).join(","), "week,productivity,prs", "dragging down lands after the target")
  const earlier = moveBlock(base, "log", "prs")
  assert.equal(ids(earlier).split(",")[0], "log", "dragging up lands before the target")
  assert.equal(earlier.length, base.length)
  assert.equal(ids(stepBlock(base, "week", -1)).split(",").slice(0, 2).join(","), "week,prs")
})

test("stored layouts are sanitized and old slot layouts migrate in order", () => {
  const dirty = sanitizeLayout([{ id: "week", width: "huge" }, { id: "week" }, { id: "nope" }, "x"])
  assert.equal(dirty[0].id, "week")
  assert.equal(dirty[0].width, "narrow", "unknown widths fall back to the block's default")
  assert.equal(new Set(dirty.map((b) => b.id)).size, dirty.length, "no duplicates")
  assert.equal(dirty.length, DEFAULT_LAYOUT.length, "missing blocks are appended")
  assert.ok(dirty.slice(1).every((b) => !b.visible), "appended blocks start hidden")
  const migrated = layoutFromSlots(["coursework", "productivity", "empty", "analytics"], false, true)
  assert.equal(ids(migrated.filter((b) => b.visible)), "prs,week,repos,coursework,productivity,analytics,services,log")
})
