import assert from "node:assert/strict"
import { test } from "node:test"
import { HANDWRITTEN, startSiteLab } from "../server/site-lab.ts"
import { confirmed, withConnection } from "./lab-review.ts"
import { adoptedPreview, cleanPagePath, findRegions, htmlTitle, pagePaths, regionBody, regionText, repoPathOf, replaceRegion, stylesheetPaths } from "../shared/site-adopt.ts"
import { updateIndexBlock, type SitePost } from "../shared/site.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import { siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Site } from "../src/lib/types.ts"

const page = `<main>\n  <!-- blackwall:intro -->\n  <p>Hello</p>\n  <!-- /blackwall:intro -->\n  <p>Mine</p>\n  <!--blackwall:hero--><b>x</b><!-- /blackwall:hero -->\n  <!-- blackwall:broken -->\n</main>`

test("regions are found by name, only complete ones count, and the text around them is never touched", () => {
  const regions = findRegions(page)
  assert.deepEqual(regions.map((r) => r.name), ["intro", "hero"], "an unclosed marker is ignored")
  const out = replaceRegion(page, "intro", "\n  <p>New</p>\n  ")!
  assert.ok(out.includes("<p>New</p>"))
  assert.equal(out.replace("<p>New</p>", "<p>Hello</p>"), page, "everything outside the region is identical")
  assert.equal(replaceRegion(page, "missing", "x"), null, "no such region: leave the file alone")
  assert.equal(replaceRegion(page, "broken", "x"), null)
})

test("editing a region keeps the file's own line breaks and indent", () => {
  const r = findRegions(page)[0]
  assert.equal(regionText(r), "  <p>Hello</p>")
  const body = regionBody(r, "<p>One</p>\n<p>Two</p>")
  assert.equal(body, "\n<p>One</p>\n<p>Two</p>\n  ")
  assert.equal(replaceRegion(page, "intro", body)!.includes("<!-- blackwall:intro -->\n<p>One</p>"), true)
  const inline = findRegions(page)[1]
  assert.equal(regionBody(inline, "<i>y</i>"), "<i>y</i>", "a one-line region stays one line")
})

test("the blog index's posts list is just a region named posts, and behaves as before", () => {
  const html = `<div>\n    <!-- blackwall:posts -->\n    <!-- /blackwall:posts -->\n  </div>`
  const post: SitePost = { slug: "a", title: "A", excerpt: "e", tags: [], date: "2026-01-01T00:00:00.000Z", markdown: "" }
  const out = updateIndexBlock(html, [post], () => "posts/a.html")!
  assert.match(out, /<!-- blackwall:posts -->\n    <article class="card card--mini" id="post-a">/)
  assert.ok(out.endsWith("\n    <!-- /blackwall:posts -->\n  </div>"))
  assert.equal(updateIndexBlock("<div></div>", [post], () => "x"), null, "without markers the page is left alone")
})

test("only real page files are listed: html, not hidden, not tooling, not the posts Blackwall publishes", () => {
  assert.equal(cleanPagePath("/about/index.html"), "about/index.html")
  for (const bad of ["../x.html", "a/../b.html", ".github/x.html", "node_modules/x/y.html", "style.css", "", "a/.hidden/b.html"]) assert.equal(cleanPagePath(bad), null, bad)
  const { paths, more } = pagePaths(["index.html", "pages/blog/posts/one.html", "pages/blog/blog.html", ".github/pages.html", "a/b/c/d.html", "css/style.css"], "pages/blog/posts")
  assert.deepEqual(paths, ["index.html", "pages/blog/blog.html", "a/b/c/d.html"])
  assert.equal(more, 0)
  assert.equal(pagePaths(["a.html", "b.html", "c.html"], "", 2).more, 1)
  assert.equal(htmlTitle("<title> About &amp; us </title>"), "About & us")
})

test("a preview drops the site's scripts and loads its stylesheets from the live site", () => {
  const out = adoptedPreview('<html><head><title>x</title><link rel="stylesheet" href="../css/style.css"><script>alert(1)</script></head><body><a href="/root.html">r</a><a href="#top">t</a><img src="p.png"><a href="https://other.test/">o</a></body></html>', "https://example.com/", "about/index.html")
  assert.ok(!out.includes("alert(1)"))
  assert.match(out, /href="https:\/\/example\.com\/css\/style\.css"/, "relative to the page's folder")
  assert.match(out, /href="https:\/\/example\.com\/root\.html"/)
  assert.match(out, /src="https:\/\/example\.com\/about\/p\.png"/)
  assert.match(out, /href="#top"/)
  assert.match(out, /href="https:\/\/other\.test\/"/)
  assert.ok(!out.includes("<base href"), "a base href would be blocked by the app's content policy")
  assert.match(adoptedPreview("<p>x</p>", "", "a.html"), /^<base target="_blank"><p>x<\/p>$/)
})

