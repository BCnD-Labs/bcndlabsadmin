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

import { findAsset } from "../shared/assets.ts"
test("library pictures go into the published markup with their size, previews use the editor's copy, and pictures from outside the library are flagged", () => {
  const { site, pages } = portal()
  const asset = { id: "a1", name: "Team", file: "team.webp", folder: "/Blackwall/assets", mime: "image/webp", width: 1200, height: 675, bytes: 34000, alt: "The team", createdAt: ts, updatedAt: ts }
  const page: SitePage = { ...pages[0], description: "d", sections: [mk("section", {}, [mk("heading", { level: "1", text: "Hi" }), mk("image", { src: "/images/team.webp", alt: "The team" })])] }
  const live = renderPage(site, pages, page, { assets: [asset] })
  assert.match(live, /<img class="pic" src="\/images\/team.webp" width="1200" height="675" alt="The team" loading="lazy">/)
  const preview = renderPage(site, pages, page, { preview: true, assets: [asset], assetUrls: { "/images/team.webp": "blob:abc" } })
  assert.ok(preview.includes('src="blob:abc"'))
  assert.ok(!live.includes("blob:"))
  assert.equal(findAsset([asset], "/images/team.webp")?.id, "a1")
  assert.ok(!checkSite(site, [page, pages[1]], [], [], [asset]).some((i) => /asset library/.test(i.text) && i.pageId === page.id), "a library picture is fine")
  const stray: SitePage = { ...page, sections: [mk("section", {}, [mk("image", { src: "https://elsewhere/x.png", alt: "x" })])] }
  assert.match(checkSite(site, [stray], [], [], [asset]).map((i) => i.text).join("\n"), /aren't from your asset library|isn't from your asset library/)
  const post = { id: "d", title: "T", slug: "t", kind: "post" as const, status: "ready" as const, excerpt: "", body: "![x](/images/gone.webp)", siteId: "s1", cover: "/images/team.webp", publishedAt: ts, createdAt: ts, updatedAt: ts }
  assert.match(checkSite(site, [page], [post], [], [asset]).map((i) => i.text).join("\n"), /gone\.webp/)
  const files = buildSite(site, [page], [post], [], [], [asset])
  assert.match(files["posts/t/index.html"], /class="post__cover" src="\/images\/team.webp" width="1200"/)
})

test("a .zip can carry picture bytes next to text files, with the right checksum", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 255])
  const zip = makeZip({ "index.html": "<p>x</p>", "images/a.png": png })
  const view = new DataView(zip.buffer)
  let at = 0, found = false
  while (at < zip.length - 30 && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true), nameLen = view.getUint16(at + 26, true)
    const name = new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameLen))
    if (name === "images/a.png") {
      found = true
      assert.equal(size, png.length)
      assert.equal(view.getUint32(at + 14, true), crc32(png))
      assert.deepEqual([...zip.subarray(at + 30 + nameLen, at + 30 + nameLen + size)], [...png])
    }
    at += 30 + nameLen + size
  }
  assert.ok(found)
})

/* ------------------------------------------------- the site workspace */
import { canHold, canNest, duplicateBlock, findBlock, indentBlock, moveBlock, movePage, nudgeBlock, outdentBlock, pageTree, projectDrop } from "../shared/sitebuilder-tree.ts"
import { EditHistory, changeKey } from "../shared/edit-history.ts"
import { footerPages, menuTree, renderSectionPreview } from "../shared/sitebuilder.ts"

const page = (id: string, order: number, more: Partial<SitePage> = {}): SitePage => ({ id, siteId: "s1", title: id.toUpperCase(), slug: id === "home" ? "" : id, description: "", inMenu: true, order, sections: [], createdAt: ts, updatedAt: ts, ...more })

test("a site with none of the new fields publishes exactly as it did: no drop-down markup, no extra CSS, the same footer", () => {
  const { site, pages, posts } = portal()
  const files = buildSite(site, pages, posts, [])
  const html = files["index.html"]
  assert.ok(!html.includes("has-sub") && !html.includes('class="bs') && !html.includes("data-bw"))
  assert.equal(files["style.css"], buildCss())
  assert.ok(!files["style.css"].includes(".site-nav .sub") && !files["style.css"].includes(".bs-a-center"))
  const footer = html.slice(html.indexOf('<footer'))
  for (const p of pages) assert.ok(footer.includes(`>${p.title}</a>`), `${p.title} in footer`)
})

