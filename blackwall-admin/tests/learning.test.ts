import assert from "node:assert/strict"
import { test } from "node:test"
import { ITEM_TYPES, STATUS_HUES, TYPE_TONE, addDaysKey, courseworkGroups, nextItem, typeCounts, typeOptions, viewItems, type TypeLabel } from "../src/features/learning/coursework-view.ts"
import { coursePanelsFor, normalizeCoursePanels, toggleCoursePanel } from "../src/lib/course-panels.ts"
import type { LearningItemType, Task } from "../src/lib/types.ts"

const ts = "2026-11-02T12:00:00Z"
let n = 0
const task = (patch: Partial<Task> = {}): Task => ({ id: `t${++n}`, title: "Item", done: false, starred: false, createdAt: ts, updatedAt: ts, courseId: "c1", ...patch })
const today = "2026-11-02"
const COURSE: TypeLabel[] = [
  { value: "assignment", label: "Assignment", plural: "Assignments" },
  { value: "exam", label: "Exam", plural: "Exams" },
  { value: "milestone", label: "Milestone", plural: "Milestones" },
  { value: "event", label: "Event", plural: "Events" },
]
const CERT: TypeLabel[] = [
  { value: "milestone", label: "Exam domain", plural: "Exam domains" },
  { value: "exam", label: "Practice test", plural: "Practice tests" },
  { value: "assignment", label: "Study task", plural: "Study tasks" },
  { value: "event", label: "Event", plural: "Events" },
]
const items = [
  task({ id: "late", learningType: "assignment", due: "2026-10-30" }),
  task({ id: "soon", learningType: "exam", due: "2026-11-05", time: "10:00" }),
  task({ id: "edge", learningType: "milestone", due: "2026-11-09" }),
  task({ id: "later", learningType: "assignment", due: "2026-11-20" }),
  task({ id: "event", learningType: "event", due: "2026-11-03" }),
  task({ id: "nodate" }),
  task({ id: "done1", learningType: "exam", done: true, completedAt: "2026-10-20T10:00:00Z" }),
  task({ id: "done2", learningType: "assignment", done: true, completedAt: "2026-10-28T10:00:00Z" }),
]
const ids = (list: { id: string }[]) => list.map((t) => t.id).join(",")

test("every item type has its own tint, none of them a status hue; events stay neutral", () => {
  const tones = ITEM_TYPES.map((t) => TYPE_TONE[t])
  assert.equal(new Set(tones).size, ITEM_TYPES.length, "distinct per type")
  for (const tone of tones) assert.ok(!(STATUS_HUES as readonly string[]).includes(tone), `${tone} is not a status hue`)
  assert.equal(TYPE_TONE.event, "neutral")
})

test("tabs keep the existing order: open by date, done newest first", () => {
  assert.equal(ids(viewItems(items, "open")), "late,event,soon,edge,later,nodate")
  assert.equal(ids(viewItems(items, "done")), "done2,done1")
  assert.equal(ids(viewItems(items, "all")), "late,event,soon,edge,later,nodate,done2,done1")
})

test("type counts follow the To do / Done / All tab", () => {
  assert.deepEqual(typeCounts(items, "open"), { all: 6, assignment: 3, exam: 1, milestone: 1, event: 1 })
  assert.deepEqual(typeCounts(items, "done"), { all: 2, assignment: 1, exam: 1, milestone: 0, event: 0 })
  assert.equal(typeCounts(items, "all").all, 8)
  assert.equal(typeCounts([], "open").all, 0)
})

test("grouping by when: overdue, next 7 days (inclusive), later, no date, then done on All", () => {
  const groups = courseworkGroups(items, { view: "open", groupBy: "when", labels: COURSE, today })
  assert.deepEqual(groups.map((g) => [g.label, ids(g.items)]), [
    ["Overdue", "late"], ["Next 7 days", "event,soon,edge"], ["Later", "later"], ["No date", "nodate"],
  ])
  assert.equal(groups[0].tone, "warn")
  const all = courseworkGroups(items, { view: "all", groupBy: "when", labels: COURSE, today })
  assert.deepEqual(all.at(-1)!.label, "Done")
  assert.equal(ids(all.at(-1)!.items), "done2,done1")
  assert.deepEqual(courseworkGroups(items, { view: "done", groupBy: "when", labels: COURSE, today }).map((g) => g.label), ["Done"])
})

test("grouping by type uses the kind's labels and order and keeps the sort inside groups", () => {
  const groups = courseworkGroups(items, { view: "all", groupBy: "type", labels: CERT, today })
  assert.deepEqual(groups.map((g) => [g.label, ids(g.items)]), [
    ["Exam domains", "edge"], ["Practice tests", "soon,done1"], ["Study tasks", "late,later,nodate,done2"], ["Events", "event"],
  ])
  assert.equal(groups[0].type, "milestone")
})

