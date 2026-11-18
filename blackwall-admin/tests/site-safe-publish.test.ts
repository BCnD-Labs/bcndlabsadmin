import assert from "node:assert/strict"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { scheduleKey, type ScheduledPost } from "../shared/site.ts"

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
const post = (lab: { panel: string }, path: string, body: object = {}) => fetch(`${lab.panel}/api/${path}`, { method: "POST", headers, body: JSON.stringify(body) })
const put = (lab: { panel: string }, path: string, body: object = {}) => fetch(`${lab.panel}/api/${path}`, { method: "PUT", headers, body: JSON.stringify(body) })

test("a plan shows what a publish would change and writes nothing; once published, the next plan is empty", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const plan = await (await post(lab, "sites/lab/publish", { plan: true })).json()
    assert.equal(lab.commits.length, 0, "a plan writes nothing")
    assert.ok(plan.plan.files.length > 5 && plan.plan.files.every((f: { status: string }) => f.status === "added"))
    assert.match(plan.plan.files.find((f: { path: string }) => f.path === "index.html").after, /<html/)
    assert.equal(plan.plan.head, lab.branch.head)
    const done = await (await post(lab, "sites/lab/publish", { expectedHead: plan.plan.head })).json()
    assert.equal(lab.commits.length, 1)
    assert.ok(done.sha)
    const again = await (await post(lab, "sites/lab/publish", { plan: true })).json()
    assert.deepEqual(again.plan.files, [], "nothing differs now")
    const noop = await (await post(lab, "sites/lab/publish")).json()
    assert.equal(noop.unchanged, true)
    assert.equal(lab.commits.length, 1, "publishing with nothing to change makes no commit")
  } finally { await lab.close() }
})

test("a file Blackwall never made, or one edited elsewhere since, is not replaced unless the owner agrees", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    lab.branch.files.set("index.html", Buffer.from("<p>my own hand-written home page</p>"))
    const plan = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    assert.deepEqual(plan.files.filter((f: { conflict?: string }) => f.conflict).map((f: { path: string; conflict: string }) => [f.path, f.conflict]), [["index.html", "not-blackwalls"]])
    assert.equal(plan.files.find((f: { path: string }) => f.path === "index.html").before, "<p>my own hand-written home page</p>", "the diff shows what would be lost")
    const refused = await post(lab, "sites/lab/publish")
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /index\.html \(not made by Blackwall\)/)
    assert.equal(lab.commits.length, 0)
    assert.equal((await post(lab, "sites/lab/publish", { acknowledge: ["index.html"] })).status, 200)
    assert.match(lab.branch.files.get("index.html")!.toString(), /<html/)

    // The owner edits a file Blackwall wrote, from somewhere else.
    lab.branch.files.set("style.css", Buffer.from("/* I tuned this by hand */"))
    const edited = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    assert.deepEqual(edited.files.map((f: { path: string; conflict?: string }) => [f.path, f.conflict]), [["style.css", "edited-elsewhere"]])
    const refusedAgain = await post(lab, "sites/lab/publish")
    assert.equal(refusedAgain.status, 409)
    assert.match((await refusedAgain.json()).error, /style\.css \(edited since Blackwall wrote it\)/)
    assert.equal(lab.branch.files.get("style.css")!.toString(), "/* I tuned this by hand */")
  } finally { await lab.close() }
})

test("a publish is refused if the branch moved after the owner reviewed it", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const plan = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    lab.branch.head = "pushed-from-elsewhere"
    const refused = await post(lab, "sites/lab/publish", { expectedHead: plan.head })
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /branch changed since you reviewed/)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})

test("pull request mode leaves the live branch alone and opens a pull request", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const out = await (await post(lab, "sites/lab/publish", { mode: "pr" })).json()
    assert.equal(lab.commits.length, 0, "main was not touched")
    assert.equal(lab.branch.files.size, 0)
    assert.match(out.branch, /^blackwall\/\d{8}-\d{6}$/)
    assert.deepEqual(out.pr, { url: "https://github.com/lab/site/pull/1", number: 1 })
    assert.equal(lab.pulls.length, 1)
    assert.equal(lab.pulls[0].base, "main")
    assert.ok(lab.branches.get(out.branch)!.files.has("index.html"))
  } finally { await lab.close() }
})

test("posts on an adopted site: the plan lists the three files, a hand-written page at the same address is protected, and pull request mode works", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  const body = { post: { title: "Hello", excerpt: "Intro", markdown: "# Hi" } }
  try {
    const plan = (await (await put(lab, "site/posts/hello", { ...body, plan: true })).json()).plan
    assert.deepEqual(plan.files.map((f: { path: string; status: string }) => [f.path, f.status]).sort(), [["blog/blog.html", "changed"], ["blog/posts/hello.html", "added"], ["blog/posts/index.json", "added"]])
    assert.equal(plan.files.every((f: { conflict?: string }) => !f.conflict), true, "editing inside the posts region of the blog index is not a conflict")
    assert.equal(lab.commits.length, 0)

    lab.branch.files.set("blog/posts/hello.html", Buffer.from("<p>my own page</p>"))
    const clash = await put(lab, "site/posts/hello", body)
    assert.equal(clash.status, 409)
    assert.match((await clash.json()).error, /blog\/posts\/hello\.html \(not made by Blackwall\)/)
    assert.equal(lab.branch.files.get("blog/posts/hello.html")!.toString(), "<p>my own page</p>")

    const pr = await (await put(lab, "site/posts/other", { post: { title: "Other", markdown: "x" }, mode: "pr" })).json()
    assert.equal(lab.commits.length, 0, "the live branch is untouched")
    assert.equal(pr.committed.pr.number, 1)
    assert.ok(lab.branches.get(pr.committed.branch)!.files.has("blog/posts/other.html"))
  } finally { await lab.close() }
})

