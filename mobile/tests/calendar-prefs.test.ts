import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_CALENDAR_PREFS, parseCalendarPrefs, sanitizeCalendarPrefs, serializeCalendarPrefs } from "../src/native/screens/planner/calendar/prefs.ts"

test("defaults match the web's Settings: week starts Sunday, 12-hour clock", () => {
  assert.deepEqual(DEFAULT_CALENDAR_PREFS, { weekStartsOn: 0, timeFormat: "12h" })
})

test("sanitize keeps the known choices and defaults each field on its own", () => {
  assert.deepEqual(sanitizeCalendarPrefs({ weekStartsOn: 1, timeFormat: "24h" }), { weekStartsOn: 1, timeFormat: "24h" })
  assert.deepEqual(sanitizeCalendarPrefs({ weekStartsOn: 1 }), { weekStartsOn: 1, timeFormat: "12h" })
  assert.deepEqual(sanitizeCalendarPrefs({ timeFormat: "24h", weekStartsOn: 6 }), { weekStartsOn: 0, timeFormat: "24h" })
  for (const bad of [null, undefined, "", "24h", 1, true, [], {}, { weekStartsOn: "1", timeFormat: "24H" }]) assert.deepEqual(sanitizeCalendarPrefs(bad), DEFAULT_CALENDAR_PREFS)
})

test("sanitize drops fields it does not know", () => {
  assert.deepEqual(sanitizeCalendarPrefs({ weekStartsOn: 1, timeFormat: "24h", password: "x", extra: 1 }), { weekStartsOn: 1, timeFormat: "24h" })
})

test("saved text round-trips; missing, empty or broken text gives the defaults", () => {
  const p = { weekStartsOn: 1, timeFormat: "24h" } as const
  assert.deepEqual(parseCalendarPrefs(serializeCalendarPrefs(p)), p)
  for (const bad of [null, undefined, "", "{", "not json", "[]", "null", "42"]) assert.deepEqual(parseCalendarPrefs(bad), DEFAULT_CALENDAR_PREFS)
  assert.equal(serializeCalendarPrefs({ weekStartsOn: 9 as never, timeFormat: "x" as never }), JSON.stringify(DEFAULT_CALENDAR_PREFS))
})
