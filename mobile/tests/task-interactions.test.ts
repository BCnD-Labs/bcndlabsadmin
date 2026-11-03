import assert from "node:assert/strict"
import { test } from "node:test"
import { removeTask, toggleTask, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { DEFAULT_DENSITY, DENSITIES, otherDensity, rowMetrics, sanitizeDensity } from "../src/native/screens/planner/density.ts"
import { applyQuickAction, quickActions } from "../src/native/screens/planner/quick-actions.ts"
import { plannerRows } from "../src/native/screens/planner/rows.ts"
import { COMPLETE_AT, MAX_RIGHT, REVEAL, claimsDrag, positionFor, settle } from "../src/native/screens/planner/swipe.ts"
import { planUndo, snackText, undoDelete, undoToggle } from "../src/native/screens/planner/task-undo.ts"
import { runUndo } from "../src/native/screens/planner/undo-snack.ts"
import { RESULT_MS, SNACK_MS, dismissSnack, getSnack, runSnackAction, showSnack, subscribeSnack } from "../src/native/snack/snack-store.ts"
import { task, ws } from "./workspace-fake.ts"

const NOW = "2026-11-04T10:00:00.000Z"
const LATER = "2026-11-04T10:05:00.000Z"
const today = "2026-11-04"
const t = (id: string, extra: Record<string, unknown> = {}) => task(id, extra) as unknown as Collections["tasks"][number]
const find = (d: Collections, id: string) => d.tasks.find((x) => x.id === id) as unknown as Record<string, unknown> | undefined

test("undo a delete: the task comes back with its own id, createdAt and every field, and the workspace stays valid", () => {
  const rich = t("keep", { details: "d", due: "2026-11-05", courseId: "c1", links: [{ label: "L", url: "https://a.dev" }], recordLinks: [{ kind: "log", id: today }], futureField: { x: 1 }, createdAt: "2026-10-01T00:00:00Z" })
  const other = t("other", { recordLinks: [{ kind: "task", id: "keep" }] })
  const before = ws({ tasks: [rich, other] })
  const after = removeTask(before, "keep")
  const plan = planUndo(undoDelete(rich), after, LATER)
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  const back = plan.change(after)
  const restored = find(back, "keep")!
  for (const k of ["id", "title", "details", "due", "courseId", "links", "recordLinks", "futureField", "createdAt", "starred", "done"]) assert.deepEqual(restored[k], (rich as unknown as Record<string, unknown>)[k], k)
  assert.equal(restored.updatedAt, LATER) // stamped now, so other devices see it as a fresh edit
  assert.deepEqual(find(back, "other"), find(after, "other")) // nothing else touched
  assert.equal(back.tasks.length, 2)
  assert.equal(validWorkspace(back), true)
  assert.equal(plan.done, "Task restored")
})

test("undo a delete is refused when the task is already back (nothing is duplicated)", () => {
  const a = t("a")
  const plan = planUndo(undoDelete(a), ws({ tasks: [a] }), LATER)
  assert.deepEqual(plan, { ok: false, reason: "That task is already back." })
})

test("undo a completion: done and completedAt go back exactly; undo a reopen brings back the old completedAt", () => {
  const open = t("a")
  const done = toggleTask(ws({ tasks: [open] }), "a", { now: () => NOW })
  assert.equal(find(done, "a")!.done, true)
  const plan = planUndo(undoToggle(open), done, LATER)
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  const back = find(plan.change(done), "a")!
  assert.equal(back.done, false)
  assert.equal("completedAt" in back && back.completedAt !== undefined, false)
  assert.equal(plan.done, "Reopened")

  const was = t("b", { done: true, completedAt: "2026-11-01T08:00:00Z" })
  const reopened = toggleTask(ws({ tasks: [was] }), "b", { now: () => NOW })
  const plan2 = planUndo(undoToggle(was), reopened, LATER)
  assert.equal(plan2.ok, true)
  if (!plan2.ok) return
  const again = find(plan2.change(reopened), "b")!
  assert.deepEqual([again.done, again.completedAt], [true, "2026-11-01T08:00:00Z"])
  assert.equal(plan2.done, "Marked done again")
})

test("undo is honest when the task changed or vanished meanwhile", () => {
  const open = t("a")
  const gone = planUndo(undoToggle(open), ws(), LATER)
  assert.deepEqual(gone, { ok: false, reason: "That task no longer exists." })
  // Completed here, then reopened on another device: undoing would complete it again, so leave it.
  const elsewhere = ws({ tasks: [open] })
  const refused = planUndo(undoToggle(open), elsewhere, LATER)
  assert.equal(refused.ok, false)
  if (!refused.ok) assert.match(refused.reason, /another device/)
})

test("snackbar sentences say what happened, with long titles clipped", () => {
  assert.equal(snackText(undoDelete(t("a", { title: "Pay rent" }))), 'Deleted "Pay rent"')
  assert.equal(snackText(undoToggle(t("a", { title: "Pay rent" }))), 'Completed "Pay rent"')
  assert.equal(snackText(undoToggle(t("a", { title: "Pay rent", done: true }))), 'Reopened "Pay rent"')
  assert.equal(snackText(undoDelete(t("a", { title: "x".repeat(60) }))), `Deleted "${"x".repeat(37)}…"`)
})

test("runUndo plans against the workspace at undo time and reports the real outcome", async () => {
  const a = t("a")
  let data = ws({ tasks: [] })
  const mutate = async (_keys: readonly ["tasks"], fn: (d: Collections) => Collections) => ((data = fn(structuredClone(data))), true)
  assert.equal(await runUndo(undoDelete(a), mutate, LATER), "Task restored")
  assert.deepEqual(data.tasks.map((x) => x.id), ["a"])
  assert.equal(await runUndo(undoDelete(a), mutate, LATER), "That task is already back.") // a second tap changes nothing
  assert.equal(data.tasks.length, 1)
  assert.equal(await runUndo(undoToggle(a), async () => false, LATER), "That couldn't be undone. Check the sync status.")
})

test("quick actions: what the long-press menu offers depends on the task", () => {
  const labels = (x: Collections["tasks"][number]) => quickActions(x, today).map((a) => a.label)
  assert.deepEqual(labels(t("a")), ["Complete", "Star", "Due today", "Due tomorrow", "Focus today", "Edit details", "Delete"])
  assert.deepEqual(labels(t("b", { due: today, starred: true, focusDate: today })), ["Complete", "Remove star", "Due tomorrow", "Remove from today's focus", "Edit details", "Delete"])
  assert.deepEqual(labels(t("c", { done: true })), ["Reopen", "Star", "Edit details", "Delete"]) // a done task isn't re-dated or focused
  assert.equal(quickActions(t("a"), today).find((a) => a.key === "delete")?.destructive, true)
})

test("quick actions save through the shared rules", () => {
  const data = ws({ tasks: [t("a"), t("b", { due: today, focusDate: today, details: "keep me" })] })
  const f = (id: string, key: Parameters<typeof applyQuickAction>[2], d = data) => find(applyQuickAction(d, id, key, today), id)
  assert.equal(f("a", "today")!.due, today)
  assert.equal(f("a", "tomorrow")!.due, "2026-11-05")
  assert.equal(f("a", "focus")!.focusDate, today)
  assert.equal(JSON.stringify(f("b", "focus")).includes("focusDate"), false) // removed, not set to null
  assert.equal(f("a", "star")!.starred, true)
  assert.equal(f("a", "complete")!.done, true)
  assert.equal(f("b", "today")!.details, "keep me")
  assert.equal(applyQuickAction(data, "a", "delete", today).tasks.length, 1)
  assert.equal(applyQuickAction(data, "a", "edit", today), data)
  assert.equal(applyQuickAction(data, "nope", "star", today), data)
  assert.equal(validWorkspace(applyQuickAction(data, "a", "focus", today)), true)
})

test("swipe: right past the threshold completes, left past halfway opens the strip, small or fast drags settle sensibly", () => {
  assert.equal(settle(COMPLETE_AT), "complete")
  assert.equal(settle(COMPLETE_AT - 1), "closed")
  assert.equal(settle(-REVEAL / 2), "open")
  assert.equal(settle(-REVEAL / 2 + 1), "closed")
  assert.equal(settle(-30, -0.8), "open") // a quick flick left
  assert.equal(settle(-5, -0.8), "closed") // too small to count
  assert.equal(settle(-REVEAL, 0.9), "closed") // flicked back while open
  assert.equal(positionFor(-500, false), -REVEAL)
  assert.equal(positionFor(500, false), MAX_RIGHT)
  assert.equal(positionFor(60, true), -REVEAL + 60) // dragging an open row back
  assert.equal(positionFor(-60, true), -REVEAL)
  assert.equal(claimsDrag(30, 5), true)
  assert.equal(claimsDrag(30, 30), false) // diagonal: the list scrolls
  assert.equal(claimsDrag(4, 0), false)
})

test("density: sanitiser, default, flip and row sizes (both keep a 44dp touch target)", () => {
  assert.deepEqual([...DENSITIES], ["compact", "comfortable"])
  assert.equal(DEFAULT_DENSITY, "comfortable")
  for (const d of DENSITIES) assert.equal(sanitizeDensity(d), d)
  for (const bad of [null, undefined, "", "Compact", "tight", 0, 1, {}, [], true]) assert.equal(sanitizeDensity(bad), "comfortable")
  assert.equal(otherDensity("compact"), "comfortable")
  assert.equal(otherDensity("comfortable"), "compact")
  for (const d of DENSITIES) assert.ok(rowMetrics(d).minHeight >= 44)
  assert.ok(rowMetrics("compact").vertical < rowMetrics("comfortable").vertical)
  assert.equal(rowMetrics("compact").titleLines, 1)
  assert.equal(rowMetrics("compact").showDetails, false)
  assert.equal(rowMetrics("comfortable").showDetails, true)
})

test("daily focus: today's focus tasks lead the Today tab once, filtered like the list, open before done", () => {
  const tasks = [
    t("late", { due: "2026-11-02" }),
    t("f1", { due: "2026-11-02", focusDate: today }), // overdue AND in focus: shown in the focus group only
    t("f2", { focusDate: today, starred: true }), // no due date at all
    t("fdone", { focusDate: today, done: true, completedAt: NOW, title: "Finished focus" }),
    t("old", { focusDate: "2026-11-03" }), // yesterday's focus is not today's
    t("now", { due: today }),
  ]
  const v = plannerRows(tasks, [], { tab: "today", search: "", today })
  assert.equal(v.focus?.title, "Focus today")
  assert.deepEqual(v.focus?.rows.map((r) => r.id), ["f1", "f2", "fdone"]) // open first (due order), done last
  assert.deepEqual(v.focus?.rows.map((r) => r.focused), [true, true, true])
  assert.deepEqual(v.sections.map((s) => s.rows.map((r) => r.id)), [["late"], ["now"]]) // no repeats
  assert.equal(v.total, 5)
  assert.equal(plannerRows(tasks, [], { tab: "today", search: "finished", today }).focus?.rows.length, 1)
  assert.equal(plannerRows(tasks, [], { tab: "today", search: "", today, starredOnly: true }).focus?.rows[0].id, "f2")
  assert.equal(plannerRows(tasks, [], { tab: "today", search: "zzz", today }).focus, null)
  // Other tabs list everything by the shared rules, with no focus group.
  const all = plannerRows(tasks, [], { tab: "all", search: "", today })
  assert.equal(all.focus, null)
  assert.ok(all.sections.flatMap((s) => s.rows).some((r) => r.id === "f1"))
  assert.equal(plannerRows(tasks, [], { tab: "done", search: "", today }).focus, null)
  // A day later, yesterday's focus is just a task again.
  assert.equal(plannerRows(tasks, [], { tab: "today", search: "", today: "2026-11-05" }).focus, null)
})

test("snackbar store: one at a time, stale dismissals ignored, actions run once and report", async () => {
  const seen: (string | undefined)[] = []
  const off = subscribeSnack(() => seen.push(getSnack()?.text))
  const first = showSnack("one")
  const second = showSnack("two", { label: "Undo", run: async () => "Done" })
  assert.equal(getSnack()?.text, "two")
  assert.equal(getSnack()?.ms, SNACK_MS)
  dismissSnack(first) // the first one is long gone
  assert.equal(getSnack()?.id, second)
  const snack = getSnack()!
  const running = runSnackAction(snack)
  assert.equal(getSnack()?.text, "Undoing…")
  await running
  assert.equal(getSnack()?.text, "Done")
  assert.equal(getSnack()?.action, undefined)
  assert.equal(getSnack()?.ms, RESULT_MS)
  await runSnackAction(snack) // a second tap on the old snackbar does nothing
  assert.equal(getSnack()?.text, "Done")
  showSnack("boom", { label: "Undo", run: async () => Promise.reject(new Error("x")) })
  await runSnackAction(getSnack()!)
  assert.equal(getSnack()?.text, "That couldn't be undone.")
  dismissSnack()
  assert.equal(getSnack(), null)
  off()
  assert.ok(seen.length >= 6)
})
