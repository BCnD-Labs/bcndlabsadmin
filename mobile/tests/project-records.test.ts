import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../src/lib/shared.ts"
import { saveProjectRecord } from "../src/native/screens/project-records.ts"

const time = "2026-11-04T12:00:00.000Z"
const fields = { name: "Blackwall", code: "BW", status: "active" as const, color: "teal" as const, description: "Personal workspace" }
const repo = (id: string, projectId?: string) => ({ id, fullName: "BCnD-Labs/" + id, url: "https://github.com/BCnD-Labs/" + id, projectId, createdAt: time, updatedAt: time })

test("project creation links only selected unassigned repositories and remains valid workspace data", () => {
  const before = { ...emptyWorkspace(), repos: [repo("admin"), repo("other", "prj_other")] }
  const after = saveProjectRecord(before, undefined, fields, ["admin", "other"], { id: "prj_new", now: time })
  assert.equal(after.projects[0]?.id, "prj_new")
  assert.equal(after.repos[0]?.projectId, "prj_new")
  assert.equal(after.repos[1]?.projectId, "prj_other")
  assert.equal(before.repos[0]?.projectId, undefined)
  assert.ok(validWorkspace(after))
})

test("project edit can unlink and attach repositories without changing unrelated records", () => {
  const before = { ...emptyWorkspace(), notes: [{ id: "nte_1", text: "Keep", color: "plain" as const, pinned: false, createdAt: time, updatedAt: time }], projects: [{ ...fields, id: "prj_new", createdAt: time, updatedAt: time }], repos: [repo("old", "prj_new"), repo("fresh"), repo("other", "prj_other")] }
  const after = saveProjectRecord(before, "prj_new", { ...fields, status: "paused" }, ["fresh"], { now: "2026-11-05T12:00:00.000Z" })
  assert.equal(after.projects[0]?.status, "paused")
  assert.equal(after.projects[0]?.createdAt, time)
  assert.equal(after.repos[0]?.projectId, undefined)
  assert.equal(after.repos[1]?.projectId, "prj_new")
  assert.equal(after.repos[2], before.repos[2])
  assert.equal(after.notes, before.notes)
  assert.ok(validWorkspace(after))
})

test("editing a removed project refuses the save", () => {
  assert.throws(() => saveProjectRecord(emptyWorkspace(), "gone", fields, []), /no longer exists/)
})
