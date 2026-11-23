import assert from "node:assert/strict"
import { test } from "node:test"
import { HANDWRITTEN, startSiteLab } from "../server/site-lab.ts"
import { addPostsRegion, findRegions, legacyRegions, migrateMarkers, regionBody, regionText, replaceRegion } from "../shared/site-adopt.ts"
import { imageNotes, updateIndexBlock, type SitePost } from "../shared/site.ts"
import { confirmed, withConnection } from "./lab-review.ts"

const BLOG = HANDWRITTEN["blog/blog.html"]
const PLAIN = `<!doctype html>\n<html lang="en">\n<head>\n  <title>Blog</title>\n</head>\n<body>\n  <main>\n    <h1>Blog</h1>\n    <p class="mine">Hand-written intro.</p>\n  </main>\n</body>\n</html>\n`
const post = (over: Partial<SitePost> = {}): SitePost => ({ slug: "a", title: "A", excerpt: "e", tags: [], date: "2026-11-01T00:00:00.000Z", markdown: "x", ...over })

test("a region is an element with data-region, found even among nested elements, and never inside comments or scripts", () => {
  const html = `<main>\n  <!-- <div data-region="ghost">no</div> -->\n  <script>var s = '<div data-region="script">no</div>'</script>\n  <div data-region="posts">\n    <div class="inner"><div>deep</div></div>\n    <p>one</p>\n  </div>\n  <p>outside</p>\n</main>`
  const regions = findRegions(html)
  assert.deepEqual(regions.map((r) => [r.name, r.kind]), [["posts", "attribute"]])
  assert.equal(regionText(regions[0]), '    <div class="inner"><div>deep</div></div>\n    <p>one</p>')
  assert.ok(replaceRegion(html, "posts", "\n    <p>new</p>\n  ")!.endsWith("<p>new</p>\n  </div>\n  <p>outside</p>\n</main>"), "everything outside is untouched")
  assert.equal(regionBody(regions[0], "<p>x</p>"), "\n<p>x</p>\n  ")
  // The older pair of comments still works, and an attribute region wins if a page somehow has both.
  assert.deepEqual(findRegions(BLOG).map((r) => [r.name, r.kind]), [["posts", "comment"]])
  assert.deepEqual(findRegions(`<!-- blackwall:a -->x<!-- /blackwall:a --><div data-region="a">y</div>`).map((r) => r.kind), ["comment"])
  assert.deepEqual(findRegions(`<div data-region="x">never closes`), [])
  assert.deepEqual(findRegions(`<img data-region="v" src="a.png"><br data-region="w">`), [], "void elements hold nothing")
})

test("the posts list fills an attribute region one level in, and leaves the rest of the page alone", () => {
  const html = `<main>\n  <h1>Blog</h1>\n  <div class="cards" data-region="posts"></div>\n  <p class="mine">mine</p>\n</main>\n`
  const out = updateIndexBlock(html, [post()], () => "posts/a.html")!
  assert.match(out, /<div class="cards" data-region="posts">\n    <article class="card card--mini" id="post-a">/)
  assert.ok(out.startsWith("<main>\n  <h1>Blog</h1>\n") && out.endsWith("</div>\n  <p class=\"mine\">mine</p>\n</main>\n"))
  assert.doesNotMatch(out, /<!--/)
})

test("adding a posts list inserts one element and nothing else", () => {
  const out = addPostsRegion(PLAIN)!
  assert.match(out, /<p class="mine">Hand-written intro\.<\/p>\n    <div data-region="posts"><\/div>\n  <\/main>/, "indented like its neighbours, inside main")
  assert.equal(out.replace('    <div data-region="posts"></div>\n', ""), PLAIN, "taking the new line out gives the page back byte for byte")
  assert.deepEqual(findRegions(out).map((r) => r.name), ["posts"])
  assert.equal(addPostsRegion(out), null, "a page that has the list isn't changed again")
  assert.equal(addPostsRegion(BLOG), null, "the older comment markers count too")
  assert.equal(addPostsRegion("<body>\n<p>x</p>\n</body>").replace('<div data-region="posts"></div>', "").length > 0, true)
  assert.match(addPostsRegion("<p>fragment</p>\n")!, /<div data-region="posts"><\/div>\n$/)
})

