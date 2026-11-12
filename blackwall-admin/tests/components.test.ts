import assert from "node:assert/strict"
import { test } from "node:test"
import { convertBlock, convertTargets, HEADER_KINDS } from "../shared/site-convert.ts"
import { BLOCKS, buildSite, mk, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import type { Site, SiteBlock, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function made(key = "simple", over: Partial<Site> = {}) {
  const t = siteFromTemplate("Test site", key)
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}
const draw = (site: Site, pages: SitePage[], blocks: SiteBlock[], opts: { preview?: boolean } = {}) => renderPage(site, [pages[0]], { ...pages[0], sections: [mk("section", {}, blocks)] }, opts)

test("badge, alert, tooltip, progress bar and accordion draw in both modes, and keep what you type escaped", () => {
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made("simple", { framework })
    const html = draw(site, pages, [mk("badge", { text: "<b>New</b>", tone: "success" }), mk("alert", { text: "Heads <script>x</script>", tone: "danger" }), mk("tooltip", { text: "word", tip: "says \"hi\"" }), mk("meter", { label: "Done", value: 140 }), mk("accordion", { items: "Q one|A one\nQ two|A two" })])
    assert.ok(!html.includes("<script>x") && !html.includes("<b>New"), "hostile text is escaped")
    assert.ok(html.includes(framework ? 'class="badge text-bg-success"' : 'class="badge badge--success"'))
    assert.ok(html.includes(framework ? 'class="alert alert-danger"' : 'class="callout callout--danger"'))
    assert.match(html, /aria-describedby="tip-(\w+)">word<span class="tip__text" role="tooltip" id="tip-\1">says &quot;hi&quot;</)
    assert.ok(html.includes('aria-valuenow="100"') && html.includes("Done (100%)"), "a bar can't pass 100")
    assert.equal((html.match(/<details class="acc">/g) ?? []).length, 2)
  }
})

test("dropdown: Bootstrap's in Bootstrap mode, a plain details element otherwise, unsafe links neutralised, open in the editor preview", () => {
  const items = "Home|/\nElsewhere|https://example.com/\nBad|javascript:alert(1)\nNo link"
  const plain = made("simple"), boot = made("simple", { framework: "bootstrap" })
  const a = draw(plain.site, plain.pages, [mk("dropdown", { label: "Go", items })])
  assert.ok(a.includes('<details class="dd">') && a.includes('<summary class="btn">Go</summary>') && a.includes('href="https://example.com/"'))
  assert.ok(!a.includes("javascript:") && a.includes('href="#">Bad<') && a.includes('href="#">No link<'))
  const b = draw(boot.site, boot.pages, [mk("dropdown", { label: "Go", items, style: "outline" })])
  assert.ok(b.includes('class="btn btn-outline-primary dropdown-toggle"') && b.includes('data-bs-toggle="dropdown"') && b.includes('<ul class="dropdown-menu">') && b.includes('class="dropdown-item"'))
  assert.ok(draw(boot.site, boot.pages, [mk("dropdown", { items })], { preview: true }).includes('class="dropdown-menu show"'), "the preview can't run scripts, so the list is shown open")
})

test("calendar: a real month grid with the right first weekday, marked dates, and nothing from other months", () => {
  const { site, pages } = made()
  const html = draw(site, pages, [mk("calendar", { month: "2026-11", events: "2026-11-20|Report due\n2026-11-20|Quiz\n2026-12-01|Next month\nnot a date|x" })])
  assert.ok(html.includes("<caption>November 2026</caption>") && html.includes('<abbr title="Sunday">Sun</abbr>'))
  assert.equal((html.match(/<tr>/g) ?? []).length, 1 + 5, "a header row and five weeks (Nov 1, 2026 is a Sunday)")
  assert.ok(html.includes('<td><span class="calendar__day">1</span></td>') && html.includes('<span class="calendar__day">30</span>'))
  assert.ok(html.includes('<span class="calendar__day">20</span><span class="calendar__ev">Report due</span><span class="calendar__ev">Quiz</span>'))
  assert.ok(!html.includes("Next month") && !html.includes("not a date"))
  assert.ok(draw(site, pages, [mk("calendar", { month: "2026-02" })]).match(/<tr>/g)!.length === 1 + 4, "February 2026 is exactly four weeks")
  assert.ok(draw(site, pages, [mk("calendar", { month: "nope" })]).includes("Pick a month like 2026-11"))
})

test("a block can be changed to another kind and keeps its words, link, id and style", () => {
  const design = { align: "center" as const }
  const button = { ...mk("button", { text: "Sign up", href: "/join/", style: "outline" }), design }
  const badge = convertBlock(button, "badge")
  assert.equal(badge.type, "badge"); assert.equal(badge.text, "Sign up"); assert.equal(badge.id, button.id); assert.deepEqual(badge.design, design)
  const dd = convertBlock(button, "dropdown")
  assert.equal(dd.label, "Sign up"); assert.ok(String(dd.items).startsWith("Sign up|/join/")); assert.equal(dd.style, "outline")
  assert.equal(convertBlock(dd, "button").href, "/join/", "and back again")
  const card = mk("card", {}, [mk("heading", { level: "3", text: "Water" }), mk("text", { text: "Boil it first." }), mk("button", { text: "More", href: "/water/" })])
  const tip = convertBlock(card, "tooltip")
  assert.deepEqual([tip.type, tip.text, tip.tip, tip.id], ["tooltip", "Water", "Boil it first.", card.id])
  assert.equal(convertBlock(card, "meter").label, "Water")
  assert.equal(convertBlock(card, "alert").text, "Water: Boil it first.")
  assert.equal(convertBlock(card, "accordion").items, "Water|Boil it first.")
  const back = convertBlock(mk("alert", { text: "Read this", tone: "warning" }), "card")
  assert.equal(back.type, "card"); assert.deepEqual(back.kids!.map((k) => k.type), ["heading", "text"]); assert.equal(back.kids![0].text, "Read this")
})

test("only sensible swaps are offered, and anything else changes nothing", () => {
  const button = mk("button", { text: "Go" })
  assert.deepEqual(convertTargets(button).map((t) => t.type), ["link", "badge", "dropdown", "buttons", "tooltip", "calendar", "alert"])
  assert.equal(convertBlock(button, "section"), button)
  assert.equal(convertBlock(button, "button"), button)
  assert.deepEqual(convertTargets(mk("video")), [], "a video has nothing to become")
  assert.ok(convertTargets(mk("card")).some((t) => t.type === "meter" && t.name === "Progress bar"))
  assert.ok(convertTargets(button, "header").every((t) => HEADER_KINDS.includes(t.type)) && !convertTargets(button, "header").some((t) => t.type === "alert"))
  assert.deepEqual(convertTargets(mk("card"), "header").map((t) => t.type), ["tooltip", "badge", "button", "buttons", "dropdown"], "in the header only small pieces fit")
})

test("every offered swap draws a valid page in both modes, from an empty block and a filled one", () => {
  const filled = (type: string): SiteBlock => {
    const b = mk(type)
    return type === "card" ? mk("card", {}, [mk("heading", { text: "Title" }), mk("text", { text: "Body text" })]) : { ...b, ...(["text", "heading", "button", "link", "badge", "alert"].includes(type) ? { text: "Words" } : {}) }
  }
  let swaps = 0
  for (const from of Object.keys(BLOCKS)) for (const empty of [true, false]) {
    const start = empty ? mk(from) : filled(from)
    for (const t of convertTargets(start)) {
      const next = convertBlock(start, t.type)
      assert.equal(next.type, t.type); assert.equal(next.id, start.id)
      for (const framework of [undefined, "bootstrap" as const]) {
        const { site, pages } = made("simple", { framework })
        const html = draw(site, pages, [next])
        assert.ok(html.includes("</main>") && !html.includes("undefined") && !html.includes("[object"), `${from} → ${t.type}`)
      }
      swaps++
    }
  }
  assert.ok(swaps > 80)
})

test("header items sit beside the menu in both modes, are marked in the editor preview, and an older site has none", () => {
  const items = [mk("button", { text: "Join", href: "/join/" }), mk("badge", { text: "Beta" })]
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made("simple", { framework, headerBlocks: items })
    const live = renderPage(site, pages, pages[0])
    assert.ok(live.indexOf("Join") > live.indexOf("<nav") && live.indexOf("Join") < live.indexOf("<main"), "after the menu, before the page")
    assert.ok(live.includes(framework ? 'class="btn btn-primary" href="/join/">Join' : 'class="btn" href="/join/">Join') && live.includes(">Beta<"))
    assert.ok(!live.includes("data-bw="), "a published page carries no editor marks")
    const preview = renderPage(site, pages, pages[0], { preview: true })
    assert.ok(preview.includes(`data-bw="${items[0].id}"`) && preview.includes(`data-bw="${items[1].id}"`))
    assert.ok(!renderPage(site, pages, pages[0], { preview: true, bare: true }).includes("Join"), "a section preview has no header")
  }
  const { site, pages } = made("simple")
  const files = buildSite(site, pages, [], [])
  assert.ok(!files["index.html"].includes("site-extras"))
  const data = { ...emptyWorkspace(), sites: [site], pages }
  assert.ok(validWorkspace(data))
  assert.ok(validWorkspace({ ...data, sites: [{ ...site, headerBlocks: items }] }))
  assert.ok(!validWorkspace({ ...data, sites: [{ ...site, headerBlocks: [{ id: 3 }] as unknown as SiteBlock[] }] }))
  assert.ok(!validWorkspace({ ...data, sites: [{ ...site, headerBlocks: "x" as unknown as SiteBlock[] }] }))
})
