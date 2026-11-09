import assert from "node:assert/strict"
import { test } from "node:test"
import { mk, section } from "../shared/sitebuilder.ts"
import { liveConfirmed, type LiveReport } from "../shared/site-live.ts"
import { startSiteLab } from "../server/site-lab.ts"

/** The whole loop against the practice run: create, publish, confirm; edit, publish, confirm; remove, publish, confirm. */
test("create, edit, remove and blog: each publish reaches the site and the live check tells the truth", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 150 })
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
  const read = async () => (await (await fetch(`${lab.panel}/api/workspace`, { headers })).json())
  const save = async (change: (d: any) => void) => { const w = await read(); change(w.data); const r = await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) }); assert.equal(r.status, 200) } // eslint-disable-line @typescript-eslint/no-explicit-any
  const publish = async () => { const r = await fetch(`${lab.panel}/api/sites/lab/publish`, { method: "POST", headers }); assert.equal(r.status, 200, await r.clone().text()); return r.json() }
  const live = async (removed: string[] = []) => (await (await fetch(`${lab.panel}/api/sites/lab/live`, { method: "POST", headers, body: JSON.stringify({ removed }) })).json()) as LiveReport
  const visit = (p: string) => fetch(lab.site + p)
  const deployed = () => new Promise((r) => setTimeout(r, 300))
  const ts = new Date().toISOString()
  try {
    // First publish. Until the host deploys, the check must say not yet.
    await save((d) => { d.pages[0].sections = [mk("section", {}, [mk("heading", { text: "Hello from the lab", level: "1" }), mk("image", { src: "/images/lab-photo.png", alt: "x" })])] })
    await publish()
    assert.equal(liveConfirmed(await live()), false, "before the deploy finishes it isn't confirmed")
    await deployed()
    assert.equal(liveConfirmed(await live()), true)
    assert.match(await (await visit("/")).text(), /Hello from the lab/)
    const picture = await visit("/images/lab-photo.png")
    assert.equal(picture.status, 200, "the library picture is published")
    assert.equal(picture.headers.get("content-type"), "image/png")

    // Edit: the old text is gone, and an edit that hasn't been published shows as a mismatch.
    await save((d) => { d.pages[0].sections[0].kids[0].text = "Edited from the panel" })
    assert.deepEqual((await live()).pages.find((p) => p.path === "/")?.state, "old", "an unpublished edit is reported as not live")
    await publish(); await deployed()
    assert.equal(liveConfirmed(await live()), true)
    assert.doesNotMatch(await (await visit("/")).text(), /Hello from the lab/)

    // Create a page and a post.
    await save((d) => {
      d.pages.push({ id: "new", siteId: "lab", title: "New page", slug: "new-page", description: "", inMenu: true, order: 9, sections: [section("plainText")], createdAt: ts, updatedAt: ts })
      d.drafts.push({ id: "post1", title: "First post", slug: "first-post", kind: "post", status: "ready", excerpt: "e", body: "# Body text here", siteId: "lab", publishedAt: ts, createdAt: ts, updatedAt: ts })
    })
    await publish(); await deployed()
    assert.equal((await visit("/new-page/")).status, 200)
    assert.match(await (await visit("/posts/first-post/")).text(), /Body text here/)
    assert.equal(liveConfirmed(await live()), true)

    // Remove the page, take the post down, and drop the picture: all three leave the site.
    await save((d) => { d.pages = d.pages.filter((p: { id: string }) => p.id !== "new"); d.drafts[0].publishedAt = undefined; d.pages[0].sections[0].kids.pop() })
    const out = await publish()
    assert.deepEqual([...out.removedPaths].sort(), ["images/lab-photo.png", "new-page/index.html", "posts/first-post/index.html"])
    assert.equal(liveConfirmed(await live(out.removedPaths)), false, "while the old pages are still up, removal isn't confirmed")
    await deployed()
    assert.equal(liveConfirmed(await live(out.removedPaths)), true)
    assert.equal((await visit("/new-page/")).status, 404)
    assert.equal((await visit("/posts/first-post/")).status, 404)
    assert.equal((await visit("/images/lab-photo.png")).status, 404)
    assert.ok(lab.commits.at(-1)!.removed.includes("new-page/index.html"), "the commit records the removal")

    // A file Blackwall never made is left alone.
    lab.branch.files.set("keep-me.txt", Buffer.from("mine"))
    await publish()
    assert.ok(lab.branch.files.has("keep-me.txt"))
  } finally { await lab.close() }
})

test("a picture that can't be read stops the publish instead of putting a broken image online", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 0 })
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
  try {
    const w = await (await fetch(`${lab.panel}/api/workspace`, { headers })).json()
    w.data.assets[0].file = "not-in-the-cloud.png"
    w.data.pages[0].sections = [mk("section", {}, [mk("image", { src: "/images/not-in-the-cloud.png", alt: "x" })])]
    assert.equal((await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })).status, 200)
    const r = await fetch(`${lab.panel}/api/sites/lab/publish`, { method: "POST", headers })
    assert.equal(r.status, 502)
    assert.match((await r.json()).error, /nothing was published/)
    assert.equal(lab.commits.length, 0)
  } finally { await lab.close() }
})