test("a page's own stylesheets are found in the repo and put in the preview", () => {
  assert.equal(repoPathOf("about/index.html", "../css/style.css?v=2"), "css/style.css")
  assert.equal(repoPathOf("about/index.html", "/css/a.css"), "css/a.css")
  assert.equal(repoPathOf("index.html", "../x.css"), null, "can't climb out of the repository")
  assert.equal(repoPathOf("index.html", "https://cdn.test/a.css"), null)
  const html = '<head><link rel="stylesheet" href="css/style.css"><link href="https://cdn.test/a.css" rel="stylesheet"><link rel="icon" href="x.ico"></head>'
  assert.deepEqual(stylesheetPaths(html, "index.html"), ["css/style.css"])
  const out = adoptedPreview(html, "https://example.com", "index.html", { "css/style.css": "body{color:red}</style><script>x" })
  assert.match(out, /<style>body\{color:red\}<\\\/style><script>x<\/style>/, "the inlined sheet can't close its own tag")
  assert.ok(out.includes('href="https://cdn.test/a.css"') && out.includes("x.ico"), "other links stay")
})

test("an older saved workspace still loads, and adopted must be a yes or no", () => {
  const t = siteFromTemplate("Old", "simple")
  const ts = "2026-11-01T00:00:00Z"
  const old = { ...emptyWorkspace(), sites: [{ ...t.site, id: "s", createdAt: ts, updatedAt: ts }] }
  assert.equal(validWorkspace(old), true, "a site saved before adopting existed")
  assert.equal(validWorkspace({ ...old, sites: [{ ...old.sites[0], adopted: true, connectionId: "c1" } as Site] }), true)
  assert.equal(validWorkspace({ ...old, sites: [{ ...old.sites[0], adopted: "yes" } as unknown as Site] }), false)
})

/** The real server code against the practice run: a stand-in repository holding a hand-written site. */
test("scan, read and save a region: only that region changes, and a page changed elsewhere is never overwritten", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 50, handwritten: true })
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
  const get = async (p: string) => (await fetch(`${lab.panel}/api/site/${withConnection(lab, p)}`, { headers })).json()
  try {
    const scan = await get("scan")
    assert.deepEqual(scan.pages.map((p: { path: string }) => p.path), ["index.html", "about/index.html", "blog/blog.html"])
    assert.equal(scan.indexMarkers, true)
    assert.equal(lab.commits.length, 0, "a scan writes nothing")

    const home = await get("page?path=index.html")
    assert.deepEqual(home.regions, [{ name: "intro", text: "      <p>We make small things by hand.</p>" }])
    const about = await get("page?path=about/index.html")
    assert.deepEqual(about.regions, [], "a page without markers has nothing Blackwall may edit")
    assert.deepEqual(Object.keys(about.styles), ["css/style.css"], "its stylesheet is read from the repo for the preview")
    assert.equal((await fetch(`${lab.panel}/api/site/page?path=${encodeURIComponent("../secret.html")}&connection=${lab.connection}`, { headers })).status, 400)

    const put = (body: object) => fetch(`${lab.panel}/api/site/region?connection=${lab.connection}`, { method: "PUT", headers, body: JSON.stringify(body) })
    const edit = { path: "index.html", name: "intro", content: "<p>We make <b>big</b> things.</p>", baseSha: home.sha }
    assert.equal((await put(edit)).status, 400, "saving a region without reviewing it writes nothing")
    assert.equal(lab.commits.length, 0)
    const plan = (await (await put({ ...edit, plan: true })).json()).plan
    assert.deepEqual(plan.files.map((f: { path: string; status: string }) => [f.path, f.status]), [["index.html", "changed"]], "the review shows the one file")
    assert.equal(plan.suggested.message, "Update intro on index.html")
    assert.equal(lab.commits.length, 0, "a plan writes nothing")
    const saved = await confirmed((b) => put({ ...edit, ...b }), { message: "Rewrite the intro" })
    assert.equal(saved.status, 200, await saved.clone().text())
    assert.equal(lab.commits.length, 1)
    assert.equal(lab.commits[0].message, "Rewrite the intro")
    assert.deepEqual(lab.commits[0].changed, ["index.html"], "one file, nothing else")
    const after = lab.branch.files.get("index.html")!.toString()
    assert.ok(after.includes("<p>We make <b>big</b> things.</p>"))
    assert.equal(after, HANDWRITTEN["index.html"].replace("      <p>We make small things by hand.</p>", "<p>We make <b>big</b> things.</p>"), "the rest of the page is byte-for-byte what it was")

    // The owner pushed a change from somewhere else; the old version in the editor must not overwrite it.
    lab.branch.files.set("index.html", Buffer.from(after.replace("hand-written", "edited elsewhere")))
    const stale = await confirmed((b) => put({ path: "index.html", name: "intro", content: "<p>Stale</p>", baseSha: home.sha, ...b }))
    assert.equal(stale.status, 409)
    assert.match((await stale.json()).error, /changed somewhere else/)
    assert.equal(lab.commits.length, 1, "nothing was committed")
    assert.ok(lab.branch.files.get("index.html")!.toString().includes("edited elsewhere"))

    const missing = await put({ path: "index.html", name: "nope", content: "x", baseSha: (await get("page?path=index.html")).sha, plan: true })
    assert.equal(missing.status, 409)
  } finally {
    await lab.close()
  }
})
