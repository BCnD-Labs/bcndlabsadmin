import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import { createTask } from "../shared/records.ts"
import { reflectionToLog } from "../shared/reflection-log.ts"

const now = "2026-11-06T12:00:00Z", day = "2026-11-06"
const start = () => createTask(emptyWorkspace(), { title: "Subnet lab", done: false, starred: false }, { makeId: () => "tsk_lab", now: () => now }).data
const reflection = { text: "Understood the mask", items: { timeSpent: "42 min", learned: "Split the range" }, updatedAt: now }

test("older tasks accept an explicit reflection copy atomically without changing completion", () => {
  const before = start()
  const after = reflectionToLog(before, "tsk_lab", day, { reflection }, { now: () => now })
  assert.equal(before.journal.length, 0)
  assert.equal(after.tasks[0].done, false)
  assert.deepEqual(after.tasks[0].recordLinks, [{ kind: "log", id: day }])
  assert.match(after.journal[0].entries![0].text, /Time spent: 42 min/)
  assert.equal(validWorkspace(JSON.parse(JSON.stringify(after))), true)
})

test("retries copy once per task/day and preserve a manually edited log copy", () => {
  const once = reflectionToLog(start(), "tsk_lab", day, { reflection }, { now: () => now })
  once.journal[0].entries![0].text = "My revised log wording"
  const twice = reflectionToLog(once, "tsk_lab", day, { reflection: { ...reflection, text: "Another reflection" } }, { now: () => now })
  assert.equal(twice.journal[0].entries!.length, 1)
  assert.equal(twice.journal[0].entries![0].text, "My revised log wording")
  assert.equal(twice.tasks[0].recordLinks!.length, 1)
  assert.equal(reflectionToLog(twice, "tsk_lab", "2026-11-07", {}, { now: () => now }).journal.length, 2)
})

test("blank reflections, invalid dates, missing tasks and full link lists never partially mutate", () => {
  const before = start(), copy = structuredClone(before)
  assert.throws(() => reflectionToLog(before, "tsk_lab", day), /Write a reflection/)
  assert.throws(() => reflectionToLog(before, "missing", day, { reflection }), /existing task/)
  assert.throws(() => reflectionToLog(before, "tsk_lab", "2026-02-30", { reflection }), /valid log day/)
  assert.throws(() => reflectionToLog(before, "tsk_lab", day, { reflection, recordLinks: Array.from({ length: 50 }, (_, i) => ({ kind: "note", id: `n${i}` })) }), /Remove a linked/)
  assert.deepEqual(before, copy)
})
