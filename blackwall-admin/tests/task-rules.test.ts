import assert from "node:assert/strict"
import { test } from "node:test"
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns"
import { addDaysToKey, daysBetween, weekdayOfKey } from "../shared/date-keys.ts"
import {
  GROUP_ORDER, TAB_GROUPS, TASK_FILTERS, compareTasks, groupOf, inHomeTab, inTab, isForToday, isOverdue, matchesFilter,
  matchesSearch, normalizeSearch, parseQuickAdd, reflectionSummary, taskGroups, taskRows, type TaskTab,
} from "../shared/task-rules.ts"
import type { Task } from "../src/lib/types.ts"

const TODAY = "2026-11-04" // a Wednesday
const T0 = "2026-11-01T08:00:00.000Z"
const task = (patch: Partial<Task> = {}): Task => ({ id: "t", title: "Read chapter", starred: false, done: false, createdAt: T0, updatedAt: T0, ...patch })
const ids = (rows: Task[]) => rows.map((t) => t.id)

// Date keys must behave exactly like the date-fns calls the web used.
test("date-key math matches date-fns across month, year, leap and week boundaries", () => {
  const first = parseISO("2023-12-20")
  for (let i = 0; i < 1500; i++) {
    const day = addDays(first, i)
    const key = format(day, "yyyy-MM-dd")
    assert.equal(weekdayOfKey(key), getDay(day), key)
    for (const n of [-400, -31, -8, -7, -1, 0, 1, 2, 7, 8, 30, 31, 366]) {
      const other = addDays(day, n)
      assert.equal(addDaysToKey(key, n), format(other, "yyyy-MM-dd"), `${key} + ${n}`)
      assert.equal(daysBetween(format(other, "yyyy-MM-dd"), key), differenceInCalendarDays(other, day), `${key} + ${n}`)
    }
  }
  assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01")
  assert.equal(addDaysToKey("2028-02-28", 1), "2028-02-29")
  assert.equal(addDaysToKey("2026-03-01", -1), "2026-02-28")
  assert.equal(weekdayOfKey("2026-11-01"), 0, "Sunday")
  assert.equal(weekdayOfKey("2026-11-07"), 6, "Saturday")
})

test("invalid date keys give NaN or undefined instead of throwing", () => {
  for (const bad of ["tomorrow", "2026-02-30", "2026-13-01", "2026-1-5"]) {
    assert.ok(Number.isNaN(daysBetween(bad, TODAY)), bad)
    assert.equal(addDaysToKey(bad, 1), undefined)
    assert.ok(Number.isNaN(weekdayOfKey(bad)))
    assert.equal(groupOf(task({ due: bad }), TODAY), "Later", "unparseable due keeps the web behavior")
    assert.equal(inTab(task({ due: bad }), "today", TODAY), false)
  }
})

test("groupOf covers every boundary and GROUP_ORDER lists the groups in display order", () => {
  const g = (due?: string) => groupOf(task({ due }), TODAY)
  assert.equal(g(undefined), "No date")
  assert.equal(g("2020-01-01"), "Overdue")
  assert.equal(g("2026-11-03"), "Overdue")
  assert.equal(g("2026-11-04"), "Today")
  assert.equal(g("2026-11-05"), "Tomorrow")
  assert.equal(g("2026-11-06"), "Next 7 days")
  assert.equal(g("2026-11-11"), "Next 7 days", "today + 7 is still Next 7 days")
  assert.equal(g("2026-11-12"), "Later", "today + 8")
  assert.equal(groupOf(task({ due: "2027-01-01" }), "2026-12-31"), "Tomorrow", "year boundary")
  assert.equal(groupOf(task({ due: "2026-03-01" }), "2026-02-28"), "Tomorrow", "month boundary")
  assert.deepEqual(GROUP_ORDER, ["Overdue", "Today", "Tomorrow", "Next 7 days", "Later", "No date"])
})

test("compareTasks: open before done, by date, undated last, starred first, then created", () => {
  const a = task({ id: "a", due: "2026-11-05" })
  const b = task({ id: "b", due: "2026-11-04" })
  const c = task({ id: "c" })
  const d = task({ id: "d", done: true, completedAt: "2026-11-02T00:00:00Z", due: "2026-11-01" })
  assert.deepEqual(ids([d, c, a, b].sort(compareTasks)), ["b", "a", "c", "d"])
  const star = task({ id: "star", due: "2026-11-05", starred: true, createdAt: "2026-11-03T00:00:00Z" })
  assert.deepEqual(ids([a, star].sort(compareTasks)), ["star", "a"], "starred wins within a day, even if created later")
  const early = task({ id: "early", due: "2026-11-05", createdAt: "2026-10-01T00:00:00Z" })
  assert.deepEqual(ids([a, early].sort(compareTasks)), ["early", "a"], "ties fall to createdAt")
  assert.equal(compareTasks(a, { ...a }), 0)
  const recent = task({ id: "r", done: true, completedAt: "2026-11-03T00:00:00Z" })
  const nocomp = task({ id: "n", done: true })
  assert.deepEqual(ids([nocomp, d, recent].sort(compareTasks)), ["r", "d", "n"], "done: latest completion first, missing last")
})

