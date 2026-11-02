import assert from "node:assert/strict"
import { test } from "node:test"
import { matchesFilter, platformDef, postState } from "../shared/social.ts"
import { validWorkspace, emptyWorkspace } from "../shared/workspace.ts"

const acc = (id: string, platform: string, brand: string) => ({ id, platform, name: id, brand, url: "", createdAt: "", updatedAt: "" }) as never
const accounts = [acc("a", "instagram", "Personal"), acc("b", "x", "BCnD Labs"), acc("c", "tiktok", "Sprouts & Scraps")]
const post = (o: object) => ({ id: "p", title: "T", body: "B", stage: "draft", accountIds: ["a", "b"], posted: [], createdAt: "", updatedAt: "", ...o }) as never

test("post state follows schedule and what's been posted", () => {
  const now = Date.parse("2026-11-02T12:00:00Z")
  assert.equal(postState(post({ stage: "idea" }), now), "idea")
  assert.equal(postState(post({ scheduledAt: "2026-11-03T12:00:00Z" }), now), "scheduled")
  assert.equal(postState(post({ scheduledAt: "2026-11-02T11:00:00Z" }), now), "due")
  assert.equal(postState(post({ scheduledAt: "2026-11-02T11:00:00Z", posted: [{ accountId: "a", at: "x" }] }), now), "partial")
  assert.equal(postState(post({ posted: [{ accountId: "a", at: "x" }, { accountId: "b", at: "x" }] }), now), "posted")
})

test("platform and brand filters combine; empty means all", () => {
  const p = post({})
  assert.ok(matchesFilter(p, accounts, [], []))
  assert.ok(matchesFilter(p, accounts, ["x"], []))
  assert.ok(!matchesFilter(p, accounts, ["tiktok"], []))
  assert.ok(matchesFilter(p, accounts, ["instagram", "tiktok"], ["Personal"]))
  assert.ok(!matchesFilter(p, accounts, ["x"], ["Personal"]), "X account is BCnD Labs, not Personal")
  assert.match(platformDef("x").compose!("hi there", "https://a.b")!, /intent\/post\?text=hi%20there&url=/)
})

test("workspace validation accepts social records and rejects bad ones", () => {
  const ws = { ...emptyWorkspace(), socialAccounts: [acc("a", "instagram", "Personal")], socialPosts: [post({})] }
  assert.ok(validWorkspace(JSON.parse(JSON.stringify(ws))))
  assert.ok(!validWorkspace({ ...emptyWorkspace(), socialAccounts: [acc("a", "myspace", "P")] }))
  const legacy = JSON.parse(JSON.stringify(emptyWorkspace())); delete legacy.socialPosts; delete legacy.socialAccounts
  assert.ok(validWorkspace(legacy), "older snapshots start with empty social collections")
})
