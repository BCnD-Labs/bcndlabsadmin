import assert from "node:assert/strict"
import { test } from "node:test"
import { moveJournal, saveJournal, saveJournalItem, saveJournalLegacyText, saveJournalSections } from "../shared/records.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"

const day = "2026-11-03", other = "2026-11-04", time = "2026-11-03T18:00:00Z"
const opts = { now: () => time }
const item = (id: string, text = id, sectionId?: string) => ({ id, text, sectionId, createdAt: time, updatedAt: time })

test("legacy journal records still validate without individual entries", () => {
  const legacy = saveJournal(emptyWorkspace(), day, "Old log", opts)
  assert.ok(validWorkspace(JSON.parse(JSON.stringify(legacy))))
  assert.equal(legacy.journal[0].entries, undefined)
})

test("multiple same-day entries append, updates keep ids, and other dates stay separate", () => {
  let data = saveJournalItem(emptyWorkspace(), day, item("one"), false, opts)
  data = saveJournalItem(data, day, item("two"), false, opts)
  data = saveJournalItem(data, other, item("three"), false, opts)
  data = saveJournalItem(data, day, item("one", "Revised"), false, opts)
  assert.deepEqual(data.journal.find((entry) => entry.id === day)?.entries?.map((entry) => [entry.id, entry.text]), [["one", "Revised"], ["two", "two"]])
  assert.equal(data.journal.find((entry) => entry.id === other)?.entries?.length, 1)
  assert.equal(data.notes.length, 0)
  assert.ok(validWorkspace(data))
})

test("save as Note is atomic and retries update a linked Note instead of duplicating it", () => {
  let data = saveJournalItem(emptyWorkspace(), day, item("one", "A real note"), true, opts)
  const noteId = data.journal[0].entries![0].noteId
  assert.equal(data.notes[0].id, noteId)
  assert.equal(data.notes[0].text, "A real note")
  data = saveJournalItem(data, day, item("one", "Edited entry"), true, opts)
  assert.equal(data.notes.length, 1)
  assert.equal(data.notes[0].text, "Edited entry")
  assert.equal(data.journal[0].entries![0].noteId, noteId)
  const cleared = saveJournal(data, day, "", opts)
  assert.equal(cleared.journal[0].entries!.length, 1)
  assert.ok(validWorkspace(cleared))
})

test("new section entries preserve all existing main and section text", () => {
  let data = saveJournalSections(saveJournal(emptyWorkspace(), day, "Main", opts), day, [{ id: "morning", title: "Morning", text: "Old section text" }], opts)
  data = saveJournalItem(data, day, item("new", "More happened", "morning"), false, opts)
  assert.equal(data.journal[0].text, "Main")
  assert.equal(data.journal[0].sections![0].text, "Old section text")
  assert.equal(data.journal[0].entries![0].sectionId, "morning")
  assert.equal(saveJournalItem(data, day, item("invalid", "Missing section", "absent"), false, opts), data)
  assert.ok(!validWorkspace({ ...data, journal: [{ ...data.journal[0], entries: [item("bad", "Bad", "absent")] }] }))
})

test("legacy modal edits preserve new entries and keep Note links on repeated saves", () => {
  let data = saveJournalItem(saveJournal(emptyWorkspace(), day, "Original", opts), day, item("new"), false, opts)
  data = saveJournalLegacyText(data, day, undefined, "Revised", true, "nte_legacy", opts)
  data = saveJournalLegacyText(data, day, undefined, "Revised again", true, "nte_new_would_duplicate", opts)
  assert.equal(data.journal[0].text, "Revised again")
  assert.equal(data.journal[0].entries!.length, 1)
  assert.equal(data.notes.length, 1)
  assert.equal(data.notes[0].text, "Revised again")
  assert.equal(data.journal[0].mainNoteId, "nte_legacy")
  assert.ok(validWorkspace(data))
})

test("malformed individual entries are rejected", () => {
  const data = saveJournalItem(emptyWorkspace(), day, item("one"), false, opts)
  for (const entries of [[item("same"), item("same")], [{ ...item("bad"), text: 1 }], [{ ...item("bad"), noteId: 1 }], [{ ...item("bad"), createdAt: undefined }]]) {
    assert.ok(!validWorkspace({ ...data, journal: [{ ...data.journal[0], entries }] }))
  }
})


test("moving onto another date keeps individual entry metadata and linked Notes", () => {
  let data = saveJournalItem(emptyWorkspace(), day, item("one", "Source note"), true, opts)
  data = saveJournalItem(data, other, item("two", "Destination"), false, opts)
  const moved = moveJournal(data, day, other, opts)
  assert.equal(moved.journal.length, 1)
  assert.deepEqual(moved.journal[0].entries?.map((entry) => entry.text), ["Destination", "Source note"])
  assert.equal(moved.journal[0].entries?.[1].noteId, data.notes[0].id)
  assert.equal(moved.journal[0].entries?.[1].createdAt, time)
  assert.ok(validWorkspace(moved))
})
