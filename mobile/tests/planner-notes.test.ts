import assert from "node:assert/strict"
import { test } from "node:test"
import { createNote, removeNote, togglePin, updateNote, validWorkspace, type Collections } from "../src/lib/shared.ts"
import { buildNewNote, buildNotePatch, draftFromNote, emptyNoteDraft, noteDirty, noteErrors } from "../src/native/screens/planner/notes/note-form.ts"
import { NOTE_COLORS, colorCounts, colorOf, courseFor, courseLabel, notePreview, noteTitle, orderNotes, shortAgo } from "../src/native/screens/planner/notes/note-rules.ts"
import { notePaper } from "../src/theme.ts"
import { ADDRESS, fakeServer, memoryStore, ts, ws } from "./workspace-fake.ts"
import { createWorkspaceClient } from "../src/lib/workspace-client.ts"

type Note = Collections["notes"][number]
const n = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, text, color: "plain", pinned: false, createdAt: ts, updatedAt: ts, ...extra }) as unknown as Note
const course = (id: string, code: string, title: string) => ({ id, code, title, instructor: "", instructorEmail: "", term: "", schedule: "", location: "", url: "", description: "", tags: [], color: "blue", createdAt: ts, updatedAt: ts }) as unknown as Collections["courses"][number]
const ids = (list: Note[]) => list.map((x) => x.id)

const notes = [
  n("old", "Old idea\nmore", { updatedAt: "2026-10-01T00:00:00Z" }),
  n("pinA", "Speech outline", { pinned: true, color: "amber", updatedAt: "2026-11-01T00:00:00Z" }),
  n("new", "Homelab backup plan", { color: "teal", updatedAt: "2026-11-03T00:00:00Z" }),
  n("pinB", "Exam dates", { pinned: true, color: "blue", updatedAt: "2026-11-02T00:00:00Z" }),
  n("odd", "From a newer app version", { color: "neon", updatedAt: "2026-10-15T00:00:00Z" }),
]

test("ordering: pinned notes first, each group newest edit first", () => {
  const g = orderNotes(notes, { search: "" })
  assert.deepEqual(ids(g.pinned), ["pinB", "pinA"])
  assert.deepEqual(ids(g.others), ["new", "odd", "old"])
})

test("search: text only, case-insensitive, trimmed; order is kept; empty result is empty", () => {
  assert.deepEqual(ids(orderNotes(notes, { search: "  HOMELAB " }).others), ["new"])
  assert.deepEqual(ids(orderNotes(notes, { search: "e" }).pinned), ["pinB", "pinA"])
  const none = orderNotes(notes, { search: "zzz" })
  assert.deepEqual([none.pinned.length, none.others.length], [0, 0])
})

test("colour filter: the web's five values; an unknown colour counts as plain; filter and search combine", () => {
  assert.deepEqual(NOTE_COLORS.map((c) => c.value), ["plain", "amber", "teal", "rose", "blue"])
  assert.deepEqual(NOTE_COLORS.map((c) => c.label), ["Plain", "Yellow", "Mint", "Pink", "Blue"])
  assert.deepEqual(Object.keys(notePaper), NOTE_COLORS.map((c) => c.value), "every colour has paper")
  assert.deepEqual(ids(orderNotes(notes, { search: "", color: "plain" }).others), ["odd", "old"])
  assert.deepEqual(ids(orderNotes(notes, { search: "", color: "amber" }).pinned), ["pinA"])
  assert.deepEqual(ids(orderNotes(notes, { search: "plan", color: "teal" }).others), ["new"])
  assert.deepEqual(ids(orderNotes(notes, { search: "plan", color: "blue" }).others), [])
  assert.equal(colorOf("neon"), "plain")
  assert.deepEqual(colorCounts(notes), { plain: 2, amber: 1, teal: 1, rose: 0, blue: 1 })
})

test("titles, previews and ages read like the web's", () => {
  assert.equal(noteTitle("  First line\nsecond"), "First line")
  assert.equal(noteTitle("   \n"), "Empty note")
  assert.equal(noteTitle("x".repeat(120)).length, 80)
  assert.equal(notePreview("Title\n\n  one \n two"), "one two")
  assert.equal(notePreview("Only a title"), "")
  const now = new Date("2026-11-04T12:00:00Z")
  assert.deepEqual(["2026-11-04T12:00:00Z", "2026-11-04T11:55:00Z", "2026-11-04T09:00:00Z", "2026-11-02T12:00:00Z", "2026-10-21T12:00:00Z", "bad", "2026-11-05T12:00:00Z"].map((t) => shortAgo(t, now)), ["now", "5m", "3h", "2d", "2w", "", "now"])
})

test("courses: the web's label (code, else initials) and lookup", () => {
  const courses = [course("c1", "GEG-123", "Energy Resources"), course("c2", "", "Intro to Speech Communication")]
  assert.equal(courseLabel(courses[0]), "GEG-123")
  assert.equal(courseLabel(courses[1]), "ITS")
  assert.deepEqual(courseFor(courses, "c1"), { id: "c1", label: "GEG-123", title: "Energy Resources" })
  assert.equal(courseFor(courses, "gone"), undefined)
  assert.equal(courseFor(courses, undefined), undefined)
})

