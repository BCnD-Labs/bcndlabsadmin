import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { PREVIEW_MAX_BYTES, previewName, sweepPreviews, writePreview } from "../src/main/quick-look.ts"

test("preview names keep only the file name and only allow document types", () => {
  assert.equal(previewName("Week 3 Slides.pptx"), "Week 3 Slides.pptx")
  assert.equal(previewName("/Documents/Class/notes.DOCX"), "notes.DOCX")
  assert.equal(previewName("..\\..\\etc\\report.xlsx"), "report.xlsx")
  assert.equal(previewName("../../.hidden.pdf"), "hidden.pdf")
  assert.equal(previewName("run.sh"), null)
  assert.equal(previewName("app.command"), null)
  assert.equal(previewName("noextension"), null)
  assert.equal(previewName(""), null)
  assert.equal(previewName(42), null)
  assert.equal(previewName(`${"a".repeat(201)}.pdf`), null)
  assert.equal(previewName("bad\u0000name.pdf"), "badname.pdf")
  assert.ok(PREVIEW_MAX_BYTES >= 50 * 1024 * 1024)
})

test("a preview is written into its own folder and old ones are swept", () => {
  const root = mkdtempSync(path.join(tmpdir(), "bw-preview-test-"))
  try {
    const file = writePreview(root, "deck.pptx", new Uint8Array([1, 2, 3]))
    assert.ok(file.startsWith(root + path.sep))
    assert.equal(path.basename(file), "deck.pptx")
    assert.deepEqual([...readFileSync(file)], [1, 2, 3])
    const other = writePreview(root, "deck.pptx", new Uint8Array([9]))
    assert.notEqual(path.dirname(file), path.dirname(other), "same name twice never overwrites")
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000)
    utimesSync(path.dirname(file), old, old)
    sweepPreviews(root)
    assert.equal(existsSync(file), false)
    assert.equal(existsSync(other), true)
    sweepPreviews(path.join(root, "missing")) // no folder is fine
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
