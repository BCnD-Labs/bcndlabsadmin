import assert from "node:assert/strict"
import { test } from "node:test"
import type { Collections } from "../src/lib/shared.ts"
import { linkedNotesForDay } from "../src/native/screens/planner/notes/calendar-notes.ts"
const stamp = "2026-11-03T00:00:00.000Z"
const note = (id: string) => ({ id, text: id, color: "plain" as const, pinned: false, createdAt: stamp, updatedAt: stamp })
const task = { id: "t", title: "Task", done: false, starred: false, due: "2026-11-03", createdAt: stamp, updatedAt: stamp }
test("calendar notes require an explicit link from an item on that day", () => {
  const data: Pick<Collections, "tasks" | "notes"> = { notes: [note("linked"), note("unrelated")], tasks: [{ ...task, recordLinks: [{ kind: "note", id: "linked" }, { kind: "note", id: "deleted" }] }] }
  assert.deepEqual(linkedNotesForDay(data, "2026-11-03").map(n => n.id), ["linked"])
  assert.deepEqual(linkedNotesForDay(data, "2026-11-04"), [])
  data.tasks.push({ ...task, id: "t2", recordLinks: [{ kind: "note", id: "linked" }] })
  assert.equal(linkedNotesForDay(data, "2026-11-03").length, 1)
})
test("a linked note follows the planned day and the separate due day", () => {
  const data = { notes: [note("linked")], tasks: [{ ...task, scheduledDate: "2026-11-02", recordLinks: [{ kind: "note" as const, id: "linked" }] }] }
  assert.equal(linkedNotesForDay(data, "2026-11-02").length, 1)
  assert.equal(linkedNotesForDay(data, "2026-11-03").length, 1)
})
