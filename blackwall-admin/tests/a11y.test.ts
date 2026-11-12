import assert from "node:assert/strict"
import { test } from "node:test"
import { auditSite } from "../shared/site-a11y.ts"
import { mk, siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Asset, Draft, Site, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function make(key = "simple", over: Partial<Site> = {}) {
  const t = siteFromTemplate("Guide", key)
  const site: Site = { ...t.site, id: "s1", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}
const only = (pages: SitePage[], sections: ReturnType<typeof mk>[]): SitePage[] => [{ ...pages[0], sections }]
const rules = (r: ReturnType<typeof auditSite>, kind: string) => r.items.filter((i) => i.kind === kind).map((i) => i.rule)

test("a picture with no description is an error that points at its block; a described one is a feature", () => {
  const { site, pages } = make()
  const img = mk("image", { src: "/images/a.webp", alt: "" }), ok = mk("image", { src: "/images/b.webp", alt: "A boarded-up window at dusk" })
  const r = auditSite(site, only(pages, [mk("section", {}, [mk("heading", { level: "1", text: "Home" }), img, ok])]))
  const err = r.items.find((i) => i.rule === "alt-missing")
  assert.equal(err?.kind, "error")
  assert.equal(err?.blockId, img.id)
  assert.equal(err?.pageId, pages[0].id)
  assert.ok(r.items.some((i) => i.kind === "feature" && i.rule === "alt" && i.text.includes("1 picture has")))
  assert.equal(r.counts.error, 1)
})

test("descriptions that are a file name, start with “image of” or run long are alerts, not errors", () => {
  const { site, pages } = make()
  const sec = (alt: string) => auditSite(site, only(pages, [mk("section", {}, [mk("heading", { level: "1", text: "H" }), mk("image", { src: "/images/a.webp", alt })])]))
  assert.deepEqual(rules(sec("IMG_2041.jpg"), "alert").filter((x) => x === "alt-suspicious"), ["alt-suspicious"])
  assert.deepEqual(rules(sec("Image of a cat"), "alert").filter((x) => x === "alt-suspicious"), ["alt-suspicious"])
  assert.ok(rules(sec("x".repeat(130)), "alert").includes("alt-long"))
  assert.ok(!rules(sec("A cat asleep on a radiator"), "alert").some((x) => x.startsWith("alt-")))
  assert.equal(sec("A cat asleep on a radiator").counts.error, 0)
})

test("headings: empty ones, a skipped level and a page that doesn't start with a title", () => {
  const { site, pages } = make()
  const h = (level: string, text: string) => mk("heading", { level, text })
  const skip = auditSite(site, only(pages, [mk("section", {}, [h("1", "Title"), h("3", "Deep")])]))
  assert.ok(rules(skip, "alert").includes("heading-skip"))
  const empty = auditSite(site, only(pages, [mk("section", {}, [h("1", "Title"), h("2", "")])]))
  assert.ok(rules(empty, "error").includes("empty-heading"))
  const noTitle = auditSite(site, only(pages, [mk("section", {}, [h("2", "Starts at two")])]))
  assert.ok(rules(noTitle, "alert").includes("heading-start") && rules(noTitle, "alert").includes("no-h1"))
  const fine = auditSite(site, only(pages, [mk("section", {}, [h("1", "Title"), h("2", "A"), h("3", "B"), h("2", "C")])]))
  assert.ok(!rules(fine, "alert").some((x) => x.startsWith("heading") || x === "no-h1"))
  assert.deepEqual(fine.items.filter((i) => i.kind === "structure").map((i) => i.text), ["h1  Title", "h2  A", "h3  B", "h2  C"], "the outline, as a screen reader hears it")
  // A second “page title” is drawn as an h2, as the page itself does.
  const two = auditSite(site, only(pages, [mk("section", {}, [h("1", "One"), h("1", "Two")])]))
  assert.deepEqual(two.items.filter((i) => i.kind === "structure").map((i) => i.text), ["h1  One", "h2  Two"])
})

test("links: empty text is an error, vague text and the same words going two places are alerts", () => {
  const { site, pages } = make()
  const r = auditSite(site, only(pages, [mk("section", {}, [mk("heading", { level: "1", text: "H" }), mk("button", { text: "", href: "/a/" }), mk("link", { text: "click here", href: "/b/" }), mk("link", { text: "Details", href: "/c/" }), mk("link", { text: "details", href: "/d/" })])]))
  assert.ok(rules(r, "error").includes("empty-link"))
  assert.ok(rules(r, "alert").includes("vague-link") && rules(r, "alert").includes("same-link-text"))
})

test("video and audio need a title, and the check is honest that it can't see captions or custom HTML", () => {
  const { site, pages } = make()
  const r = auditSite(site, only(pages, [mk("section", {}, [mk("heading", { level: "1", text: "H" }), mk("video", { url: "https://youtu.be/dQw4w9WgXcQ", title: "" }), mk("video", { url: "https://x.example/a.mp3", title: "Theme" }), mk("html", { code: "<p>embed</p>" })])]))
  assert.ok(rules(r, "error").includes("media-title"))
  assert.equal(r.items.filter((i) => i.rule === "captions").length, 2)
  assert.ok(rules(r, "alert").includes("custom-html"))
  assert.ok(r.unchecked.some((u) => u.includes("Custom HTML")))
})

test("contrast is checked in light and dark mode and names the colour pair", () => {
  const { site, pages } = make()
  assert.ok(!rules(auditSite(site, pages), "contrast").length, "the built-in themes pass")
  assert.ok(auditSite(site, pages).items.some((i) => i.kind === "feature" && i.rule === "contrast" && i.text.includes("light and dark")))
  const bad = auditSite({ ...site, light: { ...site.light, muted: "#bbbbbb" }, dark: { ...site.dark, accent: "#222222" } }, pages)
  const texts = bad.items.filter((i) => i.kind === "contrast").map((i) => i.text)
  assert.ok(texts.some((t) => t.startsWith("quieter text on the page") && /\(1\.\d to 1/.test(t) || t.includes("quieter text on the page is too faint")))
  assert.ok(texts.some((t) => t.startsWith("Dark mode: links on the page")))
  assert.ok(bad.items.filter((i) => i.kind === "contrast").every((i) => i.area === "look"))
  const lightOnly = auditSite({ ...site, darkMode: false, dark: { ...site.dark, text: "#000000" } }, pages)
  assert.ok(!rules(lightOnly, "contrast").length, "dark colours are ignored when dark mode is off")
})

test("pages with no title or the same title, and posts with undescribed pictures", () => {
  const { site, pages } = make()
  const twins = pages.map((p, i) => (i < 2 ? { ...p, title: "Same" } : p))
  assert.ok(rules(auditSite(site, twins), "alert").includes("duplicate-title"))
  assert.ok(rules(auditSite(site, [{ ...pages[0], title: " " }, ...pages.slice(1)]), "error").includes("page-title"))
  const post = { id: "d1", title: "Hello", slug: "hello", kind: "post", status: "ready", excerpt: "", body: "![](/images/a.webp)\n\n![fine](/images/b.webp)", siteId: "s1", cover: "/images/c.webp", createdAt: ts, updatedAt: ts } as Draft
  const r = auditSite(site, pages, [] as Asset[], [post])
  assert.equal(r.items.filter((i) => i.postId === "d1" && i.kind === "error").length, 2, "one undescribed picture in the text, one cover")
})

test("the light/dark button without dark colours is an alert; with them it is a feature", () => {
  const { site, pages } = make("simple", { themeToggle: true })
  assert.ok(rules(auditSite({ ...site, darkMode: false }, pages), "alert").includes("theme-toggle"))
  assert.ok(auditSite(site, pages).items.some((i) => i.kind === "feature" && i.rule === "theme-toggle"))
})

test("every built-in theme passes contrast in light and dark mode", () => {
  for (const key of ["simple", "portal", "blog", "portfolio", "onepage", "tutorial"]) {
    const { site, pages } = make(key)
    assert.equal(auditSite(site, pages).counts.contrast, 0, key)
  }
})

test("the Tutorial guide template, once its placeholder headings are written, passes with no errors", () => {
  const { site, pages: raw } = make("tutorial")
  const fill = (list: ReturnType<typeof mk>[]): ReturnType<typeof mk>[] => list.map((b) => ({ ...b, ...(b.type === "heading" && !String(b.text ?? "").trim() ? { text: "Written" } : {}), ...(b.kids ? { kids: fill(b.kids) } : {}) }))
  const pages = raw.map((p) => ({ ...p, sections: fill(p.sections) }))
  const r = auditSite(site, pages)
  assert.equal(r.counts.error, 0, JSON.stringify(r.items.filter((i) => i.kind === "error")))
  assert.equal(r.counts.contrast, 0)
})

test("the newer components are checked too: a dropdown needs a label and options, a tooltip needs words", () => {
  const { site, pages } = make()
  const r = auditSite(site, only(pages, [mk("section", {}, [mk("heading", { level: "1", text: "H" }), mk("dropdown", { label: "", items: "" }), mk("tooltip", { text: "word", tip: "" }), mk("calendar", { month: "2026-11" })])]))
  assert.ok(rules(r, "error").includes("empty-link"))
  assert.ok(rules(r, "alert").includes("empty-menu") && rules(r, "alert").includes("empty-tooltip"))
  assert.ok(r.items.some((i) => i.kind === "feature" && i.rule === "table-header"))
})
