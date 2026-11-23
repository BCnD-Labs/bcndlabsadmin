import assert from "node:assert/strict"
import { test } from "node:test"
import { HANDWRITTEN } from "../server/site-lab.ts"
import { extractChrome, localize, POST_CSS, renderPostPage, siteBase, toRelative, type SitePost } from "../shared/site.ts"

test("the site's own folder is read from its address", () => {
  assert.equal(siteBase("https://owner.github.io/site/"), "/site")
  assert.equal(siteBase("https://owner.github.io"), "")
  assert.equal(siteBase("https://example.com/"), "")
  assert.equal(siteBase(""), "")
  assert.equal(siteBase(undefined), "")
})

test("root paths become links relative to the file, with no prefix to add twice", () => {
  const from = "blog/posts/hello.html"
  const rel = (u: string, base = "") => toRelative(u, from, base)
  // Project site, root site and a custom domain all give the same links.
  for (const base of ["/site", ""]) {
    assert.equal(rel("/css/style.css", base), "../../css/style.css")
    assert.equal(rel("/index.html", base), "../../index.html")
    assert.equal(rel("/img/a.png?v=2#x", base), "../../img/a.png?v=2#x")
    assert.equal(rel("/about/", base), "../../about/")
    assert.equal(rel("/", base), "../../")
    assert.equal(rel("/blog/blog.html", base), "../blog.html")
  }
  // Already prefixed with the project folder: the prefix is dropped, never doubled.
  assert.equal(rel("/site/css/style.css", "/site"), "../../css/style.css")
  assert.equal(rel("/site", "/site"), "../../")
  assert.equal(rel("/Site/img/a.png", "/site"), "../../img/a.png", "case-insensitive, like the host")
  // A folder that merely starts with the same letters is a different folder.
  assert.equal(rel("/sites/a.png", "/site"), "../../sites/a.png")
  // Not root paths: left alone.
  for (const u of ["https://cdn.example/a.css", "//cdn.example/a.css", "#top", "../x.png", "mailto:a@b.c", "x.png", ""]) assert.equal(rel(u, "/site"), u)
  assert.equal(toRelative(undefined, from), undefined)
  assert.equal(toRelative("/a.png", "index.html"), "a.png", "a file at the top of the site")
  assert.equal(toRelative("/", "index.html"), "./")
})

test("localize rewrites href, src and poster and nothing else", () => {
  const out = localize(`<a href="/about/">A</a> <img src='/img/a.png' alt="/img/not-a-link.png"> <video poster="/img/p.jpg"></video> <a href="https://x.example/">x</a> <p>/img/text.png</p>`, "blog/posts/a.html", "/site")
  assert.equal(out, `<a href="../../about/">A</a> <img src='../../img/a.png' alt="/img/not-a-link.png"> <video poster="../../img/p.jpg"></video> <a href="https://x.example/">x</a> <p>/img/text.png</p>`)
})

const post: SitePost = { slug: "hello", title: "Hello", excerpt: "Intro", tags: ["Week 1"], date: "2026-11-23T15:00:00.000Z", markdown: "Text with ![A team photo](/img/team.png) and a [home link](/index.html).", cover: "/img/cover.png", coverAlt: "A cover" }
const chrome = extractChrome(HANDWRITTEN["blog/blog.html"], "blog/blog.html")

