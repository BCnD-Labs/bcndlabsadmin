import assert from "node:assert/strict"
import { test } from "node:test"
import { saveJournal, saveJournalSections, saveJournalItem, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { LOG_PROMPTS, SAVE_LABEL, appendPrompt, completedOn, dayTitle, dueOn, entryText, previewLine, reconcileDrafts, recentEntries, saveState, shiftDay, shownText, timestampKey, weekStrip } from "../src/native/screens/planner/log/log-rules.ts"
import { ADDRESS, fakeServer, memoryStore, task, ts, ws } from "./workspace-fake.ts"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"

const today = "2026-11-04" // a Wednesday; its week is Mon Nov 2 to Sun Nov 8
const t = (id: string, extra: Record<string, unknown> = {}) => task(id, extra) as unknown as Collections["tasks"][number]
const entry = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, text, createdAt: ts, updatedAt: ts, ...extra }) as Collections["journal"][number]

test("the prompts are the web's, and each appends a section on its own line", () => {
  assert.deepEqual([...LOG_PROMPTS], ["shipped", "learned", "blocked on", "tomorrow"])
  assert.equal(appendPrompt("", "shipped"), "## shipped\n- ")
  assert.equal(appendPrompt("   \n", "learned"), "## learned\n- ")
  assert.equal(appendPrompt("Fixed the sync\n\n", "learned"), "Fixed the sync\n## learned\n- ")
  assert.equal(appendPrompt(appendPrompt("a", "shipped"), "tomorrow"), "a\n## shipped\n-\n## tomorrow\n- ") // same as the web: trailing whitespace is trimmed before the next section
})

test("day maths: titles, previous and next day across month and year ends", () => {
  assert.equal(dayTitle("2026-11-04", today), "Wed, Nov 4 · today")
  assert.equal(dayTitle("2026-11-03", today), "Tue, Nov 3")
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31")
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01")
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29")
  assert.equal(shiftDay(shiftDay(today, 1), -1), today)
})

test("a completion time is read in the phone's time zone, like the web's toDateKey(new Date(...))", () => {
  assert.equal(timestampKey("2026-11-05T03:00:00Z", 0), "2026-11-05")
  assert.equal(timestampKey("2026-11-05T03:00:00Z", 300), "2026-11-04") // UTC-5: still Wednesday evening
  assert.equal(timestampKey("2026-11-04T20:00:00Z", -540), "2026-11-05") // UTC+9: already Thursday
  assert.equal(timestampKey("2026-11-04T23:59:59.999Z", 0), "2026-11-04")
  assert.equal(timestampKey("not a time", 0), undefined)
})

test("completed this day: done tasks with a completedAt on that day, earliest first; open, undated and other days are left out", () => {
  const tasks = [
    t("late", { done: true, completedAt: "2026-11-04T18:00:00Z" }),
    t("early", { done: true, completedAt: "2026-11-04T09:00:00Z" }),
    t("other", { done: true, completedAt: "2026-11-03T09:00:00Z" }),
    t("open", { done: false, completedAt: "2026-11-04T10:00:00Z" }), // reopened elsewhere with a stale stamp
    t("nostamp", { done: true }),
  ]
  assert.deepEqual(completedOn(tasks, today, 0).map((x) => x.id), ["early", "late"])
  assert.deepEqual(completedOn(tasks, "2026-11-03", 0).map((x) => x.id), ["other"])
  assert.deepEqual(completedOn(tasks, "2026-11-05", 0), [])
  assert.deepEqual(completedOn(tasks, today, 600).map((x) => x.id), ["late"], "at UTC-10 the 09:00Z task falls on the previous evening")
})

test("due this day: the web log dialog's list, open before done", () => {
  const tasks = [t("done", { due: today, done: true, completedAt: "2026-11-04T08:00:00Z" }), t("b", { due: today }), t("a", { due: today, starred: true }), t("tmrw", { due: "2026-11-05" }), t("none")]
  assert.deepEqual(dueOn(tasks, today).map((x) => x.id), ["a", "b", "done"])
})

