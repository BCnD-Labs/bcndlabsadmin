import assert from "node:assert/strict"
import { test } from "node:test"
import { anchorLeft, barShift } from "../src/native/nav/geometry.ts"
import { NAV_SIDES, sanitizeNavSide } from "../src/native/nav/side.ts"

test("NAV_SIDES lists left, center, right in that order", () => {
  assert.deepEqual([...NAV_SIDES], ["left", "center", "right"])
})

test("sanitizeNavSide keeps the three known sides and defaults everything else to right", () => {
  for (const s of NAV_SIDES) assert.equal(sanitizeNavSide(s), s)
  for (const bad of [null, undefined, "", "Left", "middle", 0, 1, {}, [], true]) assert.equal(sanitizeNavSide(bad), "right")
})

test("barShift: right grows leftward, left grows rightward, center grows both ways", () => {
  const size = 56
  const w = 320
  const half = (w * (1 - size / w)) / 2
  assert.equal(half, (w - size) / 2)
  const r = barShift("right", w, size)
  const l = barShift("left", w, size)
  const c = barShift("center", w, size)
  assert.equal(r.shift, half)
  assert.equal(l.shift, -half)
  assert.equal(c.shift, 0)
  for (const g of [r, l, c]) assert.equal(g.collapsedScale, size / w)
})

test("barShift puts the collapsed pill exactly on the bubble for every side", () => {
  for (const w of [56, 200, 320]) {
    for (const side of NAV_SIDES) {
      const g = barShift(side, w, 56)
      // Pill centre inside the anchor (anchor-local x) versus bubble centre.
      const pillCentre = w / 2 + g.shift
      assert.ok(Math.abs(pillCentre - (g.bubbleLeft + 28)) < 1e-9, `${side} ${w}`)
    }
  }
})

test("barShift bubble offsets: left 0, center (barW - size) / 2, right barW - size", () => {
  assert.equal(barShift("left", 300, 56).bubbleLeft, 0)
  assert.equal(barShift("center", 300, 56).bubbleLeft, 122)
  assert.equal(barShift("right", 300, 56).bubbleLeft, 244)
})

test("a bar as narrow as the bubble does not move", () => {
  for (const side of NAV_SIDES) {
    const g = barShift(side, 56, 56)
    assert.equal(g.collapsedScale, 1)
    assert.equal(Math.abs(g.shift), 0)
    assert.equal(g.bubbleLeft, 0)
  }
})

test("anchorLeft: 16 from the left, centered, or 16 from the right", () => {
  assert.equal(anchorLeft("left", 400, 320, 16), 16)
  assert.equal(anchorLeft("center", 400, 320, 16), 40)
  assert.equal(anchorLeft("right", 400, 320, 16), 64)
  // Narrow window: bar fills the width, every side lines up.
  for (const side of NAV_SIDES) assert.equal(anchorLeft(side, 320, 288, 16), 16)
})