const sample = [
  task({ id: "over", due: "2026-11-02" }),
  task({ id: "today", due: TODAY, starred: true }),
  task({ id: "tom", title: "Tom's report", due: "2026-11-05" }),
  task({ id: "later", due: "2026-12-25" }),
  task({ id: "none" }),
  task({ id: "none-star", starred: true }),
  task({ id: "done", done: true, due: TODAY, completedAt: "2026-11-04T01:00:00Z" }),
]

test("planner tabs: today, next, all and done", () => {
  const pick = (tab: TaskTab) => ids(sample.filter((t) => inTab(t, tab, TODAY)))
  assert.deepEqual(pick("today"), ["over", "today"])
  assert.deepEqual(pick("next"), ["tom", "later"], "undated tasks are not in Next")
  assert.deepEqual(pick("all"), ["over", "today", "tom", "later", "none", "none-star"])
  assert.deepEqual(pick("done"), ["done"])
  assert.deepEqual(TAB_GROUPS.all, GROUP_ORDER)
})

test("home filters: Today includes starred, Upcoming is the rest of the open tasks", () => {
  const pick = (f: (typeof TASK_FILTERS)[number]["value"]) => ids(sample.filter((t) => matchesFilter(t, f, TODAY)))
  assert.deepEqual(pick("today"), ["over", "today", "none-star"])
  assert.deepEqual(pick("upcoming"), ["tom", "later", "none"])
  assert.deepEqual(pick("all"), ["over", "today", "tom", "later", "none", "none-star"])
  assert.deepEqual(pick("done"), ["done"])
  assert.deepEqual(TASK_FILTERS.map((f) => f.label), ["Today", "Upcoming", "All", "Done"])
  assert.equal(isForToday(sample[6], TODAY), false)
  assert.equal(isOverdue(sample[0], TODAY), true)
  assert.equal(isOverdue(sample[1], TODAY), false)
  assert.equal(isOverdue(task({ due: "2026-11-01", done: true }), TODAY), false)
  assert.deepEqual(ids(sample.filter((t) => inHomeTab(t, "next", TODAY))), ["tom", "later", "none", "none-star"], "home Next includes undated")
  assert.deepEqual(ids(sample.filter((t) => inHomeTab(t, "today", TODAY))), ["over", "today"])
})

test("search matches title, details and reflection, case-insensitively, after trimming", () => {
  const t = task({ title: "Essay Draft", details: "Cite the Sources", reflection: { text: "Went Fine", items: { difficulty: "Hard" }, updatedAt: T0 } })
  assert.equal(reflectionSummary(t), "Went Fine · Hard")
  assert.equal(reflectionSummary(task()), "")
  for (const q of ["essay", "  DRAFT  ", "sources", "went fine", "hard", "fine · hard", ""]) assert.ok(matchesSearch(t, normalizeSearch(q)), q)
  assert.equal(matchesSearch(t, normalizeSearch("zebra")), false)
  assert.equal(matchesSearch(task(), "chapter"), true)
})

test("taskRows combines tab, lingering, search and starred, then sorts", () => {
  assert.deepEqual(ids(taskRows(sample, { tab: "today", today: TODAY })), ["over", "today"])
  assert.deepEqual(ids(taskRows(sample, { tab: "all", today: TODAY, starredOnly: true })), ["today", "none-star"])
  assert.deepEqual(ids(taskRows(sample, { tab: "all", today: TODAY, query: " TOM " })), ["tom"])
  assert.deepEqual(ids(taskRows(sample, { tab: "today", today: TODAY, lingering: new Set(["done"]) })), ["over", "today", "done"], "lingering done task stays")
  assert.deepEqual(ids(taskRows(sample, { tab: "done", today: TODAY })), ["done"])
  assert.deepEqual(ids(taskRows(sample, { tab: "done", today: TODAY, query: "nothing" })), [])
})