/** Writes a Pagesmith post into the workspace the way the app does. */
async function addDraft(lab: { panel: string }, over: object = {}) {
  const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
  const ts = new Date().toISOString()
  w.data.drafts.push({ id: "d1", title: "Scheduled hello", slug: "scheduled-hello", kind: "post", status: "ready", excerpt: "e", body: "# Hello", siteId: "lab", createdAt: ts, updatedAt: ts, ...over })
  assert.equal((await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })).status, 200)
}

test("a scheduled Pagesmith post goes out when its time comes, and is marked published in the workspace", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    await addDraft(lab)
    const when = new Date(Date.now() + 120_000).toISOString()
    const set = await put(lab, "sites/lab/schedule/d1", { publishAt: when })
    assert.equal(set.status, 200, await set.clone().text())
    const listed = (await (await fetch(`${lab.panel}/api/schedules`, { headers })).json()).schedules as ScheduledPost[]
    assert.deepEqual(listed.map((s) => [scheduleKey(s), s.publishAt]), [["lab:d1", when]], "the next run is listed")
    assert.equal((await put(lab, "sites/lab/schedule/nope", { publishAt: when })).status, 404)
    assert.equal((await put(lab, "sites/lab/schedule/d1", { publishAt: "2001-01-01T00:00:00Z" })).status, 400, "a past time is refused")

    await lab.api.publishDue()
    assert.equal(lab.commits.length, 0, "not due yet")

    // The server wasn't running at the scheduled time: on the next run (as at start-up) it goes out anyway.
    await lab.store.putSchedule({ ...listed[0], publishAt: new Date(Date.now() - 3600_000).toISOString() })
    await lab.api.publishDue()
    assert.equal(lab.commits.length, 1)
    assert.ok(lab.branch.files.has("posts/scheduled-hello/index.html"), "the post is on the site")
    assert.deepEqual(await lab.store.listSchedules(), [], "the schedule is cleared")
    const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
    assert.ok(w.data.drafts[0].publishedAt, "the draft is published in the workspace")
    assert.equal(w.data.sites[0].publishedSha, lab.commits[0].sha)
  } finally { await lab.close() }
})

test("a scheduled run that can't go out is kept with its error, never overwrites the owner's files, and retries later", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    await addDraft(lab)
    lab.branch.files.set("index.html", Buffer.from("<p>my own home page</p>"))
    await lab.store.putSchedule({ key: "lab:d1", siteId: "lab", draftId: "d1", post: { slug: "scheduled-hello", title: "Scheduled hello", excerpt: "", tags: [], date: "x", markdown: "" }, publishAt: new Date(Date.now() - 3600_000).toISOString(), createdAt: new Date().toISOString() })
    await lab.api.publishDue()
    const [kept] = await lab.store.listSchedules()
    assert.match(kept.error!, /index\.html \(not made by Blackwall\)/)
    assert.ok(kept.triedAt && kept.late, "the failure and that it ran late are shown")
    assert.equal(lab.commits.length, 0)
    assert.equal(lab.branch.files.get("index.html")!.toString(), "<p>my own home page</p>")
    const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
    assert.equal(w.data.drafts[0].publishedAt, undefined, "a failed run doesn't mark the post published")
    await lab.api.publishDue()
    assert.equal((await lab.store.listSchedules())[0].triedAt, kept.triedAt, "not retried again before 10 minutes")
  } finally { await lab.close() }
})

test("two sites can't both hold a classic schedule under the same address", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const when = new Date(Date.now() + 3600_000).toISOString()
    const first = (await lab.store.list()).find((c) => c.provider === "website")!
    const second = await lab.store.create({ provider: "website", label: "Second site", config: { repo: "lab/other" }, secrets: { token: "x" } })
    assert.equal((await put(lab, `site/schedule/hello?connection=${first.id}`, { post: { title: "A", markdown: "x" }, publishAt: when })).status, 200)
    const clash = await put(lab, `site/schedule/hello?connection=${second.id}`, { post: { title: "B", markdown: "x" }, publishAt: when })
    assert.equal(clash.status, 409)
    assert.match((await clash.json()).error, /Another site already has a post/)
  } finally { await lab.close() }
})

import { lineDiff } from "../shared/publish-plan.ts"

test("the review's diff shows only the changed lines with a little context, and folds the rest", () => {
  const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n")
  const after = before.replace("line 15", "LINE FIFTEEN")
  const rows = lineDiff(before, after, 2)
  assert.deepEqual(rows.filter((r) => r.kind === "del" || r.kind === "add").map((r) => r.kind === "gap" ? "" : `${r.kind}:${r.text}`), ["del:line 15", "add:LINE FIFTEEN"])
  assert.deepEqual(rows.filter((r) => r.kind === "gap"), [{ kind: "gap", hidden: 12 }, { kind: "gap", hidden: 13 }])
  assert.equal(rows.filter((r) => r.kind === "same").length, 4, "two lines of context each side")
  assert.deepEqual(lineDiff("a", "a"), [{ kind: "gap", hidden: 1 }], "no change folds to nothing")
  assert.deepEqual(lineDiff("", "x\ny").filter((r) => r.kind === "add").length, 2)
  const huge = Array.from({ length: 800 }, (_, i) => `l${i}`).join("\n")
  assert.ok(lineDiff(huge, huge + "\nmore").length > 0, "very large files fall back instead of hanging")
})
