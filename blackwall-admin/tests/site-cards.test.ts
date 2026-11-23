import { confirmed } from "./lab-review.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { startSiteLab } from "../server/site-lab.ts"
import { CARD_TOKENS, DEFAULT_CARD_TEMPLATE, cardIssues, categorySlug, cleanPost, draftFieldsFromPost, parseManifest, renderCard, sortCards, updateIndexBlock, type SitePost } from "../shared/site.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import { siteFromTemplate } from "../shared/sitebuilder.ts"

const post = (over: Partial<SitePost> = {}): SitePost => ({ slug: "a", title: "A", excerpt: "e", tags: ["T"], date: "2026-01-01T00:00:00.000Z", markdown: "", ...over })

test("a post saved before categories existed renders exactly the card it always did", () => {
  assert.equal(
    renderCard(post(), "posts/a.html"),
    `<article class="card card--mini" id="post-a">
                <ul class="chips"><li class="chip">T</li></ul>
                <h3>A</h3>
                <p>e</p>
                <div class="card-links"><a href="posts/a.html">Read post ↗</a></div>
              </article>`,
  )
  assert.equal(
    renderCard(post({ tags: [], excerpt: "" }), "x.html"),
    `<article class="card card--mini" id="post-a">
                
                <h3>A</h3>
                
                <div class="card-links"><a href="x.html">Read post ↗</a></div>
              </article>`,
    "with nothing optional the empty lines are the ones the old card left",
  )
})

test("categories, featured and thumbnail reach the card as attributes, chips and a picture; every value is escaped", () => {
  const html = renderCard(post({ categories: ["Case Study", "Web <b>"], featured: true, thumbnail: "/img/t.png", thumbnailAlt: 'A "t"', title: "<i>x</i>" }), "p.html")
  assert.match(html, /id="post-a" data-category="case-study web-b" data-featured="true">/)
  assert.match(html, /<ul class="chips"><li class="chip chip--category">Case Study<\/li><li class="chip chip--category">Web &lt;b&gt;<\/li><li class="chip">T<\/li><\/ul>/, "categories first, then tags")
  assert.match(html, /<img class="post-thumb" src="\/img\/t\.png" alt="A &quot;t&quot;" loading="lazy">/)
  assert.ok(html.includes("<h3>&lt;i&gt;x&lt;/i&gt;</h3>"))
  assert.equal(categorySlug("  Case Study! "), "case-study")
})

test("a site's own template decides the markup; unknown tokens render as nothing and are reported", () => {
  const t = `<li data-featured="{{featured}}" data-category="{{categories}}"><a href="{{href}}">{{title}}</a>{{thumb}} {{nope}}</li>`
  assert.equal(renderCard(post({ featured: true, categories: ["A B"] }), "h.html", t), `<li data-featured="true" data-category="a-b"><a href="h.html">A</a> </li>`)
  assert.deepEqual(cardIssues(DEFAULT_CARD_TEMPLATE), [])
  assert.deepEqual(cardIssues(t), ["Unknown token: {{nope}}."])
  assert.deepEqual(cardIssues("<div>{{title}}</div>"), ["Add {{href}} so the card links to the post."])
  assert.match(cardIssues('<a href="{{href}}" onclick="x()">{{title}}</a>').join(" "), /Scripts and event handlers/)
  assert.match(cardIssues("<script>1</script>{{href}}").join(" "), /Scripts/)
  assert.deepEqual(cardIssues("  "), ["The template is empty."])
  assert.ok(CARD_TOKENS.every((k) => cardIssues(`{{href}}{{${k.token}}}`).length === 0), "every listed token is accepted")
})

test("the blog list shows featured posts first, then newest, and uses the template", () => {
  const list = [post({ slug: "old", date: "2026-01-01T00:00:00.000Z" }), post({ slug: "new", date: "2026-03-01T00:00:00.000Z" }), post({ slug: "pin", date: "2025-01-01T00:00:00.000Z", featured: true })]
  assert.deepEqual(sortCards(list).map((p) => p.slug), ["pin", "new", "old"])
  const out = updateIndexBlock("<div>\n  <!-- blackwall:posts -->\n  <!-- /blackwall:posts -->\n</div>", list, (p) => `${p.slug}.html`, `<i>{{slug}}|{{href}}</i>`)!
  assert.equal(out, "<div>\n  <!-- blackwall:posts -->\n  <i>pin|pin.html</i>\n  <i>new|new.html</i>\n  <i>old|old.html</i>\n  <!-- /blackwall:posts -->\n</div>")
})

test("new post fields are optional: cleaned on the way in, absent for older posts and older manifests", () => {
  const old = cleanPost({ slug: "a", title: "A" })
  assert.deepEqual(Object.keys(old).sort(), ["coverAlt", "cover", "date", "excerpt", "markdown", "slug", "tags", "title", "updated"].sort(), "no new keys appear")
  const full = cleanPost({ slug: "a", title: "A", categories: [" Web ", "web", "Web", "x".repeat(60), "", "b", "c", "d", "e", "f", "g"], featured: true, thumbnail: "/img/t.png", thumbnailAlt: "t" })
  assert.equal(full.categories!.length, 6, "at most six, duplicates by exact text removed")
  assert.equal(full.featured, true)
  assert.equal(full.thumbnail, "/img/t.png")
  assert.throws(() => cleanPost({ slug: "a", title: "A", thumbnail: "../x.png" }), /thumbnail/)
  const manifest = parseManifest(JSON.stringify({ version: 1, posts: [{ slug: "old", title: "Old", date: "2026-01-01T00:00:00.000Z" }, { slug: "new", title: "New", categories: ["A"], featured: true, date: "2026-01-02T00:00:00.000Z" }] }))
  assert.equal(manifest.posts[0].categories, undefined)
  assert.deepEqual(manifest.posts[1].categories, ["A"])
})