test("a nested page becomes a drop-down that needs no script, and is reachable by keyboard", () => {
  const { site } = portal()
  const pages = [page("home", 0), page("work", 1), page("one", 2, { parentId: "work" }), page("two", 3, { parentId: "work" })]
  const files = buildSite(site, pages, [], [])
  const html = files["index.html"]
  assert.match(html, /<li class="has-sub"><a href="\/work\/">WORK<\/a>\n\s*<ul class="sub" aria-label="WORK pages">\n\s*<li><a href="\/one\/">ONE<\/a><\/li>/)
  assert.match(files["style.css"], /\.has-sub:focus-within > \.sub/)
  assert.match(files["style.css"], /\.has-sub:hover > \.sub/)
  assert.ok(!/<script/.test(html), "no script for the menu")
  assert.equal(menuTree(pages)[1].kids.length, 2)
})

test("a nested page whose parent is gone, hidden or nested itself sits at the top level", () => {
  const tree = menuTree([page("a", 0, { parentId: "gone" }), page("b", 1, { inMenu: false }), page("c", 2, { parentId: "b" }), page("d", 3), page("e", 4, { parentId: "d" }), page("f", 5, { parentId: "e" })])
  assert.deepEqual(tree.map((r) => r.page.id), ["a", "c", "d", "f"])
  assert.deepEqual(tree[2].kids.map((k) => k.id), ["e"])
})

test("the footer menu is its own list once a page is picked for it, and repeats the main menu until then", () => {
  const { site } = portal()
  assert.deepEqual(footerPages([page("home", 0), page("a", 1), page("b", 2, { inMenu: false })]).map((p) => p.id), ["home", "a"])
  const pages = [page("home", 0, { inFooter: false }), page("a", 1, { inFooter: true }), page("b", 2, { inMenu: false, inFooter: true })]
  assert.deepEqual(footerPages(pages).map((p) => p.id), ["a", "b"])
  const footer = renderPage(site, pages, pages[0]).split("<footer")[1]
  assert.ok(footer.includes(">B</a>") && !footer.includes(">HOME</a>"))
  const none = pages.map((p) => ({ ...p, inFooter: false }))
  assert.ok(!renderPage(site, none, none[0]).split("<footer")[1].includes("site-nav"), "an empty footer menu draws nothing")
})

test("Style choices become classes on the block; unknown values are ignored and the CSS only ships when used", () => {
  const { site } = portal()
  const h = mk("heading", { text: "Hi", design: { align: "center", top: "l", bg: "accent" } })
  const sec = mk("section", { design: { bottom: "none" } }, [h, mk("text", { text: "Plain", design: { align: "<script>" as never } })])
  const p = page("home", 0, { sections: [sec] })
  const html = renderPage(site, [p], p)
  assert.match(html, /<section class="bs-b-none section">/)
  assert.match(html, /<div class="bs bs-a-center bs-t-l bs-bg-accent">\n\s*<h2>Hi<\/h2>/)
  assert.ok(!html.includes("<script>"))
  assert.match(buildCss([p]), /\.bs-a-center/)
})

test("editor marks and the add-section strips exist only in the editor's own preview", () => {
  const { site } = portal()
  const p = page("home", 0, { sections: [section("hero"), section("plainText")] })
  const edit = renderPage(site, [p], p, { preview: true, edit: true })
  assert.equal(edit.match(/data-bw-insert=/g)?.length, 3)
  assert.ok(edit.includes(`data-bw="${p.sections[0].id}" data-bw-t="section"`))
  assert.ok(!renderPage(site, [p], p, { preview: true }).includes("data-bw-insert"))
  assert.ok(!renderPage(site, [p], p).includes("data-bw"))
  const empty = page("e", 0)
  assert.match(renderPage(site, [empty], empty, { preview: true, edit: true }), /bw-insert--empty/)
})

test("older saved pages load, new page fields are checked, and a copied template keeps its footer picks", () => {
  const { pages, site } = portal()
  const older = { ...emptyWorkspace(), sites: [site], pages }
  assert.ok(validWorkspace(older), "pages without parentId or inFooter still load")
  assert.ok(validWorkspace({ ...older, pages: [{ ...pages[0], parentId: "p1", inFooter: true, sections: [{ id: "b", type: "text", design: { align: "center" } }] }] }))
  assert.ok(!validWorkspace({ ...older, pages: [{ ...pages[0], parentId: 3 }] }))
  assert.ok(!validWorkspace({ ...older, pages: [{ ...pages[0], inFooter: "yes" }] }))
  const copy = siteFromSite("New", site, [page("home", 0, { inFooter: true }), page("a", 1)])
  assert.equal(copy.pages[0].inFooter, true)
  assert.equal("inFooter" in copy.pages[1], false)
})