test("older comment markers are replaced by an attribute on their element, and only then", () => {
  assert.deepEqual(legacyRegions(BLOG), ["posts"])
  const out = migrateMarkers(BLOG, "posts")!
  assert.doesNotMatch(out, /<!--/)
  assert.ok(out.includes('<div class="cards" data-region="posts">'))
  assert.equal(out, BLOG.replace('<div class="cards">\n      <!-- blackwall:posts -->\n      <!-- /blackwall:posts -->\n', '<div class="cards" data-region="posts">\n'), "the rest of the page is byte for byte as it was")
  assert.deepEqual(findRegions(out).map((r) => [r.name, r.kind]), [["posts", "attribute"]])
  assert.deepEqual(legacyRegions(out), [])
  // With cards already between the markers they stay exactly where they are.
  const filled = BLOG.replace("<!-- blackwall:posts -->\n", "<!-- blackwall:posts -->\n      <article>keep</article>\n")
  assert.ok(migrateMarkers(filled, "posts")!.includes('data-region="posts">\n      <article>keep</article>\n    </div>'))
  // Markers that share their element with other content are left alone rather than guessed at.
  assert.equal(migrateMarkers(`<div>\n  <p>mine</p>\n  <!-- blackwall:posts -->\n  <!-- /blackwall:posts -->\n</div>`, "posts"), null)
  assert.equal(migrateMarkers(`<div><!-- blackwall:posts --><!-- /blackwall:posts --><p>after</p></div>`, "posts"), null)
  assert.equal(migrateMarkers(out, "posts"), null, "already migrated")
})

test("picture descriptions: missing or file-name-like ones are noted, decoration is allowed", () => {
  assert.deepEqual(imageNotes({ markdown: "![A team photo](/img/team.png)", cover: "/img/c.png", coverAlt: "A cover" }), [])
  const notes = imageNotes({ markdown: "![](/img/a.png) ![thumb](/img/b.png) ![team.png](/img/team.png) ![IMG_1234](/img/c.png) ![The whole team at the bench](/img/d.png)", cover: "/img/c.png" })
  assert.equal(notes.length, 5)
  assert.match(notes[0], /a\.png has no description.*decoration/)
  assert.match(notes[1], /b\.png is described as “thumb”.*file name/)
  assert.match(notes[2], /team\.png/)
  assert.match(notes[3], /IMG_1234/)
  assert.match(notes[4], /cover picture has no description/)
  assert.deepEqual(imageNotes({ markdown: "![](/img/a.png)" }).length, 1)
})

const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
type Lab = { panel: string; connection: string }
const put = (lab: Lab, body: object) => fetch(`${lab.panel}/api/${withConnection(lab, "site/posts/hello")}`, { method: "PUT", headers, body: JSON.stringify(body) })
const content = { post: { title: "Hello", excerpt: "Intro", markdown: "Text." } }

test("a blog page with no posts list never gets an orphan post: the owner is asked, and the proposed change is shown", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    lab.branch.files.set("blog/blog.html", Buffer.from(PLAIN))
    const plan = (await (await put(lab, { ...content, plan: true })).json()).plan
    const warning = plan.warnings.find((w: { code: string }) => w.code === "no-posts-region")
    assert.ok(warning.blocking)
    assert.deepEqual(warning.fixes.map((f: { option: string }) => f.option), ["addRegion", "unlisted"])
    assert.ok(!plan.files.some((f: { path: string }) => f.path === "blog/blog.html"), "nothing is proposed for the owner's page until they choose")
    const refused = await confirmed((b) => put(lab, { ...content, ...b }))
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /listed nowhere.*Nothing was written/)
    assert.equal(lab.commits.length, 0, "no orphan post")

    // The proposed change: one added element, shown as a diff of the owner's page.
    const proposed = (await (await put(lab, { ...content, plan: true, addRegion: true })).json()).plan
    const blog = proposed.files.find((f: { path: string }) => f.path === "blog/blog.html")
    assert.equal(blog.status, "changed")
    assert.equal(blog.before, PLAIN)
    assert.match(blog.after, /<div data-region="posts">\n\s+<article class="card card--mini" id="post-hello">/)
    assert.equal(proposed.warnings.some((w: { blocking?: boolean }) => w.blocking), false)
    assert.equal(lab.commits.length, 0, "a plan writes nothing")
    const done = await confirmed((b) => put(lab, { ...content, ...b, addRegion: true }))
    assert.equal(done.status, 200, await done.clone().text())
    const after = lab.branch.files.get("blog/blog.html")!.toString()
    assert.ok(after.includes("hello.html"), "the post is listed")
    assert.equal(after.replace(/    <div data-region="posts">\n[\s\S]*?\n    <\/div>\n/, ""), PLAIN, "everything outside the new list is exactly what the owner wrote")
    assert.ok(lab.branch.files.has("blog/posts/hello.html"))
  } finally { await lab.close() }
})

test("publishing without listing is a choice the owner makes, and leaves their blog page untouched", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    lab.branch.files.set("blog/blog.html", Buffer.from(PLAIN))
    const done = await confirmed((b) => put(lab, { ...content, ...b, unlisted: true }))
    assert.equal(done.status, 200)
    assert.equal(lab.branch.files.get("blog/blog.html")!.toString(), PLAIN)
    assert.ok(lab.branch.files.has("blog/posts/hello.html"))
    // A missing blog page is held to the same rule.
    lab.branch.files.delete("blog/blog.html")
    const missing = (await (await put(lab, { post: { title: "Second", markdown: "x" }, plan: true })).json()).plan
    assert.ok(missing.warnings.some((w: { code: string; blocking?: boolean }) => w.code === "no-blog-index" && w.blocking))
  } finally { await lab.close() }
})

