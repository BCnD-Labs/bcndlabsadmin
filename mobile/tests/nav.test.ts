import assert from "node:assert/strict"
import { test } from "node:test"
import { DESTINATIONS, NAV_CLEARANCE, PRIMARY, findDestination } from "../src/native/nav/destinations.ts"

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

test("More contains no Settings destination", () => {
  assert.ok(!DESTINATIONS.some((d) => d.label === "Settings"))
})

test("findDestination falls back to the first destination", () => {
  assert.equal(findDestination("planner").label, "Planner")
  assert.equal(findDestination("nope" as never).key, DESTINATIONS[0].key)
})

test("screens keep at least 88 of bottom clearance for the bubble", () => {
  assert.ok(NAV_CLEARANCE >= 88)
})

