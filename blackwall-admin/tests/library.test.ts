import assert from "node:assert/strict"
import { test } from "node:test"
import { auditSite } from "../shared/site-a11y.ts"
import { convertBlock, convertTargets } from "../shared/site-convert.ts"
import { LIBRARY, LIBRARY_GROUPS, placeBlock } from "../shared/site-library.ts"
import { buildSite, mk, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import { findBlock } from "../shared/sitebuilder-tree.ts"
import type { Site, SiteBlock, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function made(key = "simple", over: Partial<Site> = {}) {
  const t = siteFromTemplate("Test site", key)
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}
const draw = (site: Site, pages: SitePage[], sections: SiteBlock[]) => renderPage(site, [pages[0]], { ...pages[0], sections }, {})

test("every library item draws in both modes, and each call makes a fresh block", () => {
  assert.equal(new Set(LIBRARY.map((i) => i.id)).size, LIBRARY.length)
  assert.ok(LIBRARY.every((i) => (LIBRARY_GROUPS as readonly string[]).includes(i.group)))
  assert.ok(LIBRARY.length > 40)
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made("simple", { framework })
    for (const item of LIBRARY) {
      const a = item.make(), b = item.make()
      assert.notEqual(a.id, b.id, item.id)
      const html = draw(site, pages, [item.section ? a : mk("section", {}, [a])])
      assert.ok(html.includes("</main>") && !html.includes("undefined") && !html.includes("[object"), `${item.id} (${framework ?? "plain"})`)
    }
  }
})

test("an added piece lands where it fits: in the selected container, after the selected block, or at the end", () => {
  const h = mk("heading"), t = mk("text"), c1 = mk("card", {}, [mk("heading")]), c2 = mk("card"), row = mk("row", { cols: "2" }, [c1, c2])
  const sec = mk("section", {}, [h, row, t]), sec2 = mk("section", {}, [mk("text")])
  const list = [sec, sec2]
  const quote = mk("quote")
  // into the selected container
  assert.equal(findBlock(placeBlock(list, c2.id, quote), c2.id)!.kids![0].id, quote.id, "a card can hold a quote")
  assert.equal(findBlock(placeBlock(list, sec.id, quote), sec.id)!.kids!.at(-1)!.id, quote.id, "a section takes it at the end")
  // after the selected block when the selection can't hold it
  const afterText = findBlock(placeBlock(list, h.id, quote), sec.id)!.kids!.map((k) => k.id)
  assert.deepEqual(afterText, [h.id, quote.id, row.id, t.id])
  // a card can't go in a card or a row in a row: it lands beside, in the row's parent
  const pic = mk("card")
  assert.deepEqual(findBlock(placeBlock(list, c1.id, pic), row.id)!.kids!.map((k) => k.id), [c1.id, pic.id, c2.id], "after the selected card, inside the row")
  const newRow = mk("row")
  assert.deepEqual(findBlock(placeBlock(list, row.id, newRow), sec.id)!.kids!.map((k) => k.id), [h.id, row.id, newRow.id, t.id], "a row beside a row")
  // nothing selected: the end of the last section
  assert.equal(placeBlock(list, null, quote)[1].kids!.at(-1)!.id, quote.id)
  // a section goes after the section you're in, or last
  const mid = mk("section"), placed = placeBlock(list, c1.id, mid)
  assert.deepEqual(placed.map((s) => s.id), [sec.id, mid.id, sec2.id], "after the section you're in")
  assert.equal(placeBlock(list, null, mk("section")).at(-1)!.type, "section")
  // an empty page gets a section made for it
  const only = placeBlock([], null, quote)
  assert.deepEqual([only.length, only[0].type, only[0].kids![0].id], [1, "section", quote.id])
  assert.equal(list.length, 2, "the original list is untouched")
})

test("a card can become a picture and a picture a card, keeping its picture, words and style", () => {
  const design = { radius: "round" as const }
  const withPic = { ...mk("card", {}, [mk("image", { src: "/images/a.webp", alt: "A fern" }), mk("heading", { level: "3", text: "Ferns" }), mk("text", { text: "Shade lovers." })]), design }
  const toPic = convertBlock(withPic, "image")
  assert.deepEqual([toPic.type, toPic.src, toPic.alt, toPic.id], ["image", "/images/a.webp", "A fern", withPic.id]); assert.deepEqual(toPic.design, design)
  const noPic = convertBlock(mk("card", {}, [mk("heading", { level: "3", text: "Ferns" })]), "image")
  assert.deepEqual([noPic.src, noPic.alt], ["", "Ferns"], "no picture yet: the heading becomes its description, ready to be picked")
  assert.equal(convertBlock(mk("card", {}, [mk("text", { text: "Words" }), mk("button", { text: "Read more", href: "/x/" })]), "image").alt, "", "a button label is never a picture description")
  const back = convertBlock(toPic, "card")
  assert.deepEqual(back.kids!.map((k) => k.type), ["image"]); assert.equal(back.kids![0].src, "/images/a.webp")
  assert.ok(convertTargets(mk("image")).some((t) => t.type === "card") && convertTargets(mk("card")).some((t) => t.type === "image"))
  assert.deepEqual(convertBlock(mk("heading", { text: "Hello" }), "quote").text, "Hello")
  assert.deepEqual(convertBlock(mk("button", { text: "Go", href: "/x/" }), "buttons").items, "Go|/x/\nSecond action|/")
  assert.equal(convertBlock(mk("buttons", { items: "A|/a/\nB|/b/" }), "dropdown").items, "A|/a/\nB|/b/")
})

test("more style options: each is a class, unknown values are ignored, and the CSS is written only when used", () => {
  const { site, pages } = made()
  const plainFiles = buildSite(site, pages, [], [])
  assert.ok(!plainFiles["style.css"].includes(".bs-sz-l") && !plainFiles["style.css"].includes(".bs-bg-soft"), "an unstyled site carries none of it")
  const design = { size: "l", color: "muted", caps: "on", width: "narrow", radius: "pill", shadow: "m", border: "on", pad: "m", bg: "soft", anim: "fade-in" }
  const styled = pages.map((p, i) => (i ? p : { ...p, sections: [mk("section", {}, [{ ...mk("text", { text: "Hi" }), design }, { ...mk("text", { text: "No" }), design: { size: "huge", bg: "neon" } }])] }))
  const files = buildSite(site, styled, [], [])
  const html = files["index.html"]
  for (const c of ["bs-sz-l", "bs-co-muted", "bs-caps-on", "bs-w-narrow", "bs-r-pill", "bs-sh-m", "bd-on", "bs-p-m", "bs-bg-soft", "bs-an-fade-in"]) assert.ok(html.includes(c.replace("bd-on", "bs-bd-on")), c)
  assert.ok(!html.includes("bs-sz-huge") && !html.includes("bs-bg-neon"))
  assert.ok(files["style.css"].includes(".bs-sz-l") && files["style.css"].includes("color-mix"))
  assert.ok(buildSite({ ...site, framework: "bootstrap" }, styled, [], [])["css/style.css"].includes(".bs-bg-inverse"))
  const inverse = pages.map((p, i) => (i ? p : { ...p, sections: [{ ...mk("section"), design: { bg: "inverse" as const } }] }))
  assert.ok(renderPage(site, inverse, inverse[0]).includes("bs-bg-inverse"))
})

test("the new components draw sensibly and the accessibility check sees them", () => {
  const { site, pages } = made()
  const html = draw(site, pages, [mk("section", {}, [mk("quote", { text: "Be kind.", who: "A neighbour" }), mk("buttons", { items: "One|/a/\nTwo|/b/\nThree|/c/" }), mk("stats", { items: "5|Years\n9|Cats" }), mk("breadcrumb")])])
  assert.ok(html.includes("<figcaption>— A neighbour</figcaption>") && html.includes('class="btn" href="/a/">One') && html.split('class="btn btn--outline"').length === 3)
  assert.match(html, /<div class="stat"><dt>Years<\/dt><dd>5<\/dd><\/div>/)
  assert.ok(!html.includes('<ol class="breadcrumb">'), "a page with nothing above it shows no breadcrumb")
  const nested = [{ ...pages[0], id: "a", slug: "", title: "Home" }, { ...pages[1], id: "b", parentId: "a", title: "Guides", slug: "guides" }, { ...pages[2], id: "c", parentId: "b", title: "Tea", slug: "tea", sections: [mk("section", {}, [mk("breadcrumb")])] }]
  const crumbs = renderPage(site, nested, nested[2])
  assert.ok(crumbs.indexOf(">Home</a>") < crumbs.indexOf(">Guides</a>") && crumbs.includes('aria-current="page">Tea</li>'))
  const r = auditSite(site, [{ ...pages[0], sections: [mk("section", {}, [mk("heading", { level: "1", text: "H" }), mk("buttons", { items: "|/a/" })])] }])
  assert.ok(r.items.some((i) => i.rule === "empty-link"))
})
