import assert from "node:assert/strict"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { scheduleKey, type ScheduledPost } from "../shared/site.ts"
import { confirmed, withConnection } from "./lab-review.ts"

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
type Lab = { panel: string; connection: string }
const post = (lab: Lab, path: string, body: object = {}) => fetch(`${lab.panel}/api/${withConnection(lab, path)}`, { method: "POST", headers, body: JSON.stringify(body) })
const put = (lab: Lab, path: string, body: object = {}) => fetch(`${lab.panel}/api/${withConnection(lab, path)}`, { method: "PUT", headers, body: JSON.stringify(body) })
/** The write, sent the way the review screen sends it: after a plan, carrying its token and a commit message. */
const publish = (lab: Lab, path: string, extra: object = {}, body: object = {}) => confirmed((b) => post(lab, path, { ...body, ...b }), extra)
const publishPut = (lab: Lab, path: string, extra: object = {}, body: object = {}) => confirmed((b) => put(lab, path, { ...body, ...b }), extra)

test("a plan shows what a publish would change and writes nothing; once published, the next plan is empty", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const plan = await (await post(lab, "sites/lab/publish", { plan: true })).json()
    assert.equal(lab.commits.length, 0, "a plan writes nothing")
    assert.ok(plan.plan.files.length > 5 && plan.plan.files.every((f: { status: string }) => f.status === "added"))
    assert.match(plan.plan.files.find((f: { path: string }) => f.path === "index.html").after, /<html/)
    assert.equal(plan.plan.head, lab.branch.head)
    assert.equal((await post(lab, "sites/lab/publish")).status, 400, "a write that never reviewed a plan is refused")
    assert.equal(lab.commits.length, 0)
    const done = await (await publish(lab, "sites/lab/publish")).json()
    assert.equal(lab.commits.length, 1)
    assert.equal(lab.commits[0].message, "Test change", "the commit says what the owner wrote")
    assert.ok(done.sha)
    const again = await (await post(lab, "sites/lab/publish", { plan: true })).json()
    assert.deepEqual(again.plan.files, [], "nothing differs now")
    const noop = await (await publish(lab, "sites/lab/publish")).json()
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
    const refused = await publish(lab, "sites/lab/publish")
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /index\.html \(not made by Blackwall\)/)
    assert.equal(lab.commits.length, 0)
    assert.equal((await publish(lab, "sites/lab/publish", { acknowledge: ["index.html"] })).status, 200)
    assert.match(lab.branch.files.get("index.html")!.toString(), /<html/)

    // The owner edits a file Blackwall wrote, from somewhere else.
    lab.branch.files.set("style.css", Buffer.from("/* I tuned this by hand */"))
    const edited = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    assert.deepEqual(edited.files.map((f: { path: string; conflict?: string }) => [f.path, f.conflict]), [["style.css", "edited-elsewhere"]])
    const refusedAgain = await publish(lab, "sites/lab/publish")
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
    const send = (extra: object) => post(lab, "sites/lab/publish", { token: plan.token, expectedHead: plan.head, message: "Reviewed", ...extra })
    const refused = await send({})
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /branch changed since you reviewed/)
    const refusedPr = await send({ mode: "pr" })
    assert.equal(refusedPr.status, 409, "a pull request is held to the same check")
    assert.equal(lab.commits.length, 0)
    assert.equal(lab.pulls.length, 0)
  } finally { await lab.close() }
})

test("a write is refused unless it carries the plan that was reviewed, even if the branch hasn't moved", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  const body = { post: { title: "Hello", excerpt: "Intro", markdown: "# Hi" } }
  try {
    const plan = (await (await put(lab, "site/posts/hello", { ...body, plan: true })).json()).plan
    // The owner reviewed this text; the request now carries different text.
    const changed = await put(lab, "site/posts/hello", { post: { ...body.post, markdown: "# Something else" }, token: plan.token, expectedHead: plan.head, stamp: plan.stamp, message: "x" })
    assert.equal(changed.status, 409)
    assert.match((await changed.json()).error, /no longer the ones you reviewed/)
    assert.equal((await put(lab, "site/posts/hello", { ...body, expectedHead: plan.head, message: "x" })).status, 400, "no token, no write")
    assert.equal((await put(lab, "site/posts/hello", { ...body, token: plan.token, expectedHead: plan.head, stamp: plan.stamp })).status, 400, "no commit message, no write")
    assert.equal(lab.commits.length, 0)
    const ok = await put(lab, "site/posts/hello", { ...body, token: plan.token, expectedHead: plan.head, stamp: plan.stamp, message: "Add the hello post" })
    assert.equal(ok.status, 200)
    assert.equal(lab.commits[0].message, "Add the hello post")
  } finally { await lab.close() }
})

