import assert from "node:assert/strict"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { confirmed, withConnection } from "./lab-review.ts"

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
type Lab = { panel: string; connection: string }
const send = (lab: Lab, method: string, path: string, body: object = {}) => fetch(`${lab.panel}/api/${withConnection(lab, path)}`, { method, headers, body: JSON.stringify(body) })
/** A few real PNG bytes with a distinctive tail, so a byte-for-byte comparison means something. */
const PNG = Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"), Buffer.from("distinct-tail-1234")])
const upload = (lab: Lab, extra: object = {}, name = "Team Photo.PNG") => send(lab, "POST", "site/media", { name, data: PNG.toString("base64"), ...extra })

test("an image upload is a reviewed commit of that one file: nothing is written by the plan, and nothing else rides along", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const before = new Map(lab.branch.files)
    const planned = await (await upload(lab, { plan: true })).json()
    assert.equal(lab.commits.length, 0, "the plan wrote nothing")
    assert.deepEqual(planned.plan.files.map((f: { path: string; status: string }) => [f.path, f.status]), [["img/team-photo.png", "added"]])
    assert.equal(planned.item.path, "/img/team-photo.png")
    assert.equal(planned.plan.suggested.message, "Add image: team-photo.png")
    assert.equal((await upload(lab)).status, 400, "an upload nobody reviewed is refused")
    assert.equal(lab.commits.length, 0)

    const done = await confirmed((b) => upload(lab, b), { message: "Add the team photo" })
    assert.equal(done.status, 200)
    assert.equal(lab.commits.length, 1)
    assert.equal(lab.commits[0].message, "Add the team photo")
    assert.deepEqual([lab.commits[0].added, lab.commits[0].changed, lab.commits[0].removed], [["img/team-photo.png"], [], []], "only the picture")
    assert.ok(lab.branch.files.get("img/team-photo.png")!.equals(PNG), "the stored bytes are exactly the uploaded bytes")
    for (const [f, bytes] of before) assert.ok(lab.branch.files.get(f)!.equals(bytes), `${f} is untouched`)

    // The same name again becomes a new file, not an overwrite.
    const second = await (await upload(lab, { plan: true })).json()
    assert.equal(second.item.path, "/img/team-photo-2.png")
  } finally { await lab.close() }
})

test("removing an image is reviewed too, and only removes that file", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    assert.equal((await confirmed((b) => upload(lab, b))).status, 200)
    const path = "site/media?path=" + encodeURIComponent("img/team-photo.png")
    assert.equal((await send(lab, "DELETE", path)).status, 400, "an unreviewed delete is refused")
    assert.ok(lab.branch.files.has("img/team-photo.png"))
    const planned = await (await send(lab, "DELETE", path, { plan: true })).json()
    assert.deepEqual(planned.plan.files.map((f: { path: string; status: string; conflict?: string }) => [f.path, f.status, f.conflict]), [["img/team-photo.png", "removed", undefined]])
    assert.equal((await confirmed((b) => send(lab, "DELETE", path, b), { message: "Remove the team photo" })).status, 200)
    assert.equal(lab.branch.files.has("img/team-photo.png"), false)
    assert.equal(lab.commits.at(-1)!.message, "Remove the team photo")
  } finally { await lab.close() }
})

test("an image changed under the owner between review and confirm is refused, not silently replaced", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const plan = (await (await upload(lab, { plan: true })).json()).plan
    // Someone adds a file with the same name before the owner confirms: the name moves on, so the reviewed plan no longer matches.
    lab.branch.files.set("img/team-photo.png", Buffer.from("someone else's picture"))
    const r = await upload(lab, { token: plan.token, expectedHead: plan.head, stamp: plan.stamp, message: "x" })
    assert.equal(r.status, 409)
    assert.equal(lab.commits.length, 0)
    assert.equal(lab.branch.files.get("img/team-photo.png")!.toString(), "someone else's picture")
  } finally { await lab.close() }
})

test("a region save can go to a pull request with the owner's own branch, title and description, leaving the live page alone", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const home = await (await fetch(`${lab.panel}/api/${withConnection(lab, "site/page?path=index.html")}`, { headers })).json()
    const edit = { path: "index.html", name: "intro", content: "<p>New intro.</p>", baseSha: home.sha }
    const live = lab.branch.files.get("index.html")!.toString()
    const r = await (await confirmed((b) => send(lab, "PUT", "site/region", { ...edit, ...b }), { mode: "pr", message: "Rewrite the intro", branch: "edit/intro", prTitle: "Rewrite the intro", prBody: "Shorter and warmer." })).json()
    assert.equal(lab.commits.length, 0, "the live branch got no commit")
    assert.equal(lab.branch.files.get("index.html")!.toString(), live)
    assert.equal(r.committed.pr.number, 1)
    assert.deepEqual([lab.pulls[0].head, lab.pulls[0].title, lab.pulls[0].body, lab.pulls[0].base], ["edit/intro", "Rewrite the intro", "Shorter and warmer.", "main"])
    assert.match(lab.branches.get("edit/intro")!.files.get("index.html")!.toString(), /New intro/)
  } finally { await lab.close() }
})

test("a region save is refused if the branch moved after the owner reviewed it", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const home = await (await fetch(`${lab.panel}/api/${withConnection(lab, "site/page?path=index.html")}`, { headers })).json()
    const edit = { path: "index.html", name: "intro", content: "<p>New intro.</p>", baseSha: home.sha }
    const plan = (await (await send(lab, "PUT", "site/region", { ...edit, plan: true })).json()).plan
    lab.branch.head = "someone-pushed"
    const r = await send(lab, "PUT", "site/region", { ...edit, token: plan.token, expectedHead: plan.head, message: "x" })
    assert.equal(r.status, 409)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})

test("a request can't turn off review: the unattended flag is only ever set by the server's own scheduler", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const r = await send(lab, "PUT", "site/posts/hello", { post: { title: "Hello", markdown: "x" }, internal: true, message: "sneaky" })
    assert.equal(r.status, 400)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})
