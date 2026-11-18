import assert from "node:assert/strict"
import { test } from "node:test"
import { CRASH_DETAIL_MAX, crashDetail, crashTitle } from "../src/lib/crash.ts"

test("crash detail names the error in one short line", () => {
  assert.equal(crashDetail(new TypeError("Cannot read properties of undefined (reading 'title')")), "TypeError: Cannot read properties of undefined (reading 'title')")
  assert.equal(crashDetail("plain\n\n  text"), "plain text")
  assert.equal(crashDetail(undefined), "Unknown error")
  assert.equal(crashDetail({ odd: true }), "Unknown error")
})

test("crash detail never shows an address", () => {
  const d = crashDetail(new Error("fetch https://blackwall.example.ts.net/api/workspace?x=1 failed; also host blackwall.example.ts.net and http://10.0.0.2:3000"))
  assert.ok(!d.includes("example.ts.net"), d)
  assert.ok(!d.includes("10.0.0.2"), d)
  assert.match(d, /\[address\]/)
})

test("crash detail is cut short", () => {
  const d = crashDetail(new Error("x".repeat(500)))
  assert.equal(d.length, CRASH_DETAIL_MAX)
  assert.ok(d.endsWith("…"))
})

test("crash title says whether one screen or the whole app broke", () => {
  assert.equal(crashTitle("screen", "Planner"), "Planner hit a problem")
  assert.equal(crashTitle("screen"), "This screen hit a problem")
  assert.equal(crashTitle("app"), "The native app hit a problem")
})