test("commits carry the owner's wording and the account's private address, with no tool branding", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const body = { post: { title: "Hello", excerpt: "Intro", markdown: "# Hi" } }
    const plan = (await (await put(lab, "site/posts/hello", { ...body, plan: true })).json()).plan
    assert.equal(plan.suggested.message, "Add post: Hello", "the suggested message is plain")
    assert.deepEqual(plan.author, { name: "Lab Owner", email: "4242+lab-owner@users.noreply.github.com" })
    assert.deepEqual(plan.target, { repo: "lab/site", branch: "main", siteUrl: lab.site })
    await publishPut(lab, "site/posts/hello", { message: "Add the hello post\n\nFirst entry for the blog." }, body)
    assert.equal(lab.commits[0].message, "Add the hello post\n\nFirst entry for the blog.")
    assert.deepEqual(lab.commits[0].author, plan.author)
    assert.deepEqual(lab.commits[0].committer, plan.author)
    assert.doesNotMatch(JSON.stringify([...lab.made.values()]), /blackwall|pagesmith/i, "nothing in the commit names the tool")
  } finally { await lab.close() }
})

test("pull request mode leaves the live branch alone and opens a pull request", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    const plan = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    assert.match(plan.suggested.branch, /^update\/\d{8}-\d{6}$/)
    assert.match(plan.suggested.prBody, /^- Added `index\.html`/m, "the suggested description is a plain list of the files")
    const dup = await publish(lab, "sites/lab/publish", { mode: "pr", branch: "main" })
    assert.equal(dup.status, 400, "a pull request can't use the live branch")
    const bad = await publish(lab, "sites/lab/publish", { mode: "pr", branch: "bad name..x" })
    assert.equal(bad.status, 400)
    const out = await (await publish(lab, "sites/lab/publish", { mode: "pr", branch: "update/first-version", prTitle: "First version of the site", prBody: "Everything for the first release." })).json()
    assert.equal(lab.commits.length, 0, "main was not touched")
    assert.equal(lab.branch.files.size, 0)
    assert.equal(out.branch, "update/first-version", "the owner's branch name is used")
    assert.equal(lab.pulls[0].title, "First version of the site")
    assert.equal(lab.pulls[0].body, "Everything for the first release.")
    assert.equal((await publish(lab, "sites/lab/publish", { mode: "pr", branch: "update/first-version" })).status, 409, "a branch name already taken is refused, not overwritten")
    assert.deepEqual(out.pr, { url: "https://github.com/lab/site/pull/1", number: 1 })
    assert.equal(lab.pulls.length, 1)
    assert.equal(lab.pulls[0].base, "main")
    assert.ok(lab.branches.get(out.branch)!.files.has("index.html"))
  } finally { await lab.close() }
})

test("posts on an adopted site: the plan lists the four files, a hand-written page at the same address is protected, and pull request mode works", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  const body = { post: { title: "Hello", excerpt: "Intro", markdown: "# Hi" } }
  try {
    const plan = (await (await put(lab, "site/posts/hello", { ...body, plan: true })).json()).plan
    assert.deepEqual(plan.files.map((f: { path: string; status: string }) => [f.path, f.status]).sort(), [["blog/blog.html", "changed"], ["blog/posts/hello.html", "added"], ["blog/posts/index.json", "added"], ["blog/posts/post.css", "added"]])
    assert.equal(plan.files.every((f: { conflict?: string }) => !f.conflict), true, "editing inside the posts region of the blog index is not a conflict")
    assert.equal(lab.commits.length, 0)

    lab.branch.files.set("blog/posts/hello.html", Buffer.from("<p>my own page</p>"))
    const clash = await publishPut(lab, "site/posts/hello", {}, body)
    assert.equal(clash.status, 409)
    assert.match((await clash.json()).error, /blog\/posts\/hello\.html \(not made by Blackwall\)/)
    assert.equal(lab.branch.files.get("blog/posts/hello.html")!.toString(), "<p>my own page</p>")

    const pr = await (await publishPut(lab, "site/posts/other", { mode: "pr" }, { post: { title: "Other", markdown: "x" } })).json()
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

test("a site published with the older manifest name keeps its ownership tracking, and moves to the neutral name", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10 })
  try {
    assert.equal((await publish(lab, "sites/lab/publish")).status, 200)
    assert.ok(lab.branch.files.has(".site-manifest.json") && !lab.branch.files.has(".blackwall-site.json"))
    const manifest = JSON.parse(lab.branch.files.get(".site-manifest.json")!.toString())
    assert.deepEqual(Object.keys(manifest), ["files", "hashes"], "no generator or site name is recorded in the repository")

    // As an older version left it.
    lab.branch.files.set(".blackwall-site.json", lab.branch.files.get(".site-manifest.json")!)
    lab.branch.files.delete(".site-manifest.json")
    lab.branch.files.set("style.css", Buffer.from("/* tuned by hand */"))
    const plan = (await (await post(lab, "sites/lab/publish", { plan: true })).json()).plan
    assert.deepEqual(plan.files.filter((f: { conflict?: string }) => f.conflict).map((f: { path: string; conflict: string }) => [f.path, f.conflict]), [["style.css", "edited-elsewhere"]], "an edited file is still noticed")
    assert.ok(plan.files.some((f: { path: string; status: string }) => f.path === ".blackwall-site.json" && f.status === "removed"))
    assert.equal((await publish(lab, "sites/lab/publish", { acknowledge: ["style.css"] })).status, 200)
    assert.ok(lab.branch.files.has(".site-manifest.json") && !lab.branch.files.has(".blackwall-site.json"))
  } finally { await lab.close() }
})
