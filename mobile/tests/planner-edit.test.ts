import assert from "node:assert/strict"
import { test } from "node:test"
import { createTask, removeTask, updateTask, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { monthGrid, monthLabel, monthOf, quickDates, shiftMonth } from "../src/native/screens/planner/date-picker.ts"
import { buildNewTask, buildPatch, buildQuickAdd, draftErrors, draftFromTask, editAccess, emptyDraft, normalizeTime, previewQuickAdd, resolveWithin } from "../src/native/screens/planner/task-form.ts"
import { task, ws } from "./workspace-fake.ts"

const NOW = "2026-11-04T10:00:00.000Z"
const today = "2026-11-04" // a Wednesday
const t = (id: string, extra: Record<string, unknown> = {}) => task(id, extra) as unknown as Collections["tasks"][number]

test("month grid: Monday-first weeks that cover the month", () => {
  const grid = monthGrid({ year: 2026, month: 11 }) // Nov 1 2026 is a Sunday
  assert.equal(grid.length, 6)
  assert.ok(grid.every((w) => w.length === 7))
  assert.equal(grid[0][0].key, "2026-10-26")
  assert.equal(grid[0][0].inMonth, false)
  assert.equal(grid[0][6].key, "2026-11-01")
  assert.equal(grid[0][6].inMonth, true)
  assert.equal(grid[5][0].key, "2026-11-30")
  assert.equal(grid.flat().filter((c) => c.inMonth).length, 30)
})

test("month grid: a month that starts on Monday has no leading days; February in a leap year has 29", () => {
  const jun = monthGrid({ year: 2026, month: 6 }) // Mon Jun 1
  assert.equal(jun[0][0].key, "2026-06-01")
  assert.equal(jun[0][0].inMonth, true)
  assert.equal(monthGrid({ year: 2028, month: 2 }).flat().filter((c) => c.inMonth).length, 29)
  assert.equal(monthGrid({ year: 2026, month: 2 }).flat().filter((c) => c.inMonth).length, 28)
  assert.equal(monthGrid({ year: 2026, month: 2 }).length, 5) // Feb 1 2026 is a Sunday: 6 leading days + 28 = 34 cells
  assert.equal(monthGrid({ year: 2027, month: 2 }).length, 4) // Mon Feb 1 2027, 28 days: exactly four weeks
})

test("shiftMonth wraps years in both directions; labels and parsing", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 5 }, -17), { year: 2024, month: 12 })
  assert.equal(monthLabel({ year: 2026, month: 11 }), "November 2026")
  assert.deepEqual(monthOf("2026-11-04"), { year: 2026, month: 11 })
  assert.equal(monthOf("2026-13-01"), undefined)
  assert.equal(monthOf(""), undefined)
})

test("quick dates: today, tomorrow, the coming Monday, and no date", () => {
  const q = quickDates(today)
  assert.deepEqual(q.map((x) => x.label), ["Today", "Tomorrow", "Next week", "No date"])
  assert.deepEqual(q.map((x) => x.value), [today, "2026-11-05", "2026-11-09", undefined])
  assert.equal(quickDates("2026-11-09")[2].value, "2026-11-16") // a Monday goes to the next Monday
  assert.equal(quickDates("2026-11-08")[2].value, "2026-11-09") // a Sunday: tomorrow
})

test("times: 24-hour only, padded, empty is not valid", () => {
  assert.equal(normalizeTime("9:30"), "09:30")
  assert.equal(normalizeTime(" 18:05 "), "18:05")
  assert.equal(normalizeTime("23:59"), "23:59")
  for (const bad of ["", "24:00", "12:60", "1830", "9am", "9:5", "12:30pm"]) assert.equal(normalizeTime(bad), undefined, bad)
})

test("validation: title is required, due must be a real date, time must be HH:mm and only counts with a due date", () => {
  assert.deepEqual(draftErrors({ ...emptyDraft(), title: "  " }), { title: "Give the task a title." })
  assert.deepEqual(draftErrors({ ...emptyDraft("2026-02-30"), title: "x" }), { due: "Pick a valid date." })
  assert.deepEqual(draftErrors({ ...emptyDraft("2026-11-05"), title: "x", time: "25:00" }), { time: "Use 24-hour time, like 09:30." })
  assert.deepEqual(draftErrors({ ...emptyDraft(), title: "x", time: "25:00" }), {}) // no due date: the time is ignored
  assert.deepEqual(draftErrors({ ...emptyDraft("2026-11-05"), title: "x", time: "9:30" }), {})
})

test("new task from a draft: trimmed title, empty fields are left out (no empty strings)", () => {
  const bare = buildNewTask({ ...emptyDraft(), title: "  Pay rent  ", details: "   ", time: "9:30" }, NOW)
  assert.deepEqual(bare, { title: "Pay rent", starred: false, done: false })
  assert.equal("details" in bare, false)
  const full = buildNewTask({ title: "Exam", details: " Bring ID ", due: "2026-11-10", time: "9:05", starred: true, done: false }, NOW)
  assert.deepEqual(full, { title: "Exam", details: "Bring ID", due: "2026-11-10", time: "09:05", starred: true, done: false })
  assert.equal(buildNewTask({ ...emptyDraft(), title: "x", done: true }, NOW).completedAt, NOW)
})

