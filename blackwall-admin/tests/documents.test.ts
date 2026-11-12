import assert from "node:assert/strict"
import { test } from "node:test"
import { cellText, columnName, documentKind, isLegacyOffice, safeHref } from "../src/features/documents/document-kind.ts"

test("only the modern Word, Excel and PowerPoint formats open in the viewer", () => {
  assert.equal(documentKind("Week 3.PPTX"), "pptx")
  assert.equal(documentKind("notes.docx"), "docx")
  assert.equal(documentKind("budget.v2.xlsx"), "xlsx")
  assert.equal(documentKind("old.ppt"), null)
  assert.equal(documentKind("photo.png"), null)
  assert.equal(documentKind("pptx"), null)
  assert.equal(isLegacyOffice("old.PPT"), true)
  assert.equal(isLegacyOffice("slides.odp"), true)
  assert.equal(isLegacyOffice("new.pptx"), false)
})

test("links inside documents are limited to the web and email", () => {
  assert.equal(safeHref("https://example.com/a"), "https://example.com/a")
  assert.equal(safeHref(" mailto:me@example.com "), "mailto:me@example.com")
  assert.equal(safeHref("javascript:alert(1)"), null)
  assert.equal(safeHref("JaVaScRiPt:alert(1)"), null)
  assert.equal(safeHref("data:text/html,<script>1</script>"), null)
  assert.equal(safeHref("file:///etc/passwd"), null)
  assert.equal(safeHref("#slide2"), null)
  assert.equal(safeHref(null), null)
})

test("spreadsheet columns are lettered like Excel and cells print plainly", () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName), ["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"])
  assert.equal(cellText(null), "")
  assert.equal(cellText(undefined), "")
  assert.equal(cellText(0), "0")
  assert.equal(cellText(342.5), "342.5")
  assert.equal(cellText(false), "false")
  assert.equal(cellText(new Date("2026-11-09T00:00:00Z")), "2026-11-09")
  assert.equal(cellText("hello"), "hello")
})
