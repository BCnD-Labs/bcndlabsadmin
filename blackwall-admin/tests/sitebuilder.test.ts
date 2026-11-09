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

import { checkSite, cloneBlocks, importHtml, nameFirstHeading, siteFromSite, buildCss, buildTheme, PAGE_KINDS, section } from "../shared/sitebuilder.ts"
import { crc32, makeZip } from "../shared/zip.ts"
import { validWorkspace, emptyWorkspace } from "../shared/workspace.ts"

test("type, corners and width reach theme.css as variables, and an older site still builds with the defaults", () => {
  const { site } = portal()
  const plain = buildTheme(site)
  assert.match(plain, /--radius: 8px;/)
  assert.match(plain, /--width: 1100px;/)
  const styled = buildTheme({ ...site, font: "serif", corners: "round", width: "wide" })
  assert.match(styled, /--font: Georgia/)
  assert.match(styled, /--radius: 18px;/)
  assert.match(styled, /--width: 1320px;/)
  assert.match(buildCss(), /var\(--radius, 8px\)/)
})

test("a Custom HTML block is published as written, and the preview marks every block so a click finds it", () => {
  const { site, pages } = portal()
  const block = mk("html", { code: "<p class=\"mine\">Hand-made</p>" })
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [block])] }
  assert.ok(renderPage(site, pages, page).includes('<p class="mine">Hand-made</p>'))
  assert.ok(!renderPage(site, pages, page).includes("data-bw"), "the published page carries no editor marks")
  const preview = renderPage(site, pages, page, { preview: true })
  assert.ok(preview.includes(`data-bw="${block.id}"`))
  assert.ok(preview.includes(`data-bw="${page.sections[0].id}"`))
})

test("the first heading of a new page becomes its title; pages get ids of their own when copied", () => {
  const named = nameFirstHeading([section("threeCards")], "Projects")
  assert.equal(named[0].kids![0].text, "Projects")
  assert.equal(named[0].kids![0].level, "1")
  assert.equal(PAGE_KINDS.contact.slug, "contact")
  const copy = cloneBlocks(named)
  const ids = (list: typeof copy): string[] => list.flatMap((b) => [b.id, ...(b.kids ? ids(b.kids) : [])])
  const before = new Set(ids(named))
  assert.ok(ids(copy).every((id) => !before.has(id)), "every block of the copy has a fresh id")
  assert.equal(JSON.stringify(copy).replace(/"id":"[^"]+"/g, ""), JSON.stringify(named).replace(/"id":"[^"]+"/g, ""))
})

test("a site kept as a template starts a new site with its look and pages, but none of its history", () => {
  const { site, pages } = portal()
  const source: Site = { ...site, font: "mono", corners: "sharp", template: true, publishedAt: ts, exportedAt: ts, connectionId: "c1", footerText: "© Old" }
  const made = siteFromSite("Second", source, pages)
  assert.equal(made.site.name, "Second")
  assert.equal(made.site.font, "mono")
  assert.equal(made.site.domain, "")
  assert.equal(made.site.template, undefined)
  assert.equal(made.site.publishedAt, undefined)
  assert.equal(made.site.connectionId, undefined)
  assert.equal(made.pages.length, pages.length)
  assert.notEqual(made.pages[0].sections[0].id, pages[0].sections[0].id)
})

test("the site check names placeholders, dead links and forms that can't send, and a finished site passes", () => {
  const { site, pages, posts } = portal()
  const issues = checkSite({ ...site, domain: "" }, pages, posts, [])
  const text = issues.map((i) => i.text).join("\n")
  assert.match(text, /placeholder text/)
  assert.match(text, /nowhere/)
  assert.match(text, /no form chosen/)
  assert.match(text, /Add your domain/)
  const done: SitePage[] = [{ ...pages[0], description: "Home page", sections: [mk("section", {}, [mk("heading", { level: "1", text: "Hi" }), mk("text", { text: "Hello" }), mk("button", { text: "About", href: "/about/" })])] }, { ...pages[1], slug: "about", description: "About me", sections: [mk("section", {}, [mk("heading", { level: "1", text: "About" }), mk("text", { text: "Me" })])] }]
  assert.deepEqual(checkSite(site, done, [], []).filter((i) => i.level === "fix"), [])
  const broken = [{ ...done[0], sections: [mk("section", {}, [mk("button", { text: "Gone", href: "/missing/" })])] }]
  assert.match(checkSite(site, broken, [], []).map((i) => i.text).join("\n"), /nowhere/)
  assert.match(checkSite(site, [{ ...done[1], slug: "x" }], [], []).map((i) => i.text).join("\n"), /no home page/)
})

test("an existing page can be brought over: title, description and main content, without its header, footer or scripts", () => {
  const got = importHtml(`<!doctype html><html><head><title>Projects — Old Site</title><meta name="description" content="What I built"></head><body><header><nav>menu</nav></header><main><h1>Projects</h1><p>One &amp; two</p><script>alert(1)</script></main><footer>© me</footer></body></html>`)
  assert.equal(got.title, "Projects")
  assert.equal(got.description, "What I built")
  assert.equal(got.body, "<h1>Projects</h1><p>One &amp; two</p>")
})

test("the .zip a site is downloaded as has the right checksums and file names", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926)
  const zip = makeZip({ "index.html": "<p>hi</p>", "about/index.html": "x" })
  const view = new DataView(zip.buffer)
  assert.equal(view.getUint32(0, true), 0x04034b50)
  assert.equal(view.getUint16(zip.length - 12, true), 2, "two entries in the central directory")
  assert.ok(new TextDecoder().decode(zip).includes("about/index.html"))
})

test("an older saved site (no look, template or guide fields) still loads, and so does one with them", () => {
  const { site, pages } = portal()
  const old = { ...emptyWorkspace(), sites: [site], pages }
  assert.ok(validWorkspace(structuredClone(old)))
  const newer = { ...emptyWorkspace(), sites: [{ ...site, font: "serif", corners: "round", width: "wide", template: true, templateAbout: "x", guideHidden: true, exportedAt: ts }], pages }
  assert.ok(validWorkspace(structuredClone(newer)))
})