test("patch from a draft: cleared fields are explicit undefined; completedAt follows done like the web", () => {
  const existing = t("a", { details: "old", due: "2026-11-05", time: "08:00", done: true, completedAt: "2026-11-03T00:00:00Z" })
  const cleared = buildPatch({ ...draftFromTask(existing), details: "", due: "", time: "08:00" }, existing, NOW)
  assert.deepEqual(cleared, { title: "Task a", details: undefined, due: undefined, time: undefined, starred: false, done: true, completedAt: "2026-11-03T00:00:00Z" })
  assert.equal(buildPatch({ ...draftFromTask(existing), done: false }, existing, NOW).completedAt, undefined)
  const open = t("b")
  assert.equal(buildPatch({ ...draftFromTask(open), done: true }, open, NOW).completedAt, NOW)
})

test("an older-shape task round-trips through edit without losing fields the form doesn't know", () => {
  // What an old workspace has: no details/due/time/course, and (as a newer one has) fields the form never touches.
  const old = t("old")
  const rich = t("rich", { courseId: "c1", learningType: "exam", score: 88, links: [{ label: "Spec", url: "https://example.com" }], scheduledDate: "2026-11-06", scheduledTime: "10:00", durationMinutes: 45, focusDate: "2026-11-04", recordLinks: [{ kind: "log", id: "2026-11-04" }], reflection: { text: "ok", items: {}, updatedAt: NOW }, futureField: { keep: true } })
  const data = ws({ tasks: [old, rich] })
  assert.equal(validWorkspace(data), true)

  const afterOld = updateTask(data, "old", buildPatch({ ...draftFromTask(old), title: " Renamed ", due: "2026-11-05", time: "7:00" }, old, NOW), { now: () => NOW })
  const editedOld = afterOld.tasks.find((x) => x.id === "old")!
  assert.deepEqual({ title: editedOld.title, due: editedOld.due, time: editedOld.time }, { title: "Renamed", due: "2026-11-05", time: "07:00" })
  assert.equal(editedOld.createdAt, old.createdAt)
  assert.equal(validWorkspace(afterOld), true)

  const afterRich = updateTask(data, "rich", buildPatch({ ...draftFromTask(rich), starred: true, details: "Notes" }, rich, NOW), { now: () => NOW })
  const editedRich = afterRich.tasks.find((x) => x.id === "rich") as unknown as Record<string, unknown>
  const original = rich as unknown as Record<string, unknown>
  for (const key of ["courseId", "learningType", "score", "links", "scheduledDate", "scheduledTime", "durationMinutes", "focusDate", "recordLinks", "reflection", "futureField", "createdAt"]) assert.deepEqual(editedRich[key], original[key], key)
  assert.equal(editedRich.starred, true)
  assert.equal(editedRich.details, "Notes")
  assert.equal(validWorkspace(afterRich), true)
  assert.deepEqual(afterRich.tasks.find((x) => x.id === "old"), old) // other tasks untouched
})

test("create and delete go through the shared rules and keep the workspace valid", () => {
  const data = ws({ tasks: [t("keep")] })
  const made = createTask(data, buildNewTask({ ...emptyDraft("2026-11-05"), title: "New", time: "6:15" }, NOW), { makeId: () => "tsk_new", now: () => NOW }).data
  assert.deepEqual(made.tasks.map((x) => x.id), ["tsk_new", "keep"])
  assert.equal(made.tasks[0].time, "06:15")
  assert.equal(validWorkspace(made), true)
  const gone = removeTask(made, "tsk_new")
  assert.deepEqual(gone.tasks.map((x) => x.id), ["keep"])
})

test("quick add: the shared parser sets title and due; empty text does nothing", () => {
  assert.deepEqual(buildQuickAdd("Read ch 4 tomorrow", today), { title: "Read ch 4", starred: false, done: false, due: "2026-11-05" })
  assert.deepEqual(buildQuickAdd("  Email Sam fri ", today), { title: "Email Sam", starred: false, done: false, due: "2026-11-06" })
  assert.deepEqual(buildQuickAdd("Buy milk", today), { title: "Buy milk", starred: false, done: false })
  assert.equal(buildQuickAdd("", today), null)
  assert.equal(buildQuickAdd("   ", today), null)
  // The Today tab's default date applies only when no date word was typed.
  assert.equal(buildQuickAdd("Buy milk", today, today)?.due, today)
  assert.equal(buildQuickAdd("Buy milk tomorrow", today, today)?.due, "2026-11-05")
  assert.deepEqual(previewQuickAdd("Read ch 4 tmrw", today), { title: "Read ch 4", due: "2026-11-05" })
  assert.equal(previewQuickAdd("", today), null)
})

test("edit access: only a missing workspace or an open conflict blocks; offline and signed-out edits are queued", () => {
  assert.equal(editAccess("ok", true).ok, true)
  for (const s of ["offline", "signed-out", "error", "loading"] as const) assert.equal(editAccess(s, true).ok, true, s)
  assert.equal(editAccess("conflict", true).ok, false)
  assert.match(editAccess("conflict", true).reason ?? "", /edits to keep/)
  assert.equal(editAccess("loading", false).ok, false)
  assert.equal(editAccess("signed-out", false).reason, "Sign in to add tasks.")
})

test("resolveWithin: a fast answer wins, a slow one falls back, a rejection still rejects", async () => {
  assert.equal(await resolveWithin(Promise.resolve(false), 50, true), false)
  assert.equal(await resolveWithin(new Promise<boolean>((r) => setTimeout(() => r(false), 200)), 10, true), true)
  await assert.rejects(resolveWithin(Promise.reject(new Error("boom")), 50, true), /boom/)
})
