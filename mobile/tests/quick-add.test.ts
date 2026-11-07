import assert from "node:assert/strict"
import { test } from "node:test"
import { navLayout, FAB, FAB_EDGE } from "../src/native/nav/layout.ts"
import { QUICK_ACTIONS, QUICK_GROUPS, reflectTargets } from "../src/native/quickadd/actions.ts"

const course = (id: string, title: string, kind = "course") => ({ id, title, kind }) as never
const task = (id: string, title: string, extra: object = {}) => ({ id, title, done: false, ...extra }) as never
const data = {
  courses: [course("c1", "Linear Algebra"), course("c2", "Rust Book", "reading")],
  tasks: [
    task("t1", "Problem set 3", { courseId: "c1", due: "2026-11-09" }),
    task("t2", "Read chapter 4", { courseId: "c2", due: "2026-11-08" }),
    task("t3", "Buy cables"),
    task("e1", "Study group", { kind: "event", courseId: "c1", scheduledDate: "2026-11-10" }),
    task("d1", "Old quiz", { courseId: "c1", done: true, completedAt: "2026-11-01T10:00:00.000Z" }),
    task("d2", "Newer quiz", { courseId: "c1", done: true, completedAt: "2026-11-05T10:00:00.000Z" }),
  ],
} as never

test("the nav pill leaves room for the quick-add button and never overlaps it", () => {
  for (const width of [320, 360, 390, 412, 600]) {
    const { barWidth, barLeft } = navLayout(width)
    assert.ok(barWidth > 0 && barWidth <= 300)
    assert.ok(barLeft >= FAB_EDGE, `left edge at ${width}`)
    assert.ok(barLeft + barWidth <= width - FAB_EDGE - FAB, `right edge at ${width}`)
  }
  assert.equal(navLayout(390).barWidth, 300)
  assert.equal(navLayout(320).barLeft, FAB_EDGE)
  assert.deepEqual(navLayout(0), { barWidth: 0, barLeft: FAB_EDGE })
})

test("every quick action is in a known group and kinds are unique", () => {
  const kinds = QUICK_ACTIONS.map(a => a.kind)
  assert.equal(new Set(kinds).size, kinds.length)
  for (const a of QUICK_ACTIONS) assert.ok(QUICK_GROUPS.includes(a.group))
  assert.ok(kinds.includes("reflection") && kinds.includes("reflect-on"))
})

test("reflection targets: open tasks by due date, events, learning items, then finished work newest first", () => {
  const rows = reflectTargets(data, "")
  assert.deepEqual(rows.map(r => r.key), ["task-t2", "task-t1", "task-t3", "event-e1", "course-c1", "course-c2", "task-d2", "task-d1"])
  const t1 = rows.find(r => r.key === "task-t1")!
  assert.equal(t1.courseId, "c1")
  assert.equal(t1.taskId, "t1")
  assert.equal(t1.sub, "Linear Algebra · Due 2026-11-09")
  assert.equal(rows.find(r => r.key === "task-t3")!.courseId, undefined)
  assert.equal(rows.find(r => r.key === "course-c2")!.taskId, undefined)
  assert.equal(rows.find(r => r.key === "task-d2")!.sub.endsWith("Done"), true)
})

test("reflection targets: search matches titles and learning item names, and the list is capped", () => {
  assert.deepEqual(reflectTargets(data, "rust").map(r => r.key), ["task-t2", "course-c2"])
  assert.deepEqual(reflectTargets(data, "  QUIZ ").map(r => r.key), ["task-d2", "task-d1"])
  assert.deepEqual(reflectTargets(data, "zzz"), [])
  assert.equal(reflectTargets(data, "", 3).length, 3)
})
