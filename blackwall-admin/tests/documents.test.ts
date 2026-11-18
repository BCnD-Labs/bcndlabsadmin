import assert from "node:assert/strict"
import { test } from "node:test"
import { fileNameOf, nextcloudLink, nextcloudPathOf } from "../src/features/documents/nextcloud-link.ts"
import { afterClose, withDoc } from "../src/features/documents/docs-tabs.ts"
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

test("Nextcloud file links round-trip and can't climb out of the Nextcloud root", () => {
  assert.equal(nextcloudLink("/Class/Week 3/deck.pptx"), "nextcloud:/Class/Week 3/deck.pptx")
  assert.equal(nextcloudLink("Class//deck.pptx"), "nextcloud:/Class/deck.pptx")
  assert.equal(nextcloudLink("/"), null)
  assert.equal(nextcloudLink("/a/../../etc/passwd"), null)
  assert.equal(nextcloudPathOf("nextcloud:/Class/deck.pptx"), "/Class/deck.pptx")
  assert.equal(nextcloudPathOf(" NEXTCLOUD:/Class/deck.pptx "), "/Class/deck.pptx")
  assert.equal(nextcloudPathOf("nextcloud:/a/../b"), null)
  assert.equal(nextcloudPathOf("nextcloud:"), null)
  assert.equal(nextcloudPathOf("https://cloud.example/f/12"), null)
  assert.equal(fileNameOf("/Class/Week 3/deck.pptx"), "deck.pptx")
})

test("opening a document twice keeps one tab; closing the showing tab shows its neighbour", () => {
  const a = { path: "/a.pptx", name: "a.pptx" }, b = { path: "/Class/b.docx", name: "b.docx" }, c = { path: "/c.xlsx", name: "c.xlsx" }
  assert.deepEqual(withDoc([a], "/Class/b.docx"), [a, b])
  assert.deepEqual(withDoc([a, b], "/a.pptx"), [a, b])
  assert.deepEqual(afterClose([a, b, c], "/Class/b.docx", "/Class/b.docx"), { docs: [a, c], active: "/c.xlsx" })
  assert.deepEqual(afterClose([a, b, c], "/c.xlsx", "/c.xlsx"), { docs: [a, b], active: "/Class/b.docx" })
  assert.deepEqual(afterClose([a, b], "/a.pptx", "/Class/b.docx"), { docs: [a], active: "/a.pptx" })
  assert.deepEqual(afterClose([a], "/a.pptx", "/a.pptx"), { docs: [], active: null })
})

import { canEditFile, extensionOf } from "../src/features/documents/editing.ts"

test("Edit shows only when the office editor is set up and knows the file's format", () => {
  const info = { available: true, extensions: ["docx", "odt"] }
  assert.equal(extensionOf("Essay.DOCX"), "docx")
  assert.equal(extensionOf("README"), "")
  assert.equal(canEditFile(info, "Essay.DOCX"), true)
  assert.equal(canEditFile(info, "budget.xlsx"), false)
  assert.equal(canEditFile({ available: false, extensions: ["docx"] }, "a.docx"), false)
  assert.equal(canEditFile(null, "a.docx"), false)
})
