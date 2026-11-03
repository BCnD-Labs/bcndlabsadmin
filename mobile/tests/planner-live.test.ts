import assert from "node:assert/strict"
import { test } from "node:test"
import { agendaFor, busyDays } from "../src/native/screens/planner/agenda.ts"
import { dueText, plannerRows, tabCounts } from "../src/native/screens/planner/rows.ts"
import { task, ts } from "./workspace-fake.ts"
import type { Collections } from "../src/lib/shared.ts"

// Wed 2026-11-04 is "today" in every test.
const today = "2026-11-04"
const t = (id: string, extra: Record<string, unknown> = {}) => task(id, extra) as unknown as Collections["tasks"][number]
const course = { id: "c1", title: "Energy Resources", code: "GEG-123", instructor: "", instructorEmail: "", term: "", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", createdAt: ts, updatedAt: ts } as unknown as Collections["courses"][number]

const tasks = [
  t("late", { due: "2026-11-02", title: "Renew domain" }),
  t("now", { due: today, time: "18:00", title: "Back up the homelab", starred: true, courseId: "c1" }),
  t("tmrw", { due: "2026-11-05", title: "Outline speech" }),
  t("week", { due: "2026-11-10", title: "Midterm" }),
  t("far", { due: "2026-12-25", title: "Holiday" }),
  t("none", { title: "Someday", details: "Sort the garage" }),
  t("old", { due: "2026-10-30", done: true, completedAt: "2026-10-31T00:00:00Z", title: "Reading response" }),
  t("newer", { due: "2026-11-01", done: true, completedAt: "2026-11-02T00:00:00Z", title: "Quiz" }),
]
const view = (tab: "today" | "next" | "all" | "done", extra: Record<string, unknown> = {}) => plannerRows(tasks, [course], { tab, search: "", today, ...extra })
const ids = (v: ReturnType<typeof view>) => v.sections.map((s) => s.rows.map((r) => r.id))

test("Today: overdue then today, headers shown because there are two groups", () => {
  const v = view("today")
  assert.deepEqual(v.sections.map((s) => s.title), ["Overdue", "Today"])
  assert.deepEqual(ids(v), [["late"], ["now"]])
  assert.equal(v.sections[0].warn, true)
  assert.equal(v.total, 2)
})

test("Today with a single group hides its header (as the web does)", () => {
  const v = plannerRows(tasks.filter((x) => x.id === "now"), [course], { tab: "today", search: "", today })
  assert.deepEqual(v.sections.map((s) => s.title), [null])
})

test("Next: tomorrow, next 7 days, later; undated tasks are not here", () => {
  const v = view("next")
  assert.deepEqual(v.sections.map((s) => s.title), ["Tomorrow", "Next 7 days", "Later"])
  assert.deepEqual(ids(v), [["tmrw"], ["week"], ["far"]])
})

test("All: every open task in group order, undated last", () => {
  const v = view("all")
  assert.deepEqual(v.sections.map((s) => s.title), ["Overdue", "Today", "Tomorrow", "Next 7 days", "Later", "No date"])
  assert.deepEqual(ids(v).flat(), ["late", "now", "tmrw", "week", "far", "none"])
})

test("Done: one ungrouped list, most recently completed first", () => {
  const v = view("done")
  assert.deepEqual(v.sections.map((s) => s.title), [null])
  assert.deepEqual(ids(v), [["newer", "old"]])
  assert.equal(v.sections[0].rows[0].done, true)
  assert.equal(v.sections[0].rows[0].overdue, false)
})

test("search matches title and details, ignores case, and says when nothing matches", () => {
  assert.deepEqual(ids(view("all", { search: "  HOMELAB " })).flat(), ["now"])
  assert.deepEqual(ids(view("all", { search: "garage" })).flat(), ["none"])
  const none = view("all", { search: "zzz" })
  assert.equal(none.total, 0)
  assert.deepEqual(none.empty, { filtered: true, text: "No tasks match" })
})

test("starred only narrows the view; empty tab text is per tab", () => {
  assert.deepEqual(ids(view("all", { starredOnly: true })).flat(), ["now"])
  assert.equal(view("all", { starredOnly: true }).sections[0].rows[0].starred, true)
  const empty = plannerRows([], [], { tab: "next", search: "", today })
  assert.deepEqual(empty.empty, { filtered: false, text: "Nothing scheduled" })
  assert.equal(plannerRows([], [], { tab: "done", search: "", today }).empty.text, "Nothing completed yet")
})

test("a task checked off stays in its tab (lingering) until the tab changes", () => {
  const done = tasks.map((x) => (x.id === "now" ? { ...x, done: true } : x))
  assert.deepEqual(ids(plannerRows(done, [course], { tab: "today", search: "", today })), [["late"]])
  const kept = plannerRows(done, [course], { tab: "today", search: "", today, lingering: new Set(["now"]) })
  assert.deepEqual(ids(kept).flat().sort(), ["late", "now"])
  assert.equal(kept.sections.flatMap((s) => s.rows).find((r) => r.id === "now")?.done, true)
})

test("rows carry due text, time and the course name; unknown courses are not invented", () => {
  const rows = view("all").sections.flatMap((s) => s.rows)
  const late = rows.find((r) => r.id === "late")!
  assert.equal(late.dueText, "Overdue · Nov 2")
  assert.equal(late.overdue, true)
  assert.equal(late.course, undefined)
  const now = rows.find((r) => r.id === "now")!
  assert.deepEqual([now.dueText, now.time, now.course], ["Nov 4", "18:00", "Energy Resources"])
  assert.equal(rows.find((r) => r.id === "none")!.dueText, "No date")
  const orphan = plannerRows([t("o", { due: today, courseId: "gone" })], [course], { tab: "all", search: "", today })
  assert.equal(orphan.sections[0].rows[0].course, undefined)
  assert.equal(dueText("not-a-date", false), "not-a-date")
})

test("tab counts follow the same rules (done tasks are not counted)", () => {
  assert.deepEqual(tabCounts(tasks, today), { today: 2, next: 3, all: 6 })
})

test("today moves the groups: the same data a day later", () => {
  const v = plannerRows(tasks, [course], { tab: "today", search: "", today: "2026-11-05" })
  assert.deepEqual(ids(v).flat(), ["late", "now", "tmrw"])
})

test("calendar: a task sits on its schedule if it has one, else its due date and time", () => {
  const cal = [
    t("a", { due: today, time: "09:30" }),
    t("b", { due: "2026-11-09", scheduledDate: today, scheduledTime: "08:00" }),
    t("c", { due: today }),
    t("d", { due: today, time: "07:00", done: true, courseId: "c1" }),
    t("e", { due: "2026-11-06" }),
  ]
  assert.deepEqual(agendaFor(cal, today, [course]).map((x) => [x.id, x.time]), [["d", "07:00"], ["b", "08:00"], ["a", "09:30"], ["c", undefined]])
  assert.equal(agendaFor(cal, today, [course])[0].course, "Energy Resources")
  assert.equal(agendaFor(cal, today, [course])[0].done, true)
  assert.deepEqual([...busyDays(cal, ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"])].sort(), ["2026-11-04", "2026-11-06"])
  assert.deepEqual(agendaFor(cal, "2026-11-09", []), [])
})