test("older comment markers can be replaced in the same reviewed change, and the list keeps working afterwards", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  try {
    const plan = (await (await put(lab, { ...content, plan: true })).json()).plan
    const note = plan.warnings.find((w: { code: string }) => w.code === "legacy-markers")
    assert.ok(note && !note.blocking, "older markers are a suggestion, not a stop")
    assert.deepEqual(note.fixes.map((f: { option: string }) => f.option), ["migrateMarkers"])
    const migrated = (await (await put(lab, { ...content, plan: true, migrateMarkers: true })).json()).plan
    assert.match(migrated.files.find((f: { path: string }) => f.path === "blog/blog.html").after, /<div class="cards" data-region="posts">/)
    assert.equal((await confirmed((b) => put(lab, { ...content, ...b, migrateMarkers: true }))).status, 200)
    const blog = lab.branch.files.get("blog/blog.html")!.toString()
    assert.doesNotMatch(blog, /<!--/)
    assert.ok(blog.includes("<title>Blog - Example Studio</title>") && blog.includes('<header><nav><a href="../index.html">Home</a></nav></header>'), "the owner's page is otherwise unchanged")
    // A second post goes in the same list, with nothing to ask.
    const second = (await (await fetch(`${lab.panel}/api/${withConnection(lab, "site/posts/second")}`, { method: "PUT", headers, body: JSON.stringify({ post: { title: "Second", markdown: "x" }, plan: true }) })).json()).plan
    assert.deepEqual(second.warnings.map((w: { code: string }) => w.code).filter((c: string) => c !== "address-unconfirmed"), [], "nothing left to ask")
    assert.equal((await confirmed((b) => fetch(`${lab.panel}/api/${withConnection(lab, "site/posts/second")}`, { method: "PUT", headers, body: JSON.stringify({ post: { title: "Second", markdown: "x" }, ...b }) }))).status, 200)
    const both = lab.branch.files.get("blog/blog.html")!.toString()
    assert.ok(both.includes("hello.html") && both.includes("second.html"))
  } finally { await lab.close() }
})

test("picture descriptions are asked about in the review and survive into the published page and card", async () => {
  const lab = await startSiteLab({ panelPost: undefined, panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true } as never)
  try {
    const vague = { post: { title: "Hello", excerpt: "Intro", markdown: "![thumb](/img/team.png)", cover: "/img/team.png" } }
    const plan = (await (await put(lab, { ...vague, plan: true })).json()).plan
    const alts = plan.warnings.filter((w: { code: string }) => w.code === "image-alt").map((w: { message: string }) => w.message)
    assert.equal(alts.length, 2)
    assert.match(alts[0], /looks like a file name/)
    assert.match(alts[1], /cover picture has no description/)
    assert.equal(plan.warnings.some((w: { blocking?: boolean }) => w.blocking), false, "a missing description is a question, not a stop")

    const described = { post: { title: "Hello", excerpt: "Intro", markdown: "![The team at the workbench](/img/team.png)", cover: "/img/team.png", coverAlt: "The team smiling", thumbnail: "/img/team.png", thumbnailAlt: "" } }
    const again = (await (await put(lab, { ...described, plan: true })).json()).plan
    assert.equal(again.warnings.some((w: { code: string }) => w.code === "image-alt"), false, "described pictures and a decorative thumbnail raise nothing")
    assert.equal((await confirmed((b) => put(lab, { ...described, ...b }))).status, 200)
    const page = lab.branch.files.get("blog/posts/hello.html")!.toString()
    assert.match(page, /<img src="\.\.\/\.\.\/img\/team\.png" alt="The team at the workbench">/, "inline description survives")
    assert.match(page, /<img class="post-cover" src="\.\.\/\.\.\/img\/team\.png" alt="The team smiling">/, "cover description survives")
    assert.match(lab.branch.files.get("blog/blog.html")!.toString(), /<img class="post-thumb" src="\.\.\/img\/team\.png" alt="" loading="lazy">/, "a decorative thumbnail keeps its empty description")

    const informative = { post: { ...described.post, thumbnailAlt: "The team at the workbench" } }
    assert.equal((await confirmed((b) => put(lab, { ...informative, ...b }))).status, 200)
    assert.match(lab.branch.files.get("blog/blog.html")!.toString(), /alt="The team at the workbench" loading="lazy"/, "an informative thumbnail keeps the entered description")
  } finally { await lab.close() }
})
