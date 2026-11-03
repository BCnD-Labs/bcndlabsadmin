import assert from "node:assert/strict"
import { test } from "node:test"
import { updateTask, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { cleanLinks, isSafeLink, linkProblem } from "../src/native/screens/planner/doc-links.ts"
import { courseLabel, isScored, typeAfterCourseChange, typeLabel, typeOptions } from "../src/native/screens/planner/learning-types.ts"
import { addRecordLink, describeLink, linkChoices, pickable, removeRecordLink } from "../src/native/screens/planner/record-links.ts"
import { addItem, buildReflection, emptyReflection, isOwnValue, reflectionDraft, reflectionPreview, reflectionProblem, removeItem, setItem } from "../src/native/screens/planner/reflection.ts"
import { extraErrors, extrasFromTask, extrasPatch, newExtras, type Extras } from "../src/native/screens/planner/task-extras.ts"
import { buildNewTask, buildPatch, draftErrors, draftFromTask, emptyDraft, type TaskDraft } from "../src/native/screens/planner/task-form.ts"
import { learningSummary, linksSummary, recordsSummary, scheduleSummary } from "../src/native/screens/planner/task-summary.ts"
import { note, task, ts, ws } from "./workspace-fake.ts"

const NOW = "2026-11-04T10:00:00.000Z"
const today = "2026-11-04"
const t = (id: string, extra: Record<string, unknown> = {}) => task(id, extra) as unknown as Collections["tasks"][number]
const course = (id: string, kind?: string) => ({ id, title: `Course ${id}`, code: `C${id}`, kind, instructor: "", instructorEmail: "", term: "", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", createdAt: ts, updatedAt: ts }) as unknown as Collections["courses"][number]
/** A draft for `existing` with extras changed. */
const edit = (existing: Collections["tasks"][number], change: Partial<Extras>): TaskDraft => {
  const d = draftFromTask(existing)
  return { ...d, extras: { ...d.extras!, ...change } }
}
const patch = (existing: Collections["tasks"][number], change: Partial<Extras>) => buildPatch(edit(existing, change), existing, NOW)

test("an untouched draft adds nothing to the patch beyond the base fields", () => {
  const rich = t("r", { courseId: "c1", learningType: "exam", score: 90, scheduledDate: "2026-11-06", scheduledTime: "10:00", durationMinutes: 45, focusDate: today, links: [{ label: "", url: " https://x.dev " }], recordLinks: [{ kind: "log", id: today }], reflection: { text: "ok", items: { help: "None" }, updatedAt: ts } })
  assert.deepEqual(Object.keys(buildPatch(draftFromTask(rich), rich, NOW)).sort(), ["completedAt", "details", "done", "due", "starred", "time", "title"])
  assert.deepEqual(extrasPatch(extrasFromTask(rich), rich, NOW), {}) // even the untidy link is left as it was
})

test("schedule: planned date, time and duration go in; clearing really clears", () => {
  const a = t("a")
  assert.deepEqual(patch(a, { scheduledDate: "2026-11-06", scheduledTime: "9:05", duration: "45" }), { ...buildPatch(draftFromTask(a), a, NOW), scheduledDate: "2026-11-06", scheduledTime: "09:05", durationMinutes: 45 })
  const planned = t("p", { scheduledDate: "2026-11-06", scheduledTime: "10:00", durationMinutes: 45 })
  const cleared = patch(planned, { scheduledDate: "", scheduledTime: "", duration: "" })
  assert.ok("scheduledDate" in cleared && cleared.scheduledDate === undefined)
  assert.ok("scheduledTime" in cleared && cleared.scheduledTime === undefined)
  assert.ok("durationMinutes" in cleared && cleared.durationMinutes === undefined)
  // Dropping the planned date drops its time even if the text is still there.
  assert.equal(patch(planned, { scheduledDate: "" }).scheduledTime, undefined)
  const after = updateTask(ws({ tasks: [planned] }), "p", cleared, { now: () => NOW }).tasks[0] as unknown as Record<string, unknown>
  for (const k of ["scheduledDate", "scheduledTime", "durationMinutes"]) assert.equal(JSON.parse(JSON.stringify(after))[k], undefined, k)
})

test("daily focus: set for today, cleared, and a focus on another day is kept unless cleared", () => {
  const a = t("a")
  assert.equal(patch(a, { focusDate: today }).focusDate, today)
  const focused = t("f", { focusDate: today })
  const off = patch(focused, { focusDate: "" })
  assert.ok("focusDate" in off && off.focusDate === undefined)
  const other = t("o", { focusDate: "2026-11-09" })
  assert.equal("focusDate" in buildPatch(draftFromTask(other), other, NOW), false)
  assert.equal(patch(other, { focusDate: today }).focusDate, today)
})

test("course and type: set with the course, dropped with it, score only with a course", () => {
  const a = t("a")
  const p = patch(a, { courseId: "c1", learningType: "exam" })
  assert.deepEqual([p.courseId, p.learningType, "score" in p], ["c1", "exam", false])
  const scored = t("s", { courseId: "c1", learningType: "exam", score: 80 })
  assert.equal(patch(scored, { score: "92.5" }).score, 92.5)
  const dropped = patch(scored, { courseId: "", learningType: "", score: "" })
  assert.deepEqual([dropped.courseId, dropped.learningType, dropped.score], [undefined, undefined, undefined])
  assert.ok("score" in dropped && "learningType" in dropped && "courseId" in dropped)
  // A stray score without a course is not written.
  assert.equal("score" in patch(a, { score: "50" }), false)
  // A course with no type yet (older record) keeps no type until one is picked.
  const old = t("old", { courseId: "c1" })
  assert.equal("learningType" in buildPatch(draftFromTask(old), old, NOW), false)
})

test("learning types follow the course kind as on the web", () => {
  assert.deepEqual(typeOptions().map((o) => o.value), ["assignment", "exam", "milestone", "event"])
  assert.equal(typeLabel("milestone", "certification"), "Exam domain")
  assert.equal(typeLabel("exam", "certification"), "Practice test")
  assert.equal(typeAfterCourseChange("", "course"), "assignment")
  assert.equal(typeAfterCourseChange("exam", "course"), "exam")
  assert.equal(typeAfterCourseChange("exam", "reading"), "milestone") // reading has no exam: its first type
  assert.equal(typeAfterCourseChange("assignment", "certification"), "assignment")
  assert.equal(isScored("certification", "exam"), true)
  assert.equal(isScored("course", "exam"), false)
  assert.equal(isScored(undefined, "exam"), false)
  assert.equal(courseLabel({ code: "GEG-123", title: "Energy" }), "GEG-123 · Energy")
  assert.equal(courseLabel({ code: "", title: "Energy" }), "Energy")
})

test("linked documents: web and app links pass, script and data links never; unsafe ones block instead of vanishing", () => {
  for (const ok of ["https://example.com", " HTTP://x.dev", "siyuan://blocks/1", "obsidian://open?vault=a", "vscode://file/x", "mailto:a@b.co", "ms-word:ofe|u|https://x"]) assert.equal(isSafeLink(ok), true, ok)
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://x", "example.com"]) assert.equal(isSafeLink(bad), false, bad)
  assert.deepEqual(cleanLinks([{ label: " Spec ", url: " https://a.dev/x " }, { label: "x", url: "  " }, { label: "", url: "https://b.dev/y" }]), [{ label: "Spec", url: "https://a.dev/x" }, { label: "b.dev", url: "https://b.dev/y" }])
  assert.match(linkProblem([{ label: "", url: "javascript:1" }]) ?? "", /web link/)
  assert.equal(linkProblem([{ label: "", url: "" }]), undefined)
  assert.match(linkProblem(Array.from({ length: 51 }, () => ({ label: "", url: "https://a.dev" }))) ?? "", /51|50/)
  const a = t("a")
  assert.deepEqual(patch(a, { links: [{ label: "Doc", url: "https://a.dev" }] }).links, [{ label: "Doc", url: "https://a.dev" }])
  const has = t("h", { links: [{ label: "Doc", url: "https://a.dev" }] })
  const gone = patch(has, { links: [] })
  assert.ok("links" in gone && gone.links === undefined)
  assert.match(extraErrors({ ...extrasFromTask(a), links: [{ label: "", url: "javascript:1" }] }).links ?? "", /web link/)
  assert.match(draftErrors(edit(a, { links: [{ label: "", url: "javascript:1" }] })).links ?? "", /web link/)
})

test("reflection: the shared limits, optional items, and updatedAt only moves on a real change", () => {
  const empty = emptyReflection()
  assert.equal(buildReflection(empty, undefined, NOW), undefined)
  const d = setItem(addItem(empty, "difficulty"), "difficulty", "Hard")
  assert.deepEqual(buildReflection({ ...d, text: "Tough one" }, undefined, NOW), { text: "Tough one", items: { difficulty: "Hard" }, updatedAt: NOW })
  const stored = { text: "Tough one", items: { difficulty: "Hard" }, updatedAt: ts }
  assert.equal(buildReflection(reflectionDraft(stored as never), stored as never, NOW), stored) // untouched: same object, old timestamp
  assert.equal(buildReflection({ text: "Tough one", items: { difficulty: "Easy" } }, stored as never, NOW)?.updatedAt, NOW)
  assert.equal(buildReflection({ text: "  ", items: {} }, stored as never, NOW), undefined) // emptied: removed
  assert.deepEqual(removeItem(addItem(addItem(empty, "help"), "outcome"), "help").items, { outcome: "" })
  assert.equal(addItem(d, "difficulty"), d) // already there
  assert.equal(isOwnValue("nextTime", ""), true) // no choices: free text
  assert.equal(isOwnValue("difficulty", ""), false)
  assert.equal(isOwnValue("difficulty", "Hard"), false)
  assert.equal(isOwnValue("difficulty", "Brutal"), true)
  assert.match(reflectionProblem({ text: "x".repeat(100_001), items: {} }) ?? "", /too long/)
  assert.match(reflectionProblem({ text: "", items: { learned: "x".repeat(10_001) } }) ?? "", /too long/)
  assert.equal(reflectionPreview(empty), "No reflection yet")
  assert.equal(reflectionPreview({ text: "Went fine\nsecond line", items: { help: "None", outcome: "" } }), "Went fine · 2 items")
  // Through the form: text in, validates, then cleared again.
  const a = t("a")
  const withRef = { ...a, ...patch(a, { reflection: { text: "Fine", items: { timeSpent: "42 min" } } }) }
  assert.deepEqual(withRef.reflection, { text: "Fine", items: { timeSpent: "42 min" }, updatedAt: NOW })
  assert.equal(validWorkspace(ws({ tasks: [withRef] })), true)
  assert.equal(patch(withRef, { reflection: emptyReflection() }).reflection, undefined)
  assert.ok("reflection" in patch(withRef, { reflection: emptyReflection() }))
})

test("an item the screen doesn't list is carried through a reflection edit", () => {
  const odd = t("odd", { reflection: { text: "a", items: { learned: "x", futureItem: "keep" }, updatedAt: ts } })
  const p = patch(odd, { reflection: { text: "b", items: { learned: "x", futureItem: "keep" } } })
  assert.deepEqual(p.reflection?.items, { learned: "x", futureItem: "keep" })
})

test("linked records: choices, picking, no duplicates, the 50 limit, deleted targets stay visible", () => {
  const data = ws({ notes: [note("n1", "First line\nmore"), note("n2", "")], tasks: [t("a"), t("b", { title: "Beta" })], journal: [{ id: "2026-11-02", text: "x", createdAt: ts, updatedAt: ts }] })
  assert.deepEqual(linkChoices("note", data, undefined, today), [{ id: "n1", title: "First line" }, { id: "n2", title: "Untitled note" }])
  assert.deepEqual(linkChoices("task", data, "a", today).map((c) => c.id), ["b"]) // not itself
  assert.deepEqual(linkChoices("log", data, "a", today).map((c) => c.id), [today, "2026-11-02"]) // today first, newest first
  assert.equal(linkChoices("log", data, "a", today)[0].title, "Wed, Nov 4, 2026")
  let links = addRecordLink([], "note", "n1")
  assert.deepEqual(addRecordLink(links, "note", "n1"), links)
  links = addRecordLink(links, "task", "n1") // same id, other kind: allowed
  assert.equal(links.length, 2)
  assert.deepEqual(pickable(linkChoices("note", data, "a", today), links, "note", ""), [{ id: "n2", title: "Untitled note" }])
  assert.deepEqual(pickable(linkChoices("task", data, undefined, today), [], "task", " BET "), [{ id: "b", title: "Beta" }])
  assert.deepEqual(removeRecordLink(links, { kind: "note", id: "n1" }), [{ kind: "task", id: "n1" }])
  const full = Array.from({ length: 50 }, (_, i) => ({ kind: "note" as const, id: `n${i}` }))
  assert.equal(addRecordLink(full, "note", "extra").length, 50)
  assert.deepEqual(describeLink({ kind: "note", id: "gone" }, data), { key: "note:gone", link: { kind: "note", id: "gone" }, label: "Note: Deleted note", missing: true })
  assert.equal(describeLink({ kind: "task", id: "b" }, data).label, "Task: Beta")
  assert.equal(describeLink({ kind: "log", id: "2026-11-02" }, data).label, "Log: Mon, Nov 2, 2026")
  const a = t("a")
  const p = patch(a, { recordLinks: [{ kind: "note", id: "n1" }] })
  assert.deepEqual(p.recordLinks, [{ kind: "note", id: "n1" }])
  assert.equal(validWorkspace(ws({ tasks: [{ ...a, ...p }] })), true)
  assert.equal(patch({ ...a, ...p }, { recordLinks: [] }).recordLinks, undefined)
})

test("validation: bad schedule, duration, score and log links are reported per section; the shared validator is the last word", () => {
  const a = t("a")
  assert.equal(extraErrors({ ...extrasFromTask(a), scheduledDate: "2026-02-30" }).schedule, "Pick a valid planned date.")
  assert.equal(extraErrors({ ...extrasFromTask(a), scheduledDate: "2026-11-06", scheduledTime: "25:00" }).schedule, "Use 24-hour time, like 09:30.")
  assert.deepEqual(extraErrors({ ...extrasFromTask(a), scheduledDate: "2026-11-06", scheduledTime: "" }), {})
  assert.equal(extraErrors({ ...extrasFromTask(a), duration: "3" }).duration, "Use 5 to 1440 minutes.")
  assert.equal(extraErrors({ ...extrasFromTask(a), duration: "1441" }).duration, "Use 5 to 1440 minutes.")
  assert.equal(extraErrors({ ...extrasFromTask(a), duration: "abc" }).duration, "Use 5 to 1440 minutes.")
  assert.deepEqual(extraErrors({ ...extrasFromTask(a), duration: "5" }), {})
  assert.equal(extraErrors({ ...extrasFromTask(a), courseId: "c1", score: "101" }).score, "Use 0 to 100.")
  assert.equal(extraErrors({ ...extrasFromTask(a), courseId: "c1", score: "-1" }).score, "Use 0 to 100.")
  assert.equal(extraErrors({ ...extrasFromTask(a), courseId: "c1", score: "x" }).score, "Use 0 to 100.")
  assert.deepEqual(extraErrors({ ...extrasFromTask(a), courseId: "", score: "999" }), {}) // no course: score ignored
  assert.match(extraErrors({ ...extrasFromTask(a), recordLinks: [{ kind: "log", id: "nope" }] }).other ?? "", /can't be saved/)
  assert.equal(draftErrors({ ...emptyDraft(), title: "x" }).title, undefined)
})

test("an old oddity in an untouched section never blocks an unrelated edit", () => {
  const odd = t("odd", { links: [{ label: "x", url: "javascript:1" }], reflection: { text: "a", items: { futureItem: "k" }, updatedAt: ts } })
  const d = draftFromTask(odd)
  assert.deepEqual(draftErrors(d, d), {})
  assert.deepEqual(draftErrors({ ...d, title: "Renamed" }, d), {})
  assert.ok(draftErrors({ ...d, extras: { ...d.extras!, links: [...d.extras!.links, { label: "", url: "https://ok.dev" }] } }, d).links) // touching it checks it again
})

test("new tasks: only fields with a value, and the result is a valid workspace", () => {
  assert.deepEqual(newExtras(undefined, NOW), {})
  assert.deepEqual(newExtras({ ...extrasFromTask(t("x")), focusDate: today }, NOW), { focusDate: today })
  const made = buildNewTask({ ...emptyDraft(today), title: "Plan", extras: { ...extrasFromTask(t("x")), courseId: "c1", learningType: "exam", scheduledDate: "2026-11-06", scheduledTime: "7:30", duration: "60", links: [{ label: "", url: "https://a.dev/p" }], recordLinks: [{ kind: "log", id: today }], reflection: { text: "n", items: {} } } }, NOW)
  assert.deepEqual(made, { title: "Plan", starred: false, done: false, due: today, courseId: "c1", learningType: "exam", scheduledDate: "2026-11-06", scheduledTime: "07:30", durationMinutes: 60, links: [{ label: "a.dev", url: "https://a.dev/p" }], recordLinks: [{ kind: "log", id: today }], reflection: { text: "n", items: {}, updatedAt: NOW } })
  assert.equal(validWorkspace(ws({ tasks: [{ ...t("n"), ...made }] })), true)
})

test("summaries say only what the draft holds", () => {
  const a = extrasFromTask(t("a"))
  assert.equal(scheduleSummary(a, today), "Not scheduled")
  assert.equal(scheduleSummary({ ...a, scheduledDate: "2026-11-06", scheduledTime: "10:00", duration: "45", focusDate: today }, today), "Nov 6 10:00 · 45 min · Focus today")
  assert.equal(scheduleSummary({ ...a, focusDate: "2026-11-09" }, today), "Focus Nov 9")
  assert.equal(learningSummary(a, []), "No course")
  const cert = course("1", "certification")
  assert.equal(learningSummary({ ...a, courseId: "1", learningType: "exam", score: "88" }, [cert]), "C1 · Course 1 · Practice test · 88%")
  assert.equal(learningSummary({ ...a, courseId: "gone" }, [cert]), "Unknown course")
  assert.deepEqual([linksSummary(a), recordsSummary(a)], ["None", "None"])
  assert.equal(linksSummary({ ...a, links: [{ label: "", url: "u" }] }), "1 link")
  assert.equal(recordsSummary({ ...a, recordLinks: [{ kind: "note", id: "1" }, { kind: "note", id: "2" }] }), "2 linked records")
})
