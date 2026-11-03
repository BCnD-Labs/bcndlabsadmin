import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validPlannerFields, validWorkspace, type Collections } from "../src/lib/shared.ts"

const ts = "2026-11-01T00:00:00Z"

test("shared validWorkspace accepts a valid workspace and rejects garbage", () => {
  const task = { id: "t1", title: "Read chapter 4", starred: false, done: false, createdAt: ts, updatedAt: ts }
  const data: Collections = { ...emptyWorkspace(), tasks: [task] }
  assert.ok(validWorkspace(emptyWorkspace()))
  assert.ok(validWorkspace(data))
  assert.ok(!validWorkspace(null))
  assert.ok(!validWorkspace("nope"))
  assert.ok(!validWorkspace({ tasks: [] }), "partial snapshot")
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [task, task] }), "duplicate ids")
  assert.ok(!validWorkspace({ ...emptyWorkspace(), tasks: [{ ...task, title: 5 }] }), "wrong type")
})

test("shared validPlannerFields applies the same schedule rules as the web app", () => {
  assert.ok(validPlannerFields({ scheduledDate: "2026-11-02", scheduledTime: "09:30", durationMinutes: 30 }))
  assert.ok(!validPlannerFields({ scheduledDate: "2026-02-31" }), "impossible date")
  assert.ok(!validPlannerFields({ scheduledTime: "09:30" }), "time needs a date")
  assert.ok(!validPlannerFields({ scheduledDate: "2026-11-02", durationMinutes: 2 }), "duration under 5 minutes")
})