/** Every local link in a page, resolved the way a browser resolves it from where the page is served. */
function resolved(html: string, pageUrl: string) {
  return [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|#|mailto:)/.test(u)).map((u) => new URL(u, pageUrl).pathname)
}
const REPO = new Set([...Object.keys(HANDWRITTEN), "blog/posts/post.css", "img/team.png", "img/cover.png"])

test("a post page's links all land inside the site, wherever the site is served", () => {
  for (const [siteUrl, root] of [["https://owner.github.io/site", "/site/"], ["https://owner.github.io", "/"], ["https://www.example.com", "/"], ["https://example.com/portfolio/", "/portfolio/"]] as const) {
    const html = renderPostPage(post, chrome, "/blog/blog.html", { file: "blog/posts/hello.html", siteUrl })
    const links = resolved(html, `${siteUrl.replace(/\/+$/, "")}/blog/posts/hello.html`)
    assert.ok(links.length >= 6, "the page has stylesheet, nav, back link, cover and body links")
    for (const path of links) {
      assert.ok(path.startsWith(root), `${path} stays inside ${root}`)
      const inRepo = path.slice(root.length)
      assert.ok(REPO.has(inRepo), `${inRepo} exists in the repository (${siteUrl})`)
    }
    assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/css\/style\.css">/)
    assert.match(html, /<link rel="stylesheet" href="post\.css">/)
    assert.match(html, /<a class="post-back" href="\.\.\/blog\.html">/)
    assert.match(html, /<img class="post-cover" src="\.\.\/\.\.\/img\/cover\.png" alt="A cover">/)
    assert.match(html, /<img src="\.\.\/\.\.\/img\/team\.png" alt="A team photo">/)
    assert.match(html, new RegExp(`<meta property="og:image" content="${siteUrl.replace(/\/+$/, "")}/img/cover\\.png">`), "the social image is a full address")
  }
})

test("the same post gives the same page on every host except the social image address", () => {
  const strip = (h: string) => h.replace(/ *<meta property="og:image"[^>]*>\n/, "")
  const a = strip(renderPostPage(post, chrome, "/blog/blog.html", { file: "blog/posts/hello.html", siteUrl: "https://owner.github.io/site" }))
  const b = strip(renderPostPage(post, chrome, "/blog/blog.html", { file: "blog/posts/hello.html", siteUrl: "https://example.com" }))
  const c = strip(renderPostPage(post, chrome, "/blog/blog.html", { file: "blog/posts/hello.html" }))
  assert.equal(a, b)
  assert.equal(a, c, "even with no site address at all")
})

test("published pages and styles carry no tool branding, no comments and no inline styling", () => {
  const html = renderPostPage(post, chrome, "/blog/blog.html", { file: "blog/posts/hello.html", siteUrl: "https://owner.github.io/site" })
  assert.doesNotMatch(html, /blackwall|pagesmith|bw-|generated|<!--|<style/i)
  assert.doesNotMatch(POST_CSS, /blackwall|pagesmith|bw-|generated|\/\*/i)
  assert.match(html, /^<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">/, "plain, consistently indented source")
  assert.ok(html.endsWith("</html>\n"))
  assert.match(html, /<article class="post">[\s\S]*<div class="post-content">/)
  assert.match(html, /\n          <p>Text with /, "the body is indented like the rest of the page")
  const code = renderPostPage({ ...post, markdown: "```\nline one\n  line two\n```" }, chrome, "/b.html", { file: "blog/posts/hello.html" })
  assert.match(code, /<pre><code>line one\n  line two\n<\/code><\/pre>/, "code blocks keep their exact text")
  // The site's own header, footer and stylesheet links are the ones carried over: its design is kept.
  assert.match(html, /<header><nav><a href="\.\.\/\.\.\/index\.html">Home<\/a><\/nav><\/header>/)
})

test("the preview keeps its look inline, since it has no post.css to load", () => {
  const html = renderPostPage(post, chrome, "/blog/blog.html", { inlineStyles: true })
  assert.match(html, /<style>\.post \{/)
  assert.doesNotMatch(html, /post\.css/)
})

test("the site's language carries over to its posts", () => {
  assert.equal(extractChrome('<html lang="fr"><head></head><body></body></html>', "x.html").lang, "fr")
  assert.match(renderPostPage(post, { ...chrome, lang: "fr" }, "/b.html"), /<html lang="fr">/)
})

import { buildSite, siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Draft, Site, SitePage } from "../src/lib/types.ts"

function built(framework?: "bootstrap") {
  const ts = "2026-11-01T00:00:00Z"
  const t = siteFromTemplate("Example Studio", "portal")
  const site: Site = { ...t.site, id: "s1", domain: "owner.github.io/site", themeToggle: true, ...(framework ? { framework } : {}), createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  const post: Draft = { id: "d1", title: "Hello", slug: "hello", kind: "post", status: "ready", excerpt: "x", body: "Body", siteId: "s1", publishedAt: ts, createdAt: ts, updatedAt: ts }
  return buildSite(site, pages, [post], [], [], [])
}

test("a generated site has no tool names or comments, and every link in it resolves inside a project site", () => {
  for (const framework of [undefined, "bootstrap" as const]) {
    const files = built(framework)
    for (const [name, text] of Object.entries(files)) {
      if (!/\.(html|css|js)$/.test(name)) continue
      const own = text.replace(/https?:\/\/[^\s"')]+/g, "")
      assert.doesNotMatch(own, /blackwall|pagesmith|generated by/i, `${name} carries no tool name (${framework ?? "plain"})`)
      if (name.endsWith(".css") || name.endsWith(".js")) assert.doesNotMatch(text, /\/\*/, `${name} has no comments`)
      if (name.endsWith(".html")) assert.doesNotMatch(text, /<!--/, `${name} has no comments`)
    }
    assert.ok("js/main.js" in files && !("pagesmith.js" in files))
    for (const [name, text] of Object.entries(files)) {
      if (!name.endsWith(".html") || /http-equiv="refresh"/.test(text)) continue
      for (const path of resolved(text, `https://owner.github.io/site/${name}`)) {
        assert.ok(path.startsWith("/site/"), `${name}: ${path} stays inside the project folder`)
        const file = path.slice("/site/".length)
        assert.ok(file in files || `${file}index.html` in files || (file === "" && "index.html" in files), `${name}: ${path} points at a file the site has`)
      }
    }
  }
})

import { startSiteLab } from "../server/site-lab.ts"
import { confirmed, withConnection } from "./lab-review.ts"

test("a post published to a project-path site lands as plain, relative files with nothing naming the tool", async () => {
  const lab = await startSiteLab({ panelPort: 0, sitePort: 0, formsPort: 0, deployMs: 10, handwritten: true })
  const headers = { "X-Blackwall": "1", "Content-Type": "application/json" }
  try {
    const project = await lab.store.create({ provider: "website", label: "Project path", config: { repo: "lab/site", branch: "main", siteUrl: `${lab.site}/portfolio`, blogIndex: "blog/blog.html", postsDir: "blog/posts", imagesDir: "img" }, secrets: { token: "lab" } })
    const post = { title: "Hello", excerpt: "Intro", markdown: "![Team](/portfolio/img/team.png)\n\n[Home](/portfolio/index.html)", thumbnail: "/img/team.png", thumbnailAlt: "", cover: "/img/team.png", coverAlt: "The team" }
    const r = await confirmed((b) => fetch(`${lab.panel}/api/${withConnection({ connection: project.id }, "site/posts/hello")}`, { method: "PUT", headers, body: JSON.stringify({ post, ...b }) }), { message: "Add post: Hello" })
    assert.equal(r.status, 200, await r.clone().text())
    const page = lab.branch.files.get("blog/posts/hello.html")!.toString()
    assert.match(page, /<link rel="stylesheet" href="\.\.\/\.\.\/css\/style\.css">/)
    assert.match(page, /<img src="\.\.\/\.\.\/img\/team\.png" alt="Team">/, "a prefixed body image is not prefixed twice")
    assert.match(page, /<a href="\.\.\/\.\.\/index\.html">Home<\/a>/)
    assert.match(page, /<img class="post-cover" src="\.\.\/\.\.\/img\/team\.png" alt="The team">/)
    assert.match(page, new RegExp(`og:image" content="${lab.site}/portfolio/img/team\\.png"`), "the social image is a full address under the project path")
    assert.match(lab.branch.files.get("blog/blog.html")!.toString(), /<img class="post-thumb" src="\.\.\/img\/team\.png" alt="" loading="lazy">/)
    assert.ok(lab.branch.files.get("blog/posts/post.css")!.toString().startsWith(".post {"))
    for (const f of ["blog/posts/hello.html", "blog/posts/post.css"]) assert.doesNotMatch(lab.branch.files.get(f)!.toString(), /blackwall|pagesmith|bw-|<style|<!--/i, f)
    assert.doesNotMatch(lab.branch.files.get("blog/posts/index.json")!.toString(), /blackwall|pagesmith/i)
  } finally { await lab.close() }
})
