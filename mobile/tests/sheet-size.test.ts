import assert from "node:assert/strict"
import { test } from "node:test"
import { GROW_FACTOR, GROW_MIN_EXTRA, growTarget } from "../src/native/sheet-size.ts"

test("the large editor is about 2.5x the small one", () => {
  assert.equal(GROW_FACTOR, 2.5)
  assert.equal(growTarget(240, 900), 600)
})

test("it never grows past 88% of the screen", () => {
  assert.equal(growTarget(400, 800), 704)
  assert.equal(growTarget(300, 1000), 750)
})

test("a very small editor still grows by a visible amount", () => {
  assert.equal(growTarget(60, 900), 60 + GROW_MIN_EXTRA)
})

test("an editor already as tall as the cap stays put, and an unmeasured one takes the cap", () => {
  assert.equal(growTarget(800, 800), 800)
  assert.equal(growTarget(0, 800), 704)
  assert.equal(growTarget(Number.NaN, 800), 704)
})
