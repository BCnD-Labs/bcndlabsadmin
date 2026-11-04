import assert from "node:assert/strict"
import { test } from "node:test"
import { CARD_PAD, MONTH_ROW_MIN, RUBBER_GIVE, WEEKDAY_ROW, monthChips, monthMinHeight, rubberBand } from "../src/native/screens/planner/calendar/month-density.ts"
import { SWIPE_COMMIT, claimsSwipe, swipeStep } from "../src/native/screens/planner/calendar/period-swipe.ts"
import { calendarHeight } from "../src/native/screens/planner/calendar/workspace-prefs.ts"

test("the month view's smallest height keeps every week row readable", () => {
  assert.equal(monthMinHeight(88, 6), 88 + WEEKDAY_ROW + CARD_PAD + 6 * MONTH_ROW_MIN)
  assert.ok(monthMinHeight(88, 5) < monthMinHeight(88, 6))
})

test("a taller month cell shows more event titles, and a short one shows dots only", () => {
  assert.deepEqual([40, 55, 56, 73, 74, 91, 92, 200].map(monthChips), [0, 0, 1, 1, 2, 2, 3, 3])
})

test("dragging is exactly the finger inside the limits, and a resisted stretch past them", () => {
  assert.equal(rubberBand(300, 200, 400), 300)
  assert.equal(rubberBand(200, 200, 400), 200)
  assert.equal(rubberBand(400, 200, 400), 400)
  const over = [410, 450, 600, 5000].map((raw) => rubberBand(raw, 200, 400))
  assert.ok(over.every((v, i) => v > 400 && v <= 400 + RUBBER_GIVE && (i === 0 || v > over[i - 1] - 1e-9)))
  assert.ok(over[0] - 400 < 10, "a small overshoot moves almost one to one")
  const under = rubberBand(100, 200, 400)
  assert.ok(under < 200 && under > 200 - RUBBER_GIVE)
  assert.ok(Math.abs((rubberBand(450, 200, 400) - 400) - (200 - rubberBand(150, 200, 400))) < 1e-9, "same give at both ends")
})

test("a calendar floor raises the smallest height but never passes the largest, and the default is unchanged", () => {
  assert.equal(calendarHeight(800, 0), calendarHeight(800, 0, undefined))
  assert.equal(calendarHeight(800, 0), 220)
  assert.equal(calendarHeight(800, 0, 300), 300)
  assert.equal(calendarHeight(800, 0, 5000), calendarHeight(800, 1))
  assert.equal(calendarHeight(800, 0.4, 300), 320)
})

test("the calendar only claims a swipe that is clearly along its axis", () => {
  assert.equal(claimsSwipe(20, 2, false), true)
  assert.equal(claimsSwipe(20, 20, false), false)
  assert.equal(claimsSwipe(8, 0, false), false)
  assert.equal(claimsSwipe(2, 30, true), true)
  assert.equal(claimsSwipe(30, 2, true), false)
})

test("moving the finger left or up goes forward, right or down goes back, short slow moves do nothing", () => {
  assert.equal(swipeStep(-SWIPE_COMMIT, 0), 1)
  assert.equal(swipeStep(SWIPE_COMMIT, 0), -1)
  assert.equal(swipeStep(-20, 0), 0)
  assert.equal(swipeStep(-20, -0.8), 1)
  assert.equal(swipeStep(10, 0.9), 0)
})