function tree() {
  return [mk("section", { id: "s1" }, [mk("heading", { id: "h" }), mk("row", { id: "r" }, [mk("card", { id: "c" }, [mk("text", { id: "t" })])])]), mk("section", { id: "s2" }, [mk("button", { id: "b" })])]
}
const ids = (l: ReturnType<typeof tree>): unknown => l.map((b) => (b.kids ? [b.id, ids(b.kids)] : b.id))

test("blocks move in and out of containers, and the nesting rules hold", () => {
  const t = tree()
  assert.deepEqual(ids(moveBlock(t, "b", "c", null)), [["s1", ["h", ["r", [["c", ["t", "b"]]]]]], ["s2", []]])
  assert.deepEqual(ids(moveBlock(t, "h", "s1", null)), [["s1", [["r", [["c", ["t"]]]], "h"]], ["s2", ["b"]]])
  assert.deepEqual(ids(moveBlock(t, "s2", null, "s1")), [["s2", ["b"]], ["s1", ["h", ["r", [["c", ["t"]]]]]]])
  assert.equal(moveBlock(t, "h", null, null), t, "a block can't sit outside a section")
  assert.equal(moveBlock(t, "s1", "s2", null), t, "a section can't nest")
  assert.equal(moveBlock(t, "r", "c", null), t, "can't go inside itself")
  assert.ok(!canHold({ type: "row" }, { type: "row" }) && canHold({ type: "card" }, { type: "row" }) && !canHold({ type: "heading" }, { type: "text" }))
})

test("Alt+arrow moves: along siblings, out of a container, into the one above", () => {
  const t = tree()
  assert.deepEqual(ids(nudgeBlock(t, "r", -1))[0], ["s1", [["r", [["c", ["t"]]]], "h"]])
  assert.deepEqual(ids(nudgeBlock(t, "h", 1))[0], ["s1", [["r", [["c", ["t"]]]], "h"]])
  assert.equal(nudgeBlock(t, "h", -1), t)
  assert.deepEqual(ids(outdentBlock(t, "t"))[0], ["s1", ["h", ["r", [["c", []], "t"]]]])
  assert.equal(outdentBlock(t, "h"), t, "a block can't leave its section for the page")
  assert.deepEqual(ids(indentBlock(moveBlock(t, "b", "s1", null), "b"))[0], ["s1", ["h", ["r", [["c", ["t"]], "b"]]]])
})

test("a duplicate is a deep copy with fresh ids, right after the original", () => {
  const { list, copyId } = duplicateBlock(tree(), "r")
  const s1 = list[0].kids!
  assert.equal(s1[2].id, copyId)
  assert.notEqual(s1[2].kids![0].id, "c")
  assert.ok(findBlock(list, "c"))
})

test("pages reorder and nest; home and pages with drop-downs stay at the top", () => {
  const pages = [page("home", 0), page("a", 1), page("b", 2), page("c", 3)]
  const apply = (ps: SitePage[], patches: ReturnType<typeof movePage>) => ps.map((p) => { const x = patches.find((y) => y.id === p.id); return x ? { ...p, order: x.order, parentId: x.parentId } : p })
  const reordered = apply(pages, movePage(pages, "c", null, "a"))
  assert.deepEqual(pageTree(reordered).map((r) => r.page.id), ["home", "c", "a", "b"])
  const nested = apply(pages, movePage(pages, "b", "a", null))
  assert.deepEqual(pageTree(nested).map((r) => [r.page.id, r.kids.map((k) => k.id)]), [["home", []], ["a", ["b"]], ["c", []]])
  assert.deepEqual(movePage(nested, "a", "c", null), [], "a page with a drop-down can't nest")
  assert.deepEqual(movePage(pages, "home", "a", null), [], "the home page stays at the top")
  assert.ok(!canNest(nested.find((p) => p.id === "a")!, nested))
  const out = apply(nested, movePage(nested, "b", null, null))
  assert.equal(out.find((p) => p.id === "b")!.parentId, undefined)
})

