import assert from "node:assert/strict"
import test from "node:test"
import { moveAroundLocked, overlaps, placeOutsideLocked, resizeAroundLocked } from "../src/mac/window-geometry.ts"

const locked = { x: 200, y: 100, width: 100, height: 100 }
const widget = { x: 100, y: 110, width: 80, height: 80 }

test("widgets stop at a locked widget even after a fast drag", () => {
  const moved = moveAroundLocked(widget, 300, 0, [locked])
  assert.equal(overlaps(moved, locked), false)
  assert.ok(moved.x + moved.width <= locked.x)
})

test("widgets can pass around a locked widget, and apps can pass over it", () => {
  const moved = moveAroundLocked(widget, 300, 160, [locked])
  assert.equal(overlaps(moved, locked), false)
  assert.ok(moved.x > locked.x + locked.width)
  assert.equal(overlaps(moveAroundLocked(widget, 120, 0, []), locked), true)
})

test("resizing into a locked widget leaves the last clear size intact", () => {
  assert.deepEqual(resizeAroundLocked(widget, { ...widget, width: 140 }, [locked]), widget)
  assert.deepEqual(resizeAroundLocked(widget, { ...widget, width: 100 }, [locked]), { ...widget, width: 100 })
})

test("reopening a widget places it beside a pinned widget when space exists", () => {
  const placed = placeOutsideLocked({ x: 220, y: 120, width: 80, height: 60 }, [locked], { width: 500, height: 400 })
  assert.ok(placed)
  assert.equal(overlaps(placed, locked), false)
  assert.equal(placeOutsideLocked({ x: 220, y: 120, width: 450, height: 360 }, [locked], { width: 500, height: 400 }), null)
})
