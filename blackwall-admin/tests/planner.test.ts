import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, mergeWorkspace, validWorkspace } from "../shared/workspace.ts"
import { validDateKey } from "../shared/planner.ts"
import { taskSlot, taskOnDate, timedLanes } from "../src/features/productivity/planner-utils.ts"
import type { Task } from "../src/lib/types.ts"
const timestamp = "2026-11-02T14:42:00Z"
const task = (patch: Partial<Task> = {}): Task => ({ id: "a", title: "A task", done: false, starred: false, createdAt: timestamp, updatedAt: timestamp, ...patch })
const validTask = (value: unknown) => validWorkspace({ ...emptyWorkspace(), tasks: [value] })

test("legacy tasks remain valid; scheduling preserves independent deadlines", () => {
  assert.ok(validTask(task()))
  const value = task({ due: "2026-11-06", time: "10:00", scheduledDate: "2026-11-02", scheduledTime: "14:00" })
  assert.ok(validTask(value))
  assert.deepEqual(taskSlot(value), { date: "2026-11-02", time: "14:00" })
  assert.ok(taskOnDate(value, "2026-11-06"))
  assert.ok(taskOnDate(value, "2026-11-02"))
  assert.equal(value.due, "2026-11-06")
  assert.deepEqual(taskSlot(task({ due: "2026-11-06", time: "10:00" })), { date: "2026-11-06", time: "10:00" })
})
test("plain reflection and opt-in custom fields survive workspace serialization", () => {
  for (const items of [{}, { timeSpent: "42 min", difficulty: "Quite tricky", nextTime: "Draw the blocks" }]) {
    const value = task({ reflection: { text: "Needed help", items, updatedAt: timestamp }, recordLinks: [{ kind: "note", id: "n1" }, { kind: "log", id: "2026-11-02" }] })
    assert.ok(validTask(JSON.parse(JSON.stringify(value))))
    assert.equal(value.done, false, "writing never marks the task complete")
  }
})
test("malformed reflection, links and schedule fields are rejected", () => {
  const malformed = [
    { reflection: { text: "note", items: [], updatedAt: timestamp } },
    { reflection: { text: "note", items: { difficulty: 2 }, updatedAt: timestamp } },
    { reflection: { text: "note", items: { surprise: "no" }, updatedAt: timestamp } },
    { reflection: { text: "note", items: { toString: "no" }, updatedAt: timestamp } },
    { reflection: { text: "note", items: {}, updatedAt: "yesterday" } },
    { recordLinks: [{ kind: "script", id: "a" }] },
    { recordLinks: [{ kind: "log", id: "2026-02-30" }] },
    { scheduledDate: "2026-02-30" }, { focusDate: "oops" },
    { scheduledTime: "24:00", scheduledDate: "2026-11-02" },
    { scheduledTime: "10:00" }, { durationMinutes: -1 }, { durationMinutes: 0.5 },
  ]
  for (const patch of malformed) assert.ok(!validTask({ ...task(), ...patch }), JSON.stringify(patch))
  assert.ok(validDateKey("2028-02-29")); assert.ok(!validDateKey("2026-02-29"))
})
test("overlapping events get lanes, disjoint events reuse full width", () => {
  const values = [task({ id: "a", due: "2026-11-02", time: "14:00", durationMinutes: 60 }), task({ id: "b", due: "2026-11-02", time: "14:30", durationMinutes: 45 }), task({ id: "c", due: "2026-11-02", time: "16:00" })]
  const lanes = timedLanes(values, "2026-11-02")
  assert.equal(lanes[0].lanes, 2); assert.equal(lanes[1].lanes, 2)
  assert.notEqual(lanes[0].lane, lanes[1].lane)
  assert.equal(lanes[2].lanes, 1)
  assert.equal(timedLanes(values, "2026-11-03").length, 0)
})
test("reflection edits retain existing conflict protection and merge independent tasks", () => {
  const before = task()
  const reflected = task({ reflection: { text: "A short note", items: {}, updatedAt: timestamp } })
  const base = { ...emptyWorkspace(), tasks: [before, task({ id: "b" })] }
  const local = { ...base, tasks: [reflected, task({ id: "b" })] }
  const remote = { ...base, tasks: [before, task({ id: "b", done: true })] }
  const result = mergeWorkspace(base, local, remote)
  assert.deepEqual(result.conflicts, [])
  assert.equal(result.data.tasks[0].reflection?.text, "A short note")
  assert.equal(result.data.tasks[1].done, true)
  assert.deepEqual(mergeWorkspace(base, local, { ...base, tasks: [task({ title: "Concurrent edit" }), task({ id: "b" })] }).conflicts, ["tasks: a"])
})