test("drafts: shown over the saved text, dropped once the workspace has the same text, kept otherwise", () => {
  const journal = [entry("2026-11-04", "saved text")]
  assert.equal(entryText(journal, today), "saved text")
  assert.equal(entryText(journal, "2026-11-03"), "")
  assert.equal(shownText({}, journal, today), "saved text")
  assert.equal(shownText({ [today]: "typing" }, journal, today), "typing")
  assert.equal(shownText({ [today]: "" }, journal, today), "", "clearing the box is a draft, not a fallback to the saved text")
  const drafts = { [today]: "typing", "2026-11-03": "other day" }
  assert.equal(reconcileDrafts(drafts, journal), drafts, "nothing caught up: the same object comes back")
  assert.deepEqual(reconcileDrafts({ [today]: "saved text", "2026-11-03": "other day" }, journal), { "2026-11-03": "other day" })
  assert.deepEqual(reconcileDrafts({ "2026-11-02": "   \n" }, journal), {}, "blank text is saved as no entry, so the draft is done")
  assert.deepEqual(reconcileDrafts({ [today]: "" }, journal), { [today]: "" }, "an emptied box still has to delete the saved entry")
})

test("save state for the status line: failed beats saving beats unsaved beats saved", () => {
  const journal = [entry(today, "x")]
  assert.equal(saveState(today, journal, {}, {}, {}), "saved")
  assert.equal(saveState("2026-11-03", journal, {}, {}, {}), "idle")
  assert.equal(saveState(today, journal, { [today]: "xy" }, {}, {}), "unsaved")
  assert.equal(saveState(today, journal, { [today]: "xy" }, { [today]: true }, {}), "saving")
  assert.equal(saveState(today, journal, { [today]: "xy" }, { [today]: true }, { [today]: true }), "failed")
  assert.equal(saveState(today, [entry(today, "  ")], {}, {}, {}), "idle")
  assert.match(SAVE_LABEL.failed, /kept here/)
})

test("week strip: Monday to Sunday around the day, dots on days with an entry or typed text", () => {
  const journal = [entry("2026-11-02", "mon"), entry("2026-11-06", "  "), entry("2026-11-09", "next week")]
  const strip = weekStrip("2026-11-04", today, journal, { "2026-11-07": "typed, not saved yet" })
  assert.deepEqual(strip.map((d) => d.key), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
  assert.deepEqual(strip.map((d) => d.weekday), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
  assert.deepEqual(strip.filter((d) => d.has).map((d) => d.num), [2, 7])
  assert.deepEqual(strip.filter((d) => d.selected).map((d) => d.num), [4])
  assert.deepEqual(strip.filter((d) => d.today).map((d) => d.num), [4])
  assert.equal(weekStrip("2026-11-01", today, [], {})[0].key, "2026-10-26", "a Sunday belongs to the week before")
})

test("recent entries: newest first, markdown markers stripped, blank entries skipped, limited", () => {
  assert.equal(previewLine("## shipped\n- the sync fix"), "shipped")
  assert.equal(previewLine("\n\n- \n  - went for a run"), "went for a run")
  assert.equal(previewLine("##\n- "), "")
  const journal = [entry("2026-10-01", "oldest"), entry("2026-11-03", "## learned\n- ids"), entry("2026-11-02", "   "), entry("2026-11-04", "today")]
  assert.deepEqual(recentEntries(journal, {}).map((e) => [e.day, e.preview]), [["2026-11-04", "today"], ["2026-11-03", "learned"], ["2026-10-01", "oldest"]])
  assert.deepEqual(recentEntries(journal, { "2026-11-05": "typed" }, 2).map((e) => e.day), ["2026-11-05", "2026-11-04"])
  assert.deepEqual(recentEntries(journal, { "2026-11-04": "" }).map((e) => e.day), ["2026-11-03", "2026-10-01"], "a cleared box is no entry")
})

test("saving a day's log goes through the shared rule: upsert, blank deletes, other fields and days stay", () => {
  const older = ws({ journal: [entry("2026-11-03", "keep", { mood: "good" } as never)] }) // an older/newer record shape: extra field
  const created = saveJournal(older, today, "hello", { now: () => "2026-11-04T10:00:00Z" })
  assert.deepEqual(created.journal.map((e) => e.id), ["2026-11-03", today])
  assert.equal((created.journal[0] as unknown as { mood: string }).mood, "good")
  const edited = saveJournal(created, today, "hello again", { now: () => "2026-11-04T11:00:00Z" })
  assert.equal(edited.journal[1].createdAt, "2026-11-04T10:00:00Z")
  assert.equal(edited.journal[1].updatedAt, "2026-11-04T11:00:00Z")
  assert.deepEqual(saveJournal(edited, today, "  \n").journal.map((e) => e.id), ["2026-11-03"])
  assert.ok(validWorkspace(edited))
})

test("through the workspace client: a log save reaches the server; a stale save is not silently overwritten", async () => {
  const server = fakeServer(ws({ journal: [entry("2026-11-03", "yesterday")] }), 4)
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: memoryStore() })
  await client.load()
  await client.mutate(["journal"], (d) => saveJournal(d, today, "## shipped\n- native log"))
  assert.equal(server.puts().length, 1)
  assert.equal(server.puts()[0].body?.revision, 4)
  assert.deepEqual(server.snap.data.journal.map((e) => [e.id, e.text]), [["2026-11-03", "yesterday"], [today, "## shipped\n- native log"]])
  // Another device changes the same day, then this phone saves it too: a conflict, nothing lost.
  server.other((d) => saveJournal(d, today, "from the web"))
  await client.mutate(["journal"], (d) => saveJournal(d, today, "from the phone"))
  assert.equal(client.getState().status, "conflict")
  assert.equal(server.snap.data.journal.find((e) => e.id === today)?.text, "from the web")
  assert.equal(client.getConflict()?.mine.journal.find((e) => e.id === today)?.text, "from the phone")
})


