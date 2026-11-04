import assert from "node:assert/strict"
import { test } from "node:test"
import { createService, emptyWorkspace, removeService, updateService, validWorkspace } from "../src/lib/shared.ts"

const now = () => "2026-11-04T12:00:00.000Z"

test("a new Mikoshi tool is valid workspace data and leaves other collections intact", () => {
  const data = emptyWorkspace()
  const { data: next, record } = createService(data, { name: "Portainer", url: "https://host:9443", description: "Containers", group: "Infrastructure", pinned: true }, { makeId: () => "svc_one", now })
  assert.equal(data.services.length, 0)
  assert.equal(record.id, "svc_one")
  assert.equal(next.services[0].name, "Portainer")
  assert.equal(next.tasks, data.tasks)
  assert.equal(validWorkspace(next), true)
})

test("editing a tool preserves its logo, identity and other records; deleting it removes only that tool", () => {
  const first = createService(emptyWorkspace(), { name: "Portainer", url: "https://host:9443", description: "Containers", group: "Apps", pinned: false, logo: "portainer", materialIcon: "dns" }, { makeId: () => "svc_one", now }).data
  const second = createService(first, { name: "Files", url: "https://files.example.test", description: "Storage", group: "Apps", pinned: false }, { makeId: () => "svc_two", now: () => "2026-11-04T12:01:00.000Z" }).data
  const edited = updateService(second, "svc_one", { name: "Containers", pinned: true }, { now: () => "2026-11-04T12:02:00.000Z" })
  assert.equal(edited.services.find(s => s.id === "svc_one")?.logo, "portainer")
  assert.equal(edited.services.find(s => s.id === "svc_one")?.createdAt, now())
  assert.equal(edited.services.find(s => s.id === "svc_one")?.updatedAt, "2026-11-04T12:02:00.000Z")
  assert.equal(edited.services.find(s => s.id === "svc_two"), second.services[0])
  const removed = removeService(edited, "svc_one")
  assert.deepEqual(removed.services.map(s => s.id), ["svc_two"])
  assert.equal(validWorkspace(removed), true)
})
