import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyWorkspace, validWorkspace } from "../src/lib/shared.ts"
import { saveDraftRecord } from "../src/native/screens/draft-records.ts"

const now = "2026-11-04T12:00:00.000Z"
const fields = { title: "A New Post", slug: "", kind: "post" as const, status: "idea" as const, excerpt: "", body: "# Hello", siteId: undefined }

test("native draft creation uses the web slug rule and valid workspace fields", () => {
  const before = emptyWorkspace()
  const after = saveDraftRecord(before, undefined, fields, { id: "drf_native", now })
  assert.equal(after.drafts[0]?.slug, "a-new-post")
  assert.equal(after.drafts[0]?.body, "# Hello")
  assert.equal(before.drafts.length, 0)
  assert.ok(validWorkspace(after))
})

test("editing a draft keeps its publishing metadata and other workspace records", () => {
  const original = { ...fields, id: "drf_native", slug: "a-new-post", cover: "/cover.png", remoteSlug: "old-post", tags: ["journal"], createdAt: now, updatedAt: now }
  const before = { ...emptyWorkspace(), drafts: [original], notes: [{ id: "nte_keep", text: "Keep", color: "plain" as const, pinned: false, createdAt: now, updatedAt: now }] }
  const after = saveDraftRecord(before, original.id, { ...fields, title: "Updated Post", body: "Revised" }, { now: "2026-11-05T12:00:00.000Z" })
  assert.equal(after.drafts[0]?.title, "Updated Post")
  assert.equal(after.drafts[0]?.cover, "/cover.png")
  assert.equal(after.drafts[0]?.remoteSlug, "old-post")
  assert.equal(after.drafts[0]?.createdAt, now)
  assert.equal(after.notes, before.notes)
  assert.ok(validWorkspace(after))
})

test("a saved site post is included only when explicitly chosen", () => {
  const before = emptyWorkspace()
  const fieldsWithSite = { ...fields, siteId: "sit_native" }
  const draft = saveDraftRecord(before, undefined, fieldsWithSite, { id: "drf_post", now })
  assert.equal(draft.drafts[0]?.publishedAt, undefined)
  const included = saveDraftRecord(draft, "drf_post", fieldsWithSite, { now, includeInSite: true })
  assert.equal(included.drafts[0]?.publishedAt, now)
})
