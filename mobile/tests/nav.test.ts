import assert from "node:assert/strict"
import { test } from "node:test"
import { DESTINATIONS, GROUP_ORDER, NAV_CLEARANCE, PRIMARY, findDestination, launcherGroups } from "../src/native/nav/destinations.ts"
import { FAB, FAB_EDGE, pillHeight } from "../src/native/nav/layout.ts"
import { CHOOSE_COLLAPSE_MS, navDuration } from "../src/native/nav/motion.ts"

test("destination keys are unique", () => {
  assert.equal(new Set(DESTINATIONS.map((d) => d.key)).size, DESTINATIONS.length)
})

test("the mini bar has at most four slots and every other destination has a group", () => {
  assert.ok(PRIMARY.length >= 1 && PRIMARY.length <= 4)
  assert.deepEqual(
    PRIMARY.map((d) => d.key),
    ["home", "planner", "learning", "journal"],
  )
  for (const d of DESTINATIONS.filter((x) => !x.primary)) assert.ok(d.group, d.key)
})

test("the launcher lists every non-primary destination once, in group order, skipping empty groups", () => {
  const groups = launcherGroups()
  const order = groups.map((g) => g.group)
  assert.deepEqual(order, GROUP_ORDER.filter((g) => order.includes(g)))
  assert.ok(groups.every((g) => g.items.length > 0))
  const listed = groups.flatMap((g) => g.items.map((i) => i.key))
  assert.equal(new Set(listed).size, listed.length)
  assert.deepEqual(
    [...listed].sort(),
    DESTINATIONS.filter((d) => !d.primary)
      .map((d) => d.key)
      .sort(),
  )
  assert.ok(!listed.some((k) => PRIMARY.some((p) => p.key === k)))
})

test("Settings sits in the App group, which comes last", () => {
  const groups = launcherGroups()
  const app = groups.find((g) => g.group === "App")
  assert.ok(app?.items.some((i) => i.key === "settings"))
  assert.equal(groups[groups.length - 1].group, "App")
  assert.deepEqual(
    groups.find((g) => g.group === "Daily")?.items.map((i) => i.key),
    ["notes", "insights"],
  )
  assert.deepEqual(groups.find((g) => g.group === "Build")?.items.map((i) => i.key), ["dev", "website", "social"])
})

test("findDestination falls back to the first destination", () => {
  assert.equal(findDestination("planner").label, "Planner")
  assert.equal(findDestination("nope" as never).key, DESTINATIONS[0].key)
})

test("screen clearance covers both controls at maximum font scale with breathing room", () => {
  assert.equal(pillHeight(1), 42)
  assert.equal(pillHeight(2), 52)
  assert.equal(pillHeight(3), 52)
  assert.equal(NAV_CLEARANCE, FAB_EDGE + Math.max(FAB, pillHeight(2)) + 10)
})

test("navDuration is zero under reduce motion and unchanged otherwise", () => {
  assert.equal(navDuration(true, 220), 0)
  assert.equal(navDuration(true, CHOOSE_COLLAPSE_MS), 0)
  assert.equal(navDuration(false, 220), 220)
  assert.equal(navDuration(false, -5), 0)
})
