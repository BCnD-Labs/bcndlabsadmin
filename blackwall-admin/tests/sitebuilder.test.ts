import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSite, mk, renderPage, safeHref, siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Draft, Site, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function portal() {
  const t = siteFromTemplate("BCnD Labs", "portal")
  const site: Site = { ...t.site, id: "s1", domain: "bcndlabs.dev", redirects: [{ from: "/about", to: "/projects/" }], createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  pages[2] = { ...pages[2], title: "Projects", slug: "projects" }
  const post = (id: string, title: string, week: number, publishedAt?: string): Draft => ({ id, title, slug: id, kind: "post", status: "ready", excerpt: "x", body: "# Hi\n\nBody", siteId: "s1", week, course: "ADD 103", due: "2026-11-09", publishedAt, createdAt: ts, updatedAt: ts })
  return { site, pages, posts: [post("forms", "10A Forms", 10, ts), post("grid", "9A Grid", 9, ts), post("wip", "11A Draft", 11)] }
}

test("a course-portal site builds every page, published posts only, and the support files", () => {
  const { site, pages, posts } = portal()
  const files = buildSite(site, pages, posts, [])
  for (const f of ["index.html", "blog/index.html", "projects/index.html", "contact/index.html", "posts/forms/index.html", "posts/grid/index.html", "theme.css", "style.css", "sitemap.xml", "robots.txt", "_redirects", "about/index.html"]) assert.ok(f in files, f)
  assert.ok(!("posts/wip/index.html" in files), "unpublished drafts stay off the site")
  const blog = files["blog/index.html"]
  assert.ok(blog.indexOf("Week 10") < blog.indexOf("Week 9"), "newest week first")
  assert.ok(!blog.includes("Week 11"))
  assert.ok(blog.includes('href="/posts/forms/"'))
  assert.match(files["_redirects"], /^\/about \/projects\/ 301/)
  assert.match(files["about/index.html"], /url=\/projects\//)
  assert.match(files["sitemap.xml"], /https:\/\/bcndlabs.dev\/posts\/grid\//)
  assert.ok(files["index.html"].includes('<a href="/projects/">Projects</a>'), "renamed page shows in the menu")
})

test("text is escaped and links are limited to safe schemes", () => {
  const { site, pages } = portal()
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [mk("heading", { text: "<script>x</script>" }), mk("button", { text: "Go", href: "javascript:alert(1)" })])] }
  const html = renderPage(site, pages, page)
  assert.ok(!html.includes("<script>x"))
  assert.ok(html.includes('href="#"'))
  assert.equal(safeHref("/contact/"), "/contact/")
  assert.equal(safeHref("https://x.dev"), "https://x.dev")
})