test("dragging: sideways pull picks the depth, and only legal places count", () => {
  const rows = [{ id: "s1", depth: 0, parentId: null, t: "section" }, { id: "h", depth: 1, parentId: "s1", t: "heading" }, { id: "c", depth: 1, parentId: "s1", t: "card" }, { id: "t", depth: 2, parentId: "c", t: "text" }, { id: "s2", depth: 0, parentId: null, t: "section" }, { id: "b", depth: 1, parentId: "s2", t: "button" }]
  const allow = (a: (typeof rows)[number], p: (typeof rows)[number] | null) => canHold(p ? { type: p.t } : null, { type: a.t })
  assert.deepEqual(projectDrop(rows, "b", "h", 0, 16, allow), { depth: 1, parentId: "s1", beforeId: "h" })
  assert.deepEqual(projectDrop(rows, "b", "t", 0, 16, allow), { depth: 2, parentId: "c", beforeId: "t" }, "between a card and its first block it can only be in the card")
  assert.deepEqual(projectDrop(rows, "b", "s2", 16, 16, allow), { depth: 2, parentId: "c", beforeId: null }, "pulled right, it joins the end of the card")
  assert.deepEqual(projectDrop(rows, "b", "s2", 0, 16, allow), { depth: 1, parentId: "s1", beforeId: null }, "straight, it stays in the section after the card")
  assert.deepEqual(projectDrop(rows, "b", "s2", 48, 16, allow), { depth: 2, parentId: "c", beforeId: null }, "too far right falls back to the nearest legal place")
  assert.equal(projectDrop(rows, "s2", "t", 0, 16, allow), null, "a section can't land inside a card")
  assert.deepEqual(projectDrop(rows, "s2", "s1", 0, 16, allow), { depth: 0, parentId: null, beforeId: "s1" }, "a section moves among sections")
  assert.equal(projectDrop(rows.slice(0, 2), "h", "s1", 0, 16, allow), null, "above the first section is nowhere")
})

test("undo steps: typing in one field is one step, separate actions are separate, redo clears on a new edit", () => {
  const h = new EditHistory<number>()
  h.record(0, "page:x:title", 1000)
  h.record(1, "page:x:title", 1500)
  h.record(2, "page:x:slug", 1600)
  h.record(3, "", 5000)
  h.record(4, "", 5010)
  assert.equal(h.undo(5), 3)
  assert.equal(h.undo(3), 2)
  assert.equal(h.undo(2), 0)
  assert.equal(h.canUndo, false)
  assert.equal(h.redo(0), 2)
  h.record(2, "", 9000)
  assert.equal(h.canRedo, false)
})

test("what counts as one bit of typing", () => {
  const { site } = portal()
  const h = mk("heading", { id: "h1", text: "a" }), t = mk("text", { id: "t1", text: "x" })
  const p = page("home", 0, { sections: [mk("section", { id: "s" }, [h, t])] })
  const withBlock = (id: string, patch: object) => ({ ...p, sections: [{ ...p.sections[0], kids: p.sections[0].kids!.map((b) => (b.id === id ? { ...b, ...patch } : b)) }] })
  const snap = (pg: SitePage, s = site) => ({ site: s, pages: [pg] })
  assert.equal(changeKey(snap(p), snap(withBlock("h1", { text: "ab" }))), "page:home:h1.text")
  assert.equal(changeKey(snap(p), snap(withBlock("h1", { design: { align: "center" } }))), "", "a style pick is its own step")
  assert.equal(changeKey(snap(p), snap({ ...p, title: "New" })), "page:home:title")
  assert.equal(changeKey(snap(p), snap(p, { ...site, font: "serif" })), "site:font")
  assert.equal(changeKey(snap(p), { site, pages: [] }), "", "removing a page is its own step")
})

/* ------------------------------------------- links to the rest of Blackwall */
import { courseWeek, freeSlug, pageFromTask, postAddress, siteAnalyticsConnection, socialDraftFromPost, tasksLinkingTo } from "../shared/site-links.ts"
import { withLink } from "../shared/links.ts"
import type { Asset, Course, Task } from "../src/lib/types.ts"

const task = (id: string, more: Partial<Task> = {}): Task => ({ id, title: id, starred: false, done: false, createdAt: ts, updatedAt: ts, ...more })
const course = { id: "c1", code: "ADD 103", startDate: "2026-09-01" } as Course

