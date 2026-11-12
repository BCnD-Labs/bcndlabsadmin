import assert from "node:assert/strict"
import { test } from "node:test"
import { auditSite } from "../shared/site-a11y.ts"
import { convertBlock, convertTargets } from "../shared/site-convert.ts"
import { LIBRARY } from "../shared/site-library.ts"
import { blockClass, buildSite, cleanAnchor, cleanClasses, cleanDeclarations, mk, ownBlockCss, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Site, SiteBlock, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function made(over: Partial<Site> = {}) {
  const t = siteFromTemplate("Test site", "simple")
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}
const withBlocks = (pages: SitePage[], blocks: SiteBlock[]) => pages.map((p, i) => (i ? p : { ...p, sections: [mk("section", {}, blocks)] }))

test("an anchor, class names and block CSS are cleaned before they reach a page", () => {
  assert.equal(cleanAnchor(" My Pricing! "), "my-pricing"); assert.equal(cleanAnchor("2024 plans"), "s-2024-plans"); assert.equal(cleanAnchor("  "), ""); assert.equal(cleanAnchor('x" onload="y'), "x-onload-y")
  assert.equal(cleanClasses("hero big-card  9bad <script> ok_1"), "hero big-card ok_1")
  assert.equal(cleanClasses("a b c d e f g h i j").split(" ").length, 8)
  const hostile = cleanDeclarations("color: red; } body { display:none } </style><script>x</script>")
  assert.ok(!/[{}<>]/.test(hostile) && hostile.startsWith("color: red;") && hostile.includes("display:none"), "the braces and tags are gone")
  assert.ok(!/[{}<>\\]/.test(cleanDeclarations("a{b}<c>\\d")) && !cleanDeclarations("@import url(x.css); color: red").includes("@import"))
  assert.equal(cleanDeclarations("x".repeat(5000)).length, 2000)
})

test("an id and class names go on the block, and its own CSS becomes one rule with its own class", () => {
  const { site, pages } = made()
  const text = { ...mk("text", { text: "Hi" }), anchor: "Intro Text", classes: "lead big", css: "color: tomato; letter-spacing: .1em;" }
  const card = { ...mk("card", {}, [mk("heading", { text: "T" })]), anchor: "pricing" }
  const plain = withBlocks(pages, [text, card, mk("text", { text: "Plain" })])
  const html = renderPage(site, plain, plain[0])
  assert.ok(html.includes(`<div id="intro-text" class="bs lead big ${blockClass(text)}">`), "a leaf block gets a wrapper carrying them")
  assert.ok(html.includes('<article id="pricing" class="card">'), "a container carries them itself")
  assert.equal((html.match(/class="bs"/g) ?? []).length, 0, "a block with none of this has no extra wrapper")
  assert.ok(html.includes("<p>Plain</p>") && !html.includes("<div class=\"bs\"><p>Plain"))
  const css = buildSite(site, plain, [], [])["style.css"]
  assert.ok(css.includes(`.${blockClass(text)} { color: tomato; letter-spacing: .1em; }`))
  const boot = buildSite({ ...site, framework: "bootstrap" }, plain, [], [])["css/style.css"]
  assert.ok(boot.includes(`.${blockClass(text)} { color: tomato; letter-spacing: .1em; }`), "in Bootstrap mode too, after Bootstrap")
  assert.ok(renderPage(site, plain, plain[0], { preview: true }).includes(`.${blockClass(text)} { color: tomato;`), "and live in the editor's preview")
})

test("hostile CSS can't leave its rule or close the page's style tag", () => {
  const { site, pages } = made()
  const evil = { ...mk("text"), css: "color: red; } </style><script>alert(1)</script><style> a { x: y" }
  const doc = withBlocks(pages, [evil])
  const preview = renderPage(site, doc, doc[0], { preview: true })
  assert.equal((preview.match(/<\/style>/g) ?? []).length, 1, "only the page's own closing tag")
  assert.ok(!preview.includes("<script>alert"), "no script got in")
  const rule = ownBlockCss(doc).split("\n").find((l) => l.startsWith("."))!
  assert.equal((rule.match(/\{/g) ?? []).length, 1); assert.equal((rule.match(/\}/g) ?? []).length, 1)
})

test("header blocks can have their own CSS too, and two blocks with one anchor are flagged", () => {
  const { site, pages } = made()
  const btn = { ...mk("button", { text: "Join" }), css: "border-radius: 99px" }
  assert.ok(buildSite({ ...site, headerBlocks: [btn] }, pages, [], [])["style.css"].includes(`.${blockClass(btn)} { border-radius: 99px }`))
  const a = { ...mk("text", { text: "a" }), anchor: "same" }, b = { ...mk("text", { text: "b" }), anchor: "Same" }
  const r = auditSite(site, [{ ...pages[0], sections: [mk("section", {}, [mk("heading", { level: "1", text: "H" }), a, b])] }])
  assert.ok(r.items.some((i) => i.rule === "duplicate-id" && i.blockId === b.id))
})

test("the new components draw sensibly and keep what you type escaped", () => {
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made({ framework })
    const doc = withBlocks(pages, [mk("spacer", { size: "xl" }), mk("spacer", { size: "nope" }), mk("code", { label: "<b>x</b>", code: "if (a < b) { run() }\n<script>x</script>" }), mk("steps", { items: "One|first\nTwo|second\nThree" }), mk("tags", { items: "a, b,, <i>c</i>" }), mk("iconbox", { icon: "🌱", title: "Grow <3", text: "Slowly" })])
    const html = renderPage(site, doc, doc[0])
    assert.ok(html.includes('class="spacer spacer--xl" aria-hidden="true"') && html.includes("spacer--m"), "an unknown size falls back")
    assert.ok(html.includes('<pre tabindex="0"><code>if (a &lt; b) { run() }') && !html.includes("<script>x") && !html.includes("<b>x</b>"))
    assert.equal((html.match(/<li><b>/g) ?? []).length, 3); assert.ok(html.includes("<li><b>Three</b></li>"))
    assert.equal((html.match(/class="badge (badge--|text-bg-)secondary"/g) ?? []).length, 3, "a blank tag is skipped")
    assert.ok(html.includes("&lt;i&gt;c&lt;/i&gt;") && html.includes('aria-hidden="true">🌱<') && html.includes("Grow &lt;3"))
  }
  const css = buildSite(made().site, made().pages, [], [])["style.css"]
  for (const c of [".spacer--xl", ".codeblock pre", "counter-increment: step", ".tags", ".iconbox__icon"]) assert.ok(css.includes(c), c)
})

