import assert from "node:assert/strict"
import { test } from "node:test"
import type { Collections } from "../src/lib/shared.ts"
import { learningGroups } from "../src/native/screens/home-groups.ts"

const course = (id: string, title: string) => ({ id, title }) as Collections["courses"][number]
const task = (id: string, courseId: string) => ({ id, courseId }) as Collections["tasks"][number]

test("Home groups only visible learning items and preserves each row", () => {
  const courses = [course("web", "Web Development"), course("energy", "Energy Resources"), course("empty", "No visible items")]
  const rows = [task("w1", "web"), task("e1", "energy"), task("e2", "energy"), task("w2", "web")]
  assert.deepEqual(learningGroups(rows.slice(0, 2), courses).map(g => [g.title, g.tasks.map(t => t.id)]), [
    ["Web Development", ["w1"]], ["Energy Resources", ["e1"]],
  ])
  assert.deepEqual(learningGroups(rows, courses).map(g => [g.title, g.tasks.map(t => t.id)]), [
    ["Web Development", ["w1", "w2"]], ["Energy Resources", ["e1", "e2"]],
  ])
  assert.deepEqual(learningGroups([], courses), [])
  assert.deepEqual(learningGroups([task("orphan", "removed")], courses).map(g => g.title), ["Other learning"])
})