test("type filters narrow the list (empty means all) in either grouping", () => {
  const only = (types: LearningItemType[], groupBy: "when" | "type") => courseworkGroups(items, { view: "open", types, groupBy, labels: COURSE, today })
  assert.deepEqual(only(["exam"], "when").map((g) => [g.label, ids(g.items)]), [["Next 7 days", "soon"]])
  assert.deepEqual(only(["exam", "event"], "type").map((g) => g.label), ["Exams", "Events"])
  assert.equal(only([], "when").flatMap((g) => g.items).length, 6)
  assert.deepEqual(only(["milestone"], "type").map((g) => ids(g.items)), ["edge"])
})

test("type options: the kind's types, plus any other type items still use", () => {
  const selfPaced: TypeLabel[] = [{ value: "milestone", label: "Section", plural: "Sections" }, { value: "assignment", label: "Exercise", plural: "Exercises" }]
  const fallback = (t: LearningItemType) => COURSE.find((x) => x.value === t)!
  assert.deepEqual(typeOptions([task({ learningType: "milestone" })], selfPaced, fallback).map((t) => t.label), ["Section", "Exercise"])
  assert.deepEqual(typeOptions(items, selfPaced, fallback).map((t) => t.label), ["Section", "Exercise", "Exam", "Event"])
})

test("the next item is the next open dated one from today, else the overdue one", () => {
  assert.equal(nextItem(items, today)?.id, "event")
  assert.equal(nextItem([items[0], items[5]], today)?.id, "late")
  assert.equal(nextItem([items[6]], today), undefined)
})

test("date keys add days across month and year ends", () => {
  assert.equal(addDaysKey("2026-11-28", 7), "2026-12-05")
  assert.equal(addDaysKey("2026-12-30", 3), "2027-01-02")
  assert.equal(addDaysKey("2028-02-28", 1), "2028-02-29")
})

test("stored panel prefs are normalized: malformed values fall back safely", () => {
  for (const bad of [null, undefined, "x", 42, [], [["c1", ["exam"]]], true]) assert.deepEqual(normalizeCoursePanels(bad), {})
  const parsed = JSON.parse('{"__proto__":["exam"],"c1":["exam","exam","bogus","assignment"],"c2":"exam","c3":[],"c4":[1,null],"":["exam"]}')
  const clean = normalizeCoursePanels(parsed)
  assert.deepEqual(clean, { c1: ["assignment", "exam"] }, "dedupes, drops unknown types, bad ids and empty lists; keeps canonical order")
  assert.equal(Object.getPrototypeOf(clean), Object.prototype, "no prototype pollution")
  const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`c${i}`, ["exam"]]))
  assert.equal(Object.keys(normalizeCoursePanels(many)).length, 200, "capped")
  assert.deepEqual(normalizeCoursePanels({ ["x".repeat(81)]: ["exam"] }), {})
})

test("panels for a course are limited to the types its kind uses, in the kind's order", () => {
  const map = { c1: ["assignment", "exam", "milestone", "event"] as LearningItemType[] }
  assert.deepEqual(coursePanelsFor(map, "c1", ["milestone", "assignment"]), ["milestone", "assignment"])
  assert.deepEqual(coursePanelsFor(map, "missing", ["exam"]), [])
  assert.deepEqual(coursePanelsFor({}, "toString", ["exam"]), [], "inherited keys are not entries")
})

test("toggling panels on and off, pruning stale course ids", () => {
  let map = toggleCoursePanel({}, "c1", "exam", true)
  assert.deepEqual(map, { c1: ["exam"] })
  map = toggleCoursePanel(map, "c1", "assignment", true)
  assert.deepEqual(map, { c1: ["assignment", "exam"] })
  map = toggleCoursePanel(map, "c1", "exam", true)
  assert.deepEqual(map, { c1: ["assignment", "exam"] }, "turning on twice is a no-op")
  map = toggleCoursePanel({ ...map, gone: ["event"] }, "c2", "milestone", true, ["c1", "c2"])
  assert.deepEqual(map, { c1: ["assignment", "exam"], c2: ["milestone"] }, "stale ids dropped when live ids are known")
  map = toggleCoursePanel(map, "c2", "milestone", false)
  assert.deepEqual(map, { c1: ["assignment", "exam"] }, "the last panel off removes the entry")
  const before = { c1: ["exam"] as LearningItemType[] }
  toggleCoursePanel(before, "c1", "event", true)
  assert.deepEqual(before, { c1: ["exam"] }, "input is not mutated")
})
