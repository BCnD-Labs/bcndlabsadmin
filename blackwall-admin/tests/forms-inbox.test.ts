import assert from "node:assert/strict"
import { test } from "node:test"
import { collectInbox, readInbox, setInboxStatus } from "../server/forms-inbox.ts"
import type { ConnectionStore } from "../server/store.ts"
import { approvedComments } from "../shared/site-inbox.ts"
import { buildSite, siteFromTemplate } from "../shared/sitebuilder.ts"

function fakeStore() {
  const state = new Map<string, unknown>()
  const conns = [{ id: "c1", provider: "forms", label: "Forms", config: { url: "https://w.example" }, secrets: { token: "t" }, status: "ok" }]
  return { list: async () => conns, getState: async (k: string) => state.get(k), putState: async (k: string, v: unknown) => void state.set(k, v) } as unknown as ConnectionStore
}

const remote = [
  { id: "a1", kind: "form", site: "s1", form: "f1", email: "x@y.com", name: "X", fields: { email: "x@y.com", message: "Hello" }, verified: true, at: "2026-11-02T10:00:00Z" },
  { id: "a2", kind: "comment", site: "s1", post: "week-1", email: "c@y.com", name: "Cee", fields: { comment: "Great <b>post</b>" }, verified: true, at: "2026-11-02T11:00:00Z" },
]

test("collects from the receiver, acks, notifies once, and skips repeats", async () => {
  const store = fakeStore()
  const acked: string[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/submissions")) return Response.json({ items: remote })
    if (url.endsWith("/api/ack")) { acked.push(...JSON.parse(String(init!.body)).ids); return Response.json({ ok: true }) }
    return new Response("", { status: 404 })
  }) as typeof fetch
  const sent: string[] = []
  const emit = async (event: string) => void sent.push(event)
  assert.equal((await collectInbox(store, undefined, emit, fetchImpl)).added, 2)
  assert.deepEqual(acked, ["a1", "a2"])
  assert.deepEqual(sent.sort(), ["site.comment", "site.submission"])
  assert.equal((await collectInbox(store, undefined, emit, fetchImpl)).added, 0, "an un-acked repeat isn't added twice")
  assert.equal((await readInbox(store)).length, 2)

  await setInboxStatus(store, ["a2"], "approved")
  const comments = approvedComments(await readInbox(store), "s1")
  assert.equal(comments.length, 1)

  const t = siteFromTemplate("Test", "blog")
  const site = { ...t.site, id: "s1", comments: true, formEndpoint: "https://w.example", createdAt: "", updatedAt: "" }
  const post = { id: "d1", kind: "post", siteId: "s1", slug: "week-1", title: "Week 1", body: "Hi", excerpt: "", tags: [], status: "ready", publishedAt: "2026-11-01T00:00:00Z", createdAt: "", updatedAt: "" }
  const files = buildSite(site as never, [], [post as never], [], comments)
  const html = files["posts/week-1/index.html"]
  assert.match(html, /1 comment</)
  assert.match(html, /Great &lt;b&gt;post&lt;\/b&gt;/, "comment text is escaped")
  assert.match(html, /name="_kind" value="comment"/)
  assert.match(html, /name="_post" value="week-1"/)
  assert.match(html, /action="https:\/\/w\.example\/submit"/)
})