test("an older workspace loads; new draft and site fields must be the right kind", () => {
  const t = siteFromTemplate("S", "simple")
  const ts = "2026-11-01T00:00:00Z"
  const site = { ...t.site, id: "s", createdAt: ts, updatedAt: ts }
  const draft = { id: "d", title: "T", slug: "t", kind: "post", status: "idea", excerpt: "", body: "", createdAt: ts, updatedAt: ts }
  const ws = (d: object, s: object = {}) => ({ ...emptyWorkspace(), sites: [{ ...site, ...s }], drafts: [{ ...draft, ...d }] })
  assert.equal(validWorkspace(ws({}) as never), true, "saved before these fields existed")
  assert.equal(validWorkspace(ws({ categories: ["a"], featured: true, thumbnail: "/i.png", thumbnailAlt: "x" }, { cardTemplate: "<a href=\"{{href}}\">{{title}}</a>" }) as never), true)
  for (const bad of [{ categories: "a" }, { categories: [1] }, { featured: "yes" }, { thumbnail: 5 }]) assert.equal(validWorkspace(ws(bad) as never), false, JSON.stringify(bad))
  assert.equal(validWorkspace(ws({}, { cardTemplate: 5 }) as never), false)
  assert.equal(validWorkspace(ws({}, { cardTemplate: "x".repeat(4001) }) as never), false)
})

/** The real server code against the practice run: a post with two categories, a thumbnail and Featured, published to a hand-written site with its own card template. */
test("publishing to an adopted site uses its card template, changes only the files it owns, and a broken template stops the publish", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 20, handwritten: true })
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
  const read = async () => (await (await fetch(`${lab.panel}/api/workspace`, { headers })).json())
  const setTemplate = async (cardTemplate: string | undefined) => { const w = await read(); w.data.sites[0].cardTemplate = cardTemplate; assert.equal((await fetch(`${lab.panel}/api/workspace`, { method: "PUT", headers, body: JSON.stringify(w) })).status, 200) }
  const publish = (slug: string, body: object) => confirmed((b) => fetch(`${lab.panel}/api/site/posts/${slug}?connection=${lab.connection}`, { method: "PUT", headers, body: JSON.stringify({ post: { title: "Hello", excerpt: "Intro", markdown: "# Hi", ...body }, ...b }) }))
  try {
    await setTemplate(`<li class="entry"{{attrs}}><a href="{{href}}">{{title}}</a> {{chips}}{{thumb}}</li>`)
    const first = await publish("hello", { categories: ["Case Study", "Web"], featured: true, thumbnail: "/img/t.png", thumbnailAlt: "A thumb", tags: ["Week 1"] })
    assert.equal(first.status, 200, await first.clone().text())
    assert.deepEqual(lab.commits.at(-1)!.changed.concat(lab.commits.at(-1)!.added).sort(), ["blog/blog.html", "blog/posts/hello.html", "blog/posts/index.json", "blog/posts/post.css"])
    const index = lab.branch.files.get("blog/blog.html")!.toString()
    assert.match(index, /<li class="entry" data-category="case-study web" data-featured="true"><a href="posts\/hello\.html">Hello<\/a> <ul class="chips"><li class="chip chip--category">Case Study<\/li>/)
    assert.match(index, /<img class="post-thumb" src="\.\.\/img\/t\.png" alt="A thumb" loading="lazy">/)
    assert.ok(index.includes("<title>Blog - Example Studio</title>") && index.includes('<div class="cards">'), "the rest of the blog page is untouched")
    const manifest = JSON.parse(lab.branch.files.get("blog/posts/index.json")!.toString())
    assert.deepEqual(manifest.posts[0].categories, ["Case Study", "Web"])

    // A second, plain post sits after the featured one.
    assert.equal((await publish("second", { title: "Second" })).status, 200)
    const both = lab.branch.files.get("blog/blog.html")!.toString()
    assert.ok(both.indexOf("Hello") < both.indexOf("Second"), "featured first")

    // A broken template is refused before anything is committed.
    const before = lab.commits.length
    await setTemplate("<li>{{title}}</li>")
    const refused = await publish("third", { title: "Third" })
    assert.equal(refused.status, 409)
    assert.match((await refused.json()).error, /template has a problem/)
    assert.equal(lab.commits.length, before)

    // No template chosen: the card Blackwall has always made.
    await setTemplate(undefined)
    assert.equal((await publish("third", { title: "Third" })).status, 200)
    assert.match(lab.branch.files.get("blog/blog.html")!.toString(), /<article class="card card--mini" id="post-third">/)
  } finally {
    await lab.close()
  }
})

test("opening a post that is only on the site keeps its categories, Featured and thumbnail", () => {
  const draft = draftFieldsFromPost(post({ categories: ["Case Study", "Web"], featured: true, thumbnail: "/img/a.png", thumbnailAlt: "A picture" }))
  assert.deepEqual(draft.categories, ["Case Study", "Web"])
  assert.equal(draft.featured, true)
  assert.equal(draft.thumbnail, "/img/a.png")
  assert.equal(draft.thumbnailAlt, "A picture")
  assert.equal(draft.remoteSlug, "a")
  // A post saved before these existed opens exactly as before: no new keys.
  const old = draftFieldsFromPost(post())
  assert.ok(!("categories" in old) && !("featured" in old) && !("thumbnail" in old))
})