test("a task can link to a page or post, seen from both sides, and older tasks still load", () => {
  const { site, pages } = portal()
  const linked = task("a", { recordLinks: withLink(undefined, { kind: "page", id: "p1" }, true) })
  const posted = task("b", { recordLinks: [{ kind: "post", id: "forms" }] })
  const data = { ...emptyWorkspace(), sites: [site], pages, tasks: [linked, posted, task("c")] }
  assert.deepEqual(tasksLinkingTo(data, "page", "p1").map((t) => t.id), ["a"])
  assert.deepEqual(tasksLinkingTo(data, "post", "forms").map((t) => t.id), ["b"])
  assert.ok(validWorkspace(data))
  assert.ok(!validWorkspace({ ...data, tasks: [task("x", { recordLinks: [{ kind: "site" as "page", id: "1" }] })] }), "other kinds are still refused")
  assert.ok(validWorkspace({ ...data, sites: [{ ...site, analyticsConnectionId: "conn1" }] }))
  assert.ok(!validWorkspace({ ...data, sites: [{ ...site, analyticsConnectionId: 4 as unknown as string }] }))
})

test("a page made from a task takes its title, course and week, stays out of the menu, and leaves the task alone", () => {
  const before = task("Essay 2", { due: "2026-09-16", courseId: "c1" })
  const snapshot = structuredClone(before)
  const page = pageFromTask(before, course, "assignment", [{ slug: "essay-2", order: 4 } as SitePage])
  assert.equal(page.title, "Essay 2")
  assert.equal(page.slug, "essay-2-2")
  assert.equal(page.order, 5)
  assert.equal(page.inMenu, false)
  const [heading, line] = page.sections[0].kids!
  assert.equal(heading.text, "Essay 2")
  assert.equal(line.text, "ADD 103 · Week 3 · Due 2026-09-16")
  assert.deepEqual(before, snapshot, "the task isn't changed, and certainly not completed")
  const portalPage = pageFromTask(before, course, "portal", [])
  assert.equal(portalPage.sections[0].kids![1].course, "ADD 103", "a course portal page filters to the task's course")
  assert.equal(courseWeek(course, "2026-09-01"), 1)
  assert.equal(courseWeek({ startDate: undefined }, "2026-09-01"), undefined)
  assert.equal(courseWeek(course, "2026-08-01"), undefined)
  assert.equal(freeSlug("A / B", []), "a-b")
})

test("Share to Social builds a draft from the post: title, summary, cover, address and the picked accounts", () => {
  const { site } = portal()
  const post: Draft = { id: "d", title: "T", slug: "t", kind: "post", status: "ready", excerpt: "Summary", body: "x", siteId: "s1", cover: "/images/a.webp", createdAt: ts, updatedAt: ts }
  const asset = { file: "a.webp", folder: "/Blackwall/assets/" } as Asset
  assert.deepEqual(socialDraftFromPost(post, site, [asset], ["x1"]), { title: "T", body: "Summary", link: "https://bcndlabs.dev/posts/t/", media: "/Blackwall/assets/a.webp", stage: "draft", accountIds: ["x1"], posted: [] })
  assert.equal(postAddress(post, { domain: "" }), undefined, "no domain, no invented address")
  assert.equal(socialDraftFromPost(post, site, [], []).media, "/images/a.webp")
})

test("analytics belong to a site only when mapped: the picked source, or one reporting on its own domain", () => {
  const c = (id: string, provider: string, config: Record<string, string>) => ({ id, provider, config }) as never
  const list = [c("a", "analytics", { siteId: "other.dev" }), c("b", "analytics", { siteId: "https://www.bcndlabs.dev/" }), c("g", "github", { siteId: "bcndlabs.dev" })]
  assert.equal((siteAnalyticsConnection({ domain: "bcndlabs.dev" }, list) as { id: string }).id, "b", "domain match")
  assert.equal((siteAnalyticsConnection({ domain: "bcndlabs.dev", analyticsConnectionId: "a" }, list) as { id: string }).id, "a", "a pick wins")
  assert.equal(siteAnalyticsConnection({ domain: "bcndlabs.dev", analyticsConnectionId: "gone" }, list), undefined, "a removed pick doesn't fall back to a guess")
  assert.equal(siteAnalyticsConnection({ domain: "unknown.dev" }, list), undefined)
  assert.equal(siteAnalyticsConnection({ domain: "" }, list), undefined)
})

test("a section preview is that one section in the site's look, with no menu or footer", () => {
  const { site } = portal()
  const html = renderSectionPreview(site, section("hero"))
  assert.ok(html.includes("--accent:") && html.includes(".section {"), "the site's styles are inside it, not linked")
  assert.ok(!html.includes('<header class="site-header"') && !html.includes('<footer class="site-footer"') && !html.includes('href="/theme.css"'))
  assert.ok(html.includes("<main>"))
})