test("form: a new note starts yellow and unpinned, needs text, and has no course key unless one is picked", () => {
  const d = emptyNoteDraft()
  assert.deepEqual(d, { text: "", color: "amber", pinned: false })
  assert.deepEqual(noteErrors(d), { text: "Write something first." })
  assert.deepEqual(noteErrors({ ...d, text: " \n " }), { text: "Write something first." })
  assert.deepEqual(noteErrors({ ...d, text: "hi" }), {})
  assert.deepEqual(buildNewNote({ ...d, text: "  hi  " }), { text: "  hi  ", color: "amber", pinned: false })
  assert.ok(!("courseId" in buildNewNote({ ...d, text: "hi" })))
  assert.deepEqual(buildNewNote({ text: "hi", color: "rose", pinned: true, courseId: "c1" }), { text: "hi", color: "rose", pinned: true, courseId: "c1" })
  const created = createNote(ws(), buildNewNote({ ...d, text: "hi" }), { makeId: (p) => `${p}_x`, now: () => "2026-11-04T10:00:00Z" })
  assert.equal(created.record.id, "nte_x")
  assert.equal(created.data.notes[0].text, "hi")
  assert.ok(validWorkspace(created.data))
})

test("form: dirty only when a field differs; a cleared course is an explicit undefined", () => {
  const base = n("a", "text", { color: "teal", pinned: true, courseId: "c1" })
  const d = draftFromNote(base)
  assert.deepEqual(d, { text: "text", color: "teal", pinned: true, courseId: "c1" })
  assert.equal(noteDirty(d, draftFromNote(base)), false)
  for (const change of [{ text: "text!" }, { color: "rose" as const }, { pinned: false }, { courseId: undefined }]) assert.equal(noteDirty({ ...d, ...change }, d), true, JSON.stringify(change))
  const patch = buildNotePatch({ ...d, courseId: undefined })
  assert.ok("courseId" in patch && patch.courseId === undefined)
  assert.deepEqual(Object.keys(buildNotePatch(d)).sort(), ["color", "courseId", "pinned", "text"])
})

test("older-shape note (no course, no links) edits fine and gains nothing it was not given", () => {
  const old = { id: "o", text: "plain old note", color: "plain", pinned: false, createdAt: ts, updatedAt: ts } as Note
  assert.ok(validWorkspace(ws({ notes: [old] })))
  const d = { ...draftFromNote(old), text: "plain old note, edited" }
  const out = updateNote(ws({ notes: [old] }), "o", buildNotePatch(d), { now: () => "2026-11-04T10:00:00Z" })
  assert.equal(out.notes[0].text, "plain old note, edited")
  assert.equal(out.notes[0].createdAt, ts)
  assert.equal(out.notes[0].updatedAt, "2026-11-04T10:00:00Z")
  assert.ok(!("links" in out.notes[0]))
  assert.ok(!("courseId" in JSON.parse(JSON.stringify(out.notes[0]))), "the explicit undefined disappears when saved")
})

test("editing keeps links and unknown fields; pin and delete touch only their note", () => {
  const rich = n("r", "linked note", { links: [{ label: "Spec", url: "https://example.com/spec" }], courseId: "c1", futureField: { keep: 1 } })
  const other = n("p", "other")
  const data = ws({ notes: [rich, other] })
  const edited = updateNote(data, "r", buildNotePatch({ ...draftFromNote(rich), color: "blue", pinned: true, courseId: undefined }))
  const r = edited.notes[0] as unknown as Record<string, unknown>
  assert.deepEqual(r.links, [{ label: "Spec", url: "https://example.com/spec" }])
  assert.deepEqual(r.futureField, { keep: 1 })
  assert.equal(r.color, "blue")
  assert.equal(r.pinned, true)
  assert.equal(r.courseId, undefined)
  assert.deepEqual(edited.notes[1], other)
  assert.equal(togglePin(data, "p").notes[1].pinned, true)
  assert.equal(togglePin(togglePin(data, "p"), "p").notes[1].pinned, false)
  assert.deepEqual(ids(removeNote(data, "r").notes), ["p"])
  assert.deepEqual(removeNote(data, "missing").notes, data.notes)
})

test("through the workspace client: an edit keeps the note's links on the server; a stale edit conflicts instead of overwriting", async () => {
  const rich = n("r", "linked note", { links: [{ label: "Spec", url: "https://example.com/spec" }], futureField: 7 })
  const server = fakeServer(ws({ notes: [rich] }), 2)
  const client = createWorkspaceClient({ address: ADDRESS, fetchImpl: server.fetchImpl, store: memoryStore() })
  await client.load()
  await client.mutate(["notes"], (d) => updateNote(d, "r", buildNotePatch({ ...draftFromNote(rich), text: "linked note v2" })))
  const saved = server.snap.data.notes[0] as unknown as Record<string, unknown>
  assert.equal(saved.text, "linked note v2")
  assert.deepEqual(saved.links, [{ label: "Spec", url: "https://example.com/spec" }])
  assert.equal(saved.futureField, 7)
  server.other((d) => updateNote(d, "r", { text: "edited on the web" }))
  await client.mutate(["notes"], (d) => updateNote(d, "r", { text: "edited on the phone" }))
  assert.equal(client.getState().status, "conflict")
  assert.equal(server.snap.data.notes[0].text, "edited on the web")
})
