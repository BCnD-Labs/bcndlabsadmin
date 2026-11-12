import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../src/lib/shared.ts"
import { BLOCKS, renderPage } from "../../blackwall-admin/shared/sitebuilder.ts"
import { LIBRARY } from "../../blackwall-admin/shared/site-library.ts"
import { findBlock } from "../../blackwall-admin/shared/sitebuilder-tree.ts"
import { saveSiteRecord } from "../src/native/screens/site-records.ts"
import { addPageBlock, editPageBlock } from "../src/native/screens/pagesmith-records.ts"
import { publishPagesmithSite } from "../src/native/screens/pagesmith-publish.ts"

const now = "2026-11-04T12:00:00.000Z"
const fields = { name: "Example", domain: "example.com", footerText: "", darkMode: true }
const initial = () => saveSiteRecord(emptyWorkspace(), undefined, fields, "midnight", { siteId: "sit_a", pageId: "pag_a", now })

test("phone Pagesmith inserts and edits with the shared library and block definitions", () => {
  const added = addPageBlock(initial(), "pag_a", null, "heading", now)
  const heading = added.pages[0]!.sections[0]!.kids![0]!
  assert.equal(heading.type, "heading")
  assert.ok(BLOCKS.heading.edit?.some(field => field.k === "text"))
  const edited = editPageBlock(added, "pag_a", heading.id, { text: "A real title" }, now)
  assert.equal(findBlock(edited.pages[0]!.sections, heading.id)?.text, "A real title")
  assert.equal(findBlock(added.pages[0]!.sections, heading.id)?.text, "")
  assert.ok(renderPage(edited.sites[0]!, edited.pages, edited.pages[0]!, { preview: true, edit: true }).includes(`data-bw="${heading.id}"`))
  assert.equal(edited.sites[0], added.sites[0])
  assert.ok(validWorkspace(edited))
  assert.ok(LIBRARY.some(item => item.id === "project-card"))
})

test("phone Pagesmith refuses edits to a block removed on another device", () => {
  assert.throws(() => editPageBlock(initial(), "pag_a", "gone", { text: "Lost" }, now))
})

test("shared Markdown blocks render inside the phone preview", () => {
  const added = addPageBlock(initial(), "pag_a", null, "richtext", now)
  const rich = added.pages[0]!.sections[0]!.kids![0]!
  const edited = editPageBlock(added, "pag_a", rich.id, { md: "**Ready**" }, now)
  assert.match(renderPage(edited.sites[0]!, edited.pages, edited.pages[0]!, { preview: true, edit: true }), /<strong>Ready<\/strong>/)
})

test("publish calls the existing site endpoint with the sign-in cookie", async () => {
  let called = "", init: RequestInit = {}
  const fetchImpl = (async (url: string, options: RequestInit) => { called = url; init = options; return Response.json({ sha: "abc", files: 4, removed: 1, repo: "owner/site" }) }) as typeof fetch
  const result = await publishPagesmithSite("https://blackwall.example.ts.net/", "sit_a", fetchImpl)
  assert.equal(called, "https://blackwall.example.ts.net/api/sites/sit_a/publish")
  assert.equal(init.method, "POST")
  assert.equal(init.credentials, "include")
  assert.deepEqual(result, { sha: "abc", files: 4, removed: 1, repo: "owner/site" })
})
