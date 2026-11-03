import assert from "node:assert/strict"
import { test } from "node:test"
import { saveJournal, saveJournalSections, moveJournal } from "../shared/records.ts"
import { emptyWorkspace, mergeWorkspace, validWorkspace } from "../shared/workspace.ts"

const day = "2026-11-03"
const nextDay = "2026-11-04"
const opts = { now: () => "2026-11-03T18:00:00Z" }
const section = (id = "a", title = "Morning", text = "Started here") => ({ id, title, text })

test("older journal entries load unchanged with no automatic sections", () => {
  const data = saveJournal(emptyWorkspace(), day, "Legacy log", opts)
  assert.ok(validWorkspace(JSON.parse(JSON.stringify(data))))
  assert.equal(data.journal[0].sections, undefined)
  assert.equal(data.journal[0].text, "Legacy log")
})

test("sections validate max three, nonblank names, unique ids and text types", () => {
  const data = saveJournal(emptyWorkspace(), day, "Main", opts)
  const valid = saveJournalSections(data, day, [section("a"), section("b"), section("c")], opts)
  assert.ok(validWorkspace(valid))
  for (const sections of [[section("a"), section("b"), section("c"), section("d")], [section("a"), section("a")], [section("a", " ")], [section("a", "x".repeat(41))], [{ ...section(), text: 123 }]]) {
    assert.equal(validWorkspace({ ...data, journal: [{ ...data.journal[0], sections }] }), false)
    assert.equal(saveJournalSections(data, day, sections as never, opts), data, "invalid edit is refused without changing data")
  }
})

test("editing and clearing the main text preserves tabs; tabs preserve the main text", () => {
  const data = saveJournal(emptyWorkspace(), day, "Main", opts)
  const withSection = saveJournalSections(data, day, [section()], opts)
  assert.equal(withSection.journal[0].text, "Main")
  const emptyMain = saveJournal(withSection, day, "", opts)
  assert.deepEqual(emptyMain.journal[0].sections, [section()])
  assert.equal(emptyMain.journal[0].text, "")
  assert.equal(saveJournalSections(emptyMain, day, [], opts).journal.length, 0)
  const created = saveJournalSections(emptyWorkspace(), day, [section()], opts)
  assert.ok(validWorkspace(created))
  assert.equal(created.journal[0].text, "")
})

test("moving a log preserves section contents without exceeding destination tab limits", () => {
  const data = saveJournalSections(saveJournal(emptyWorkspace(), day, "Main", opts), day, [section()], opts)
  const moved = moveJournal(data, day, nextDay, opts)
  assert.deepEqual(moved.journal[0].sections, data.journal[0].sections)
  assert.equal(moved.journal[0].id, nextDay)
  const withDest = saveJournalSections(saveJournal(data, nextDay, "Destination", opts), nextDay, [section("x"), section("y"), section("z")], opts)
  const merged = moveJournal(withDest, day, nextDay, opts)
  assert.equal(merged.journal.length, 1)
  assert.equal(merged.journal[0].sections?.length, 3)
  assert.match(merged.journal[0].text, /Destination\n\nMain\n\n## Morning\nStarted here/)
  assert.ok(validWorkspace(merged))
})

test("concurrent changes to the same daily log remain conflicts instead of dropping tabs", () => {
  const base = saveJournal(emptyWorkspace(), day, "Main", opts)
  const local = saveJournalSections(base, day, [section()], opts)
  const remote = saveJournal(base, day, "Changed on web", opts)
  const result = mergeWorkspace(base, local, remote)
  assert.deepEqual(result.conflicts, [`journal: ${day}`])
  assert.deepEqual(result.data.journal[0].sections, [section()])
})
