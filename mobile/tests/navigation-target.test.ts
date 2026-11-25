import assert from "node:assert/strict"
import { test } from "node:test"
import { targetFor } from "../src/native/nav/target.ts"
import { SLOTS } from "../src/native/screens/journal-review.ts"

test("Home check-ins preserve today's date and the named slot", () => {
  for (const { key: slot } of SLOTS) {
    const target = { screen: "journal" as const, day: "2026-11-24", slot }
    assert.deepEqual(targetFor("journal", target), target)
    assert.equal(targetFor("dev", target), undefined)
  }
})
test("project shortcuts preserve the named project", () => {
  const target = { screen: "dev" as const, projectId: "project-2" }
  assert.deepEqual(targetFor("dev", target), target)
  assert.equal(targetFor("journal", target), undefined)
})
test("ordinary navigation carries no previous item target", () => {
  assert.equal(targetFor("journal"), undefined)
  assert.equal(targetFor("dev"), undefined)
})