test("custom log sections sync with the main text and appear in date navigation", async () => {
  const server = fakeServer(ws({ journal: [entry(today, "Original main text")] }), 1)
  const cache = memoryStore()
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: cache })
  await client.load()
  const sections = [{ id: "morning", title: "Morning", text: "Wrote the plan" }]
  await client.mutate(["journal"], (data) => saveJournalSections(data, today, sections))
  assert.deepEqual(server.snap.data.journal[0].sections, sections)
  assert.equal(server.snap.data.journal[0].text, "Original main text")
  await client.mutate(["journal"], (data) => saveJournal(data, today, ""))
  const journal = server.snap.data.journal
  assert.equal(journal.length, 1, "clearing main text cannot delete custom section content")
  assert.deepEqual(journal[0].sections, sections)
  assert.equal(saveState(today, journal, {}, {}, {}), "saved")
  assert.ok(weekStrip(today, today, journal, {}).find((day) => day.key === today)?.has)
  assert.equal(recentEntries(journal, {})[0].preview, "Morning: Wrote the plan")
  const reopened = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: cache })
  await reopened.load()
  assert.deepEqual(reopened.getState().snapshot?.data.journal[0].sections, sections)
})


test("individual same-day log items and optional Notes survive a workspace-client round trip", async () => {
  const server = fakeServer(ws({ journal: [entry(today, "Existing main text")] }), 1)
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: memoryStore() })
  await client.load()
  const first = { id: "first", text: "Morning entry", createdAt: ts, updatedAt: ts }
  await client.mutate(["journal", "notes"], (data) => saveJournalItem(data, today, first, true))
  await client.mutate(["journal", "notes"], (data) => saveJournalItem(data, today, { id: "second", text: "Afternoon entry", createdAt: ts, updatedAt: ts }))
  await client.mutate(["journal", "notes"], (data) => saveJournalItem(data, today, first, true))
  assert.equal(server.snap.data.journal[0].text, "Existing main text")
  assert.equal(server.snap.data.journal[0].entries?.length, 2)
  assert.equal(server.snap.data.notes.length, 1)
  assert.equal(server.snap.data.notes[0].text, "Morning entry")
  assert.equal(server.snap.data.journal[0].entries?.[0].noteId, server.snap.data.notes[0].id)
  assert.equal(saveState(today, [{ ...server.snap.data.journal[0], text: "" }], {}, {}, {}), "saved")
})

test("learning reflections stay out of the daily log indicators and recent entries", () => {
  const stamp = "2026-11-04T10:00:00.000Z"
  const reflection = { id: "lrn_1", text: "## Learning reflection\nClicked: Wind", courseId: "course-1", createdAt: stamp, updatedAt: stamp }
  const journal = [{ id: today, text: "", entries: [reflection], createdAt: stamp, updatedAt: stamp }]
  assert.equal(saveState(today, journal, {}, {}, {}), "idle")
  assert.equal(weekStrip(today, today, journal, {}).find(day => day.key === today)?.has, false)
  assert.deepEqual(recentEntries(journal, {}), [])
})