test("taskGroups splits rows per view and files lingering done tasks under the first group", () => {
  const names = (tab: TaskTab, lingering?: Set<string>) => taskGroups(taskRows(sample, { tab, today: TODAY, lingering }), { tab, today: TODAY, lingering }).map((g) => [g.name, ids(g.items)])
  assert.deepEqual(names("today"), [["Overdue", ["over"]], ["Today", ["today"]]])
  assert.deepEqual(names("next"), [["Tomorrow", ["tom"]], ["Later", ["later"]]])
  assert.deepEqual(names("all"), [["Overdue", ["over"]], ["Today", ["today"]], ["Tomorrow", ["tom"]], ["Later", ["later"]], ["No date", ["none-star", "none"]]])
  assert.deepEqual(names("done"), [[null, ["done"]]])
  // Web quirk, kept as is: a lingering done task is added to the first group AND its own group.
  assert.deepEqual(names("today", new Set(["done"])), [["Overdue", ["over", "done"]], ["Today", ["today", "done"]]])
  const doneOverdue = [...sample, task({ id: "d2", done: true, due: "2026-11-01", completedAt: "2026-11-04T02:00:00Z" })]
  const rows = taskRows(doneOverdue, { tab: "today", today: TODAY, lingering: new Set(["d2"]) })
  assert.deepEqual(taskGroups(rows, { tab: "today", today: TODAY, lingering: new Set(["d2"]) }).map((g) => [g.name, ids(g.items)]), [["Overdue", ["over", "d2"]], ["Today", ["today"]]], "a done task already in the first group is listed once")
})

// The pre-extraction web parser, driven by an explicit "now" instead of new Date(), as the oracle.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
function oldParse(input: string, now: Date) {
  const text = input.trim()
  const m = text.match(/\s+([a-z]+)$/i)
  if (!m) return { title: text }
  const title = text.slice(0, m.index).trim()
  const word = m[1].toLowerCase().replace(/^weds$/, "wed")
  if (!title) return { title: text }
  if (word === "today") return { title, due: format(now, "yyyy-MM-dd") }
  if (["tomorrow", "tmrw", "tmr"].includes(word)) return { title, due: format(addDays(now, 1), "yyyy-MM-dd") }
  const idx = word.length >= 3 ? WEEKDAYS.findIndex((d) => d.startsWith(word)) : -1
  if (idx < 0) return { title: text }
  return { title, due: format(addDays(now, (idx - getDay(now) + 7) % 7), "yyyy-MM-dd") }
}

test("parseQuickAdd with a fixed today", () => {
  const p = (s: string, today = TODAY) => parseQuickAdd(s, today)
  assert.deepEqual(p("Buy milk today"), { title: "Buy milk", due: TODAY })
  assert.deepEqual(p("Buy milk TOMORROW"), { title: "Buy milk", due: "2026-11-05" })
  assert.deepEqual(p("Call mom tmrw"), { title: "Call mom", due: "2026-11-05" })
  assert.deepEqual(p("Call mom tmr"), { title: "Call mom", due: "2026-11-05" })
  assert.deepEqual(p("Essay wed"), { title: "Essay", due: TODAY }, "a matching weekday means today")
  assert.deepEqual(p("Essay thu"), { title: "Essay", due: "2026-11-05" })
  assert.deepEqual(p("Essay thurs"), { title: "Essay", due: "2026-11-05" })
  assert.deepEqual(p("Essay weds"), { title: "Essay", due: TODAY })
  assert.deepEqual(p("Essay friday"), { title: "Essay", due: "2026-11-06" })
  assert.deepEqual(p("Essay tuesday"), { title: "Essay", due: "2026-11-10" }, "yesterday's weekday is next week")
  assert.deepEqual(p("Essay mon"), { title: "Essay", due: "2026-11-09" })
  assert.deepEqual(p("Essay sun"), { title: "Essay", due: "2026-11-08" })
  assert.deepEqual(p("  Replace monitor  "), { title: "Replace monitor" }, "unknown last word is part of the title")
  assert.deepEqual(p("today"), { title: "today" }, "a lone date word is the title")
  assert.deepEqual(p("Essay th"), { title: "Essay th" }, "two letters are too short")
  assert.deepEqual(p("Essay fri."), { title: "Essay fri." })
  assert.deepEqual(p("Essay tomorrow at 5"), { title: "Essay tomorrow at 5" }, "times are not parsed")
  assert.deepEqual(p("", TODAY), { title: "" })
  assert.deepEqual(p("Pay rent tomorrow", "2026-12-31"), { title: "Pay rent", due: "2027-01-01" })
  assert.deepEqual(p("Pay rent fri", "2028-02-27"), { title: "Pay rent", due: "2028-03-03" }, "leap-year Feb")
})

test("parseQuickAdd equals the old date-fns parser for every day of two years and every word", () => {
  const words = ["today", "tomorrow", "tmrw", "tmr", "mon", "tue", "tues", "wed", "weds", "thu", "thur", "thurs", "fri", "sat", "sun", "monday", "sunday", "mo", "zzz", "Friday", "FRI"]
  const first = parseISO("2027-01-01")
  for (let i = 0; i < 731; i++) {
    const now = addDays(first, i)
    const key = format(now, "yyyy-MM-dd")
    for (const w of words) assert.deepEqual(parseQuickAdd(`Do thing ${w}`, key), oldParse(`Do thing ${w}`, now), `${key} ${w}`)
  }
})