test("the library gained the new items, small things are marked small, and every item still draws", () => {
  const ids = LIBRARY.map((i) => i.id)
  for (const id of ["spacer", "code", "steps", "tags", "iconbox", "team", "caption", "features", "contact-card"]) assert.ok(ids.includes(id), id)
  assert.ok(LIBRARY.find((i) => i.id === "badge")!.size === "s" && LIBRARY.find((i) => i.id === "button")!.size === "s" && !LIBRARY.find((i) => i.id === "pictureCard")!.size)
  assert.ok(LIBRARY.filter((i) => i.section).every((i) => !i.size))
  const { site, pages } = made()
  for (const item of LIBRARY.filter((i) => ["team", "caption", "features", "contact-card"].includes(i.id))) {
    const doc = withBlocks(pages, [item.make()])
    assert.ok(!renderPage(site, doc, doc[0]).includes("undefined"), item.id)
  }
})

test("swaps among lists, steps, tags, accordions and code keep their words", () => {
  const list = mk("list", { items: "Milk\nEggs\nTea" })
  assert.equal(convertBlock(list, "steps").items, "Milk|\nEggs|\nTea|")
  assert.equal(convertBlock(list, "tags").items, "Milk, Eggs, Tea")
  assert.equal(convertBlock(convertBlock(list, "steps"), "list").items, "Milk: \nEggs: \nTea: ".replace(/: /g, ""), "steps back to a list")
  const acc = mk("accordion", { items: "Q one|A one\nQ two|A two" })
  assert.equal(convertBlock(acc, "list").items, "Q one: A one\nQ two: A two", "an accordion becomes a filled list, not an empty one")
  assert.equal(convertBlock(mk("tags", { items: "x, y" }), "list").items, "x\ny")
  assert.equal(convertBlock(mk("text", { text: "run()" }), "code").code, "run()")
  assert.ok(convertTargets(mk("list")).some((t) => t.type === "steps"))
})
