import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../src/lib/shared.ts"
import { saveSiteRecord } from "../src/native/screens/site-records.ts"

const now = "2026-11-04T12:00:00.000Z"
const fields = { name: "My Site", domain: "https://example.com/", footerText: "Hello", darkMode: true }

test("native site creation adds a valid blank home without example content", () => {
  const before = emptyWorkspace()
  const after = saveSiteRecord(before, undefined, fields, "slate", { siteId: "sit_native", pageId: "pag_home", now })
  assert.equal(after.sites[0]?.domain, "example.com")
  assert.equal(after.sites[0]?.starter, "slate")
  assert.equal(after.pages[0]?.slug, "")
  assert.deepEqual(after.pages[0]?.sections, [])
  assert.equal(before.sites.length, 0)
  assert.ok(validWorkspace(after))
})

test("native site edit preserves publishing configuration and pages", () => {
  const before = saveSiteRecord(emptyWorkspace(), undefined, fields, "midnight", { siteId: "sit_native", pageId: "pag_home", now })
  const configured = { ...before, sites: [{ ...before.sites[0]!, connectionId: "con_keep", publishedAt: now, publishedSha: "abc", customCss: "body{}" }] }
  const after = saveSiteRecord(configured, "sit_native", { ...fields, name: "Updated Site" }, "forest", { now: "2026-11-05T12:00:00.000Z" })
  assert.equal(after.sites[0]?.name, "Updated Site")
  assert.equal(after.sites[0]?.starter, "midnight")
  assert.equal(after.sites[0]?.connectionId, "con_keep")
  assert.equal(after.sites[0]?.publishedSha, "abc")
  assert.equal(after.sites[0]?.customCss, "body{}")
  assert.equal(after.pages, configured.pages)
  assert.ok(validWorkspace(after))
})
