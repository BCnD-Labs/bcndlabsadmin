import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSite, freeSpans, mk, renderPage, rowSpans, siteFromTemplate } from "../shared/sitebuilder.ts"
import { findBlock, freezeAround, freezeRow, nudgeBlock, nudgeKeepingWidths, siblingsIn, swapBlocks } from "../shared/sitebuilder-tree.ts"
import type { Site, SiteBlock, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function made(over: Partial<Site> = {}) {
  const t = siteFromTemplate("Test site", "simple")
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}
const draw = (site: Site, pages: SitePage[], sections: SiteBlock[]) => renderPage(site, [pages[0]], { ...pages[0], sections }, {})
/** The wide card and the narrow card of a "Main and side" row, as in a template. */
function mainSide() {
  const wide = mk("card", {}, [mk("heading", { text: "Wide" })]), narrow = mk("card", {}, [mk("heading", { text: "Narrow" })])
  const row = mk("row", { cols: "side" }, [wide, narrow])
  const sec = mk("section", {}, [row])
  return { wide, narrow, row, sec, list: [sec] }
}
const order = (list: SiteBlock[], rowId: string) => findBlock(list, rowId)!.kids!.map((k) => `${k.id}:${k.design?.span ?? "-"}`)

test("a block's width stays with it: moving the wide card right keeps it wide, and the narrow card goes left, still narrow", () => {
  const { wide, narrow, row, list } = mainSide()
  const moved = nudgeBlock(freezeAround(list, wide.id), wide.id, 1)
  assert.deepEqual(order(moved, row.id), [`${narrow.id}:4`, `${wide.id}:8`])
  const { site, pages } = made()
  const html = draw(site, pages, moved)
  assert.ok(html.indexOf("Narrow") < html.indexOf("Wide"), "narrow first")
  assert.ok(html.includes("row--free") && html.indexOf("bs-span-4") < html.indexOf("bs-span-8"))
  const boot = draw(made({ framework: "bootstrap" }).site, pages, moved)
  assert.ok(boot.indexOf('col-12 col-md-4"') < boot.indexOf('col-12 col-md-8"'), "Bootstrap columns follow the blocks too")
  const plain = buildSite(site, pages.map((p, i) => (i ? p : { ...p, sections: moved })), [], [])["style.css"]
  assert.ok(plain.includes(".row--free > .bs-span-8, .row--free > [data-bw] > .bs-span-8 { grid-column: span 8; }") && plain.includes("repeat(12, 1fr)"), "the editor preview wraps each block in a helper element, so the rule has to reach through it")
})

test("without freezing, the old position-bound split would hand the width to the other card (why freezing is needed)", () => {
  const { wide, row, list } = mainSide()
  const naive = nudgeBlock(list, wide.id, 1)
  assert.deepEqual(rowSpans(findBlock(naive, row.id)!), [8, 4], "the first slot is still the wide one")
  assert.equal(findBlock(naive, row.id)!.kids![0].id !== wide.id, true)
})

test("any two blocks in the same place can be swapped, and nothing else can", () => {
  const a = mk("heading"), b = mk("text"), c = mk("button")
  const card = mk("card", {}, [a, b, c]), other = mk("card", {}, [mk("text")])
  const sec1 = mk("section", {}, [card, other]), sec2 = mk("section")
  const list = [sec1, sec2]
  assert.deepEqual(findBlock(swapBlocks(list, a.id, c.id), card.id)!.kids!.map((k) => k.id), [c.id, b.id, a.id], "first and last")
  assert.deepEqual(swapBlocks(list, card.id, other.id)[0].kids!.map((k) => k.id), [other.id, card.id], "two cards")
  assert.deepEqual(swapBlocks(list, sec1.id, sec2.id).map((s) => s.id), [sec2.id, sec1.id], "two sections")
  assert.equal(swapBlocks(list, a.id, other.id), list, "not in the same container: unchanged")
  assert.equal(swapBlocks(list, a.id, a.id), list)
  assert.deepEqual(siblingsIn(list, b.id)!.sibs.map((x) => x.id), [a.id, b.id, c.id])
  assert.equal(list[0].kids![0].kids![0].id, a.id, "the original isn't changed")
})

test("freezing writes a ready-made split onto the blocks, and does nothing to a row that already has widths", () => {
  const { row, list } = mainSide()
  const f = freezeRow(list, row.id)
  assert.deepEqual(findBlock(f, row.id)!.kids!.map((k) => k.design?.span), [8, 4])
  assert.equal(freezeRow(f, row.id), f)
  assert.equal(freezeRow(list, list[0].id), list, "not a row")
  const four = mk("row", { cols: "4" }, [mk("card"), mk("card"), mk("card"), mk("card"), mk("card")])
  assert.deepEqual(findBlock(freezeRow([four], four.id), four.id)!.kids!.map((k) => k.design?.span), [3, 3, 3, 3, 3], "extra blocks wrap with the same widths")
})

test("widths: a block's own, or its share of what is left; ready-made splits render exactly as before", () => {
  const w = (n?: number) => ({ ...mk("card"), ...(n ? { design: { span: n } } : {}) })
  assert.deepEqual(freeSpans([w(6), w(), w()]), [6, 3, 3])
  assert.deepEqual(freeSpans([w(8), w()]), [8, 4])
  assert.deepEqual(freeSpans([w(), w()]), [6, 6])
  assert.deepEqual(freeSpans([w(11), w()]), [11, 12], "not enough room left: it takes its own line")
  const { site, pages } = made()
  const old = draw(site, pages, [mk("section", {}, [mk("row", { cols: "side" }, [mk("card"), mk("card")])])])
  assert.ok(old.includes('class="row row--side"') && !old.includes("row--free") && !old.includes("bs-span"))
  const oldBoot = draw(made({ framework: "bootstrap" }).site, pages, [mk("section", {}, [mk("row", { cols: "side" }, [mk("card"), mk("card")])])])
  assert.ok(oldBoot.includes('col-md-8"') && oldBoot.includes('col-md-4"') && oldBoot.includes("row g-4 row--side"))
})

test("new splits, spacing and alignment of a row, in both modes", () => {
  const { site, pages } = made(), boot = made({ framework: "bootstrap" })
  const row = (props: object) => [mk("section", {}, [mk("row", props, [mk("card"), mk("card")])])]
  assert.ok(draw(boot.site, boot.pages, row({ cols: "left" })).match(/col-md-4"[\s\S]*col-md-8"/))
  assert.ok(draw(site, pages, row({ cols: "left", gap: "l", valign: "middle" })).includes('class="row row--left row--gap-l row--middle"'))
  assert.ok(draw(boot.site, boot.pages, row({ cols: "2", gap: "s", valign: "top" })).includes("row g-2 align-items-start row--2"))
  assert.ok(draw(site, pages, row({ cols: "bogus" })).includes("row--3"), "an unknown split falls back")
  assert.ok(buildSite(site, pages.map((p, i) => (i ? p : { ...p, sections: row({ cols: "4" }) })), [], [])["style.css"].includes(".row--left { grid-template-columns: 1fr 2fr; }"))
})

test("block width, height and where it shows: classes, and the CSS that makes them work for sections too", () => {
  const { site, pages } = made()
  const design = { width: "wide", minh: "screen", show: "phone", span: 5 }
  const sections = [{ ...mk("section", {}, [{ ...mk("text", { text: "x" }), design: { show: "desktop" as const, width: "full" as const } }]), design }]
  const files = buildSite(site, pages.map((p, i) => (i ? p : { ...p, sections })), [], [])
  const html = files["index.html"]
  for (const c of ["bs-w-wide", "bs-mh-screen", "bs-on-phone", "bs-span-5", "bs-on-desktop", "bs-w-full"]) assert.ok(html.includes(c), c)
  const css = files["style.css"]
  assert.ok(css.includes(".section.bs-w-narrow > .container") && css.includes(".section[class*=\"bs-mh-\"]") && css.includes("(max-width: 699px) { .bs-on-desktop"))
  assert.ok(!draw(site, pages, [{ ...mk("section"), design: { minh: "huge" as "s", show: "tv" as "phone" } }]).includes("bs-mh-huge"))
})

test("in the editor preview a block's width class sits one helper element down, and the rule reaches it", () => {
  const { wide, narrow, row, list } = mainSide()
  const moved = nudgeKeepingWidths(list, wide.id, 1)
  const { site, pages } = made()
  const html = renderPage(site, [pages[0]], { ...pages[0], sections: moved }, { preview: true })
  assert.match(html, /<div class="row row--side row--free">\s*<div data-bw="[^"]+" data-bw-t="card" style="display:contents">\s*<article class="bs-span-4 card">/, "the narrow card first, with its own width")
  assert.ok(html.includes("bs-span-8") && html.indexOf(`data-bw="${narrow.id}"`) < html.indexOf(`data-bw="${wide.id}"`))
  assert.equal(findBlock(moved, row.id)!.kids!.length, 2)
})
