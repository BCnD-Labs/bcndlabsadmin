import assert from "node:assert/strict"
import { test } from "node:test"
import { ICON_NAMES, ICONS, iconSvg } from "../shared/site-icons.ts"
import { BLOCKS, TONES, buildSite, mk, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import { LIBRARY } from "../shared/site-library.ts"
import type { Site, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-11T00:00:00Z"
function made(over: Partial<Site> = {}) {
  const t = siteFromTemplate("Lab", "simple")
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}

test("every icon has a non-empty 24×24 SVG, and unknown names fall back to a neutral shape instead of crashing", () => {
  assert.ok(ICON_NAMES.length >= 16, "a few dozen icons, not two")
  for (const name of ICON_NAMES) {
    const info = ICONS[name]
    assert.ok(info.name && info.name.length > 0, `${name} has a human name`)
    assert.match(info.svg, /^<svg[^>]*viewBox="0 0 24 24"[^>]*>/, `${name} is a 24x24 SVG`)
    assert.ok(info.svg.endsWith("</svg>"), `${name} is closed`)
    assert.ok(info.svg.includes("currentColor"), `${name} inherits the text colour`)
  }
  assert.ok(iconSvg("probably-not-an-icon").startsWith("<svg"), "unknown name returns a placeholder SVG")
})

test("the Icon block renders with the picked icon, respects its size, and labels itself for screen readers when a label is set", () => {
  const { site, pages } = made()
  const bare = mk("icon", { name: "mail", size: "s" })
  const labelled = mk("icon", { name: "github", size: "l", label: "Visit the repository" })
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [bare, labelled])] }
  const html = renderPage(site, [page], page, {})
  assert.match(html, /ps-icon ps-icon--s[^>]*aria-hidden="true"[^>]*>[\s\S]*?Email icon no/i.exec("x") ? /^$/ : /ps-icon ps-icon--s[^>]*aria-hidden="true"/, "bare icon is decorative")
  assert.ok(html.includes("ps-icon--l"), "large size class")
  assert.ok(html.includes('role="img" aria-label="Visit the repository"'), "labelled icon is announced")
})

test("unknown icon names still build (no crash) and still produce a span the CSS can size", () => {
  const { site, pages } = made()
  const b = mk("icon", { name: "not-real", size: "m" })
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [b])] }
  const html = renderPage(site, [page], page, {})
  assert.ok(html.includes("ps-icon ps-icon--m"), "span is there")
  assert.ok(html.includes("<svg"), "svg is there")
})

test("TONES gained the new colours, and a badge in both frameworks emits a class for each one", () => {
  const extras = ["info", "pink", "purple", "orange"] as const
  const tonesByValue = new Set(TONES.map((t) => t.value))
  for (const v of extras) assert.ok(tonesByValue.has(v), `TONES has ${v}`)
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made({ framework })
    const sects = extras.map((v) => mk("badge", { text: v, tone: v }))
    const page: SitePage = { ...pages[0], sections: [mk("section", {}, sects)] }
    const html = renderPage(site, [page], page, {})
    for (const v of extras) {
      const cls = framework === "bootstrap" ? `text-bg-${v}` : `badge--${v}`
      assert.ok(html.includes(cls), `${v} as ${cls} (${framework ?? "plain"})`)
    }
    const files = buildSite(site, pages, [], [], [], [])
    const css = framework === "bootstrap" ? files["css/style.css"] : files["style.css"]
    for (const v of extras) {
      // The CSS defines a background for the new badge tones in both modes.
      assert.match(css, framework === "bootstrap" ? new RegExp(`text-bg-${v}`) : new RegExp(`badge--${v}`), `CSS defines ${v}`)
    }
  }
})

test("an older-shape site that never heard of the new tones still passes — a badge with no tone keeps rendering as primary", () => {
  const { site, pages } = made()
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [mk("badge", { text: "old" })])] }
  const html = renderPage(site, [page], page, {})
  assert.ok(html.includes("badge--primary"), "default tone kept")
})

test("the Icon block is in the library and comes up through the editor's add path", () => {
  const found = LIBRARY.find((i) => i.id === "icon")
  assert.ok(found, "icon item present")
  assert.equal(found!.group, "Pictures and media")
  assert.equal(found!.size, "s")
  const b = found!.make()
  assert.equal(b.type, "icon")
  assert.ok(ICON_NAMES.includes(String(b.name) as (typeof ICON_NAMES)[number]), "starts on a real icon")
})

test("the Project card library piece is a card with picture, heading, text and two buttons", () => {
  const found = LIBRARY.find((i) => i.id === "project-card")
  assert.ok(found, "present")
  const c = found!.make()
  assert.equal(c.type, "card")
  const kinds = (c.kids ?? []).map((k) => k.type)
  assert.deepEqual(kinds, ["image", "heading", "text", "buttons"])
  const { site, pages } = made()
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [c])] }
  const html = renderPage(site, [page], page, {})
  // Two buttons and a picture on the same card.
  assert.ok((html.match(/btn-row|d-flex flex-wrap gap-2 mb-3/g) ?? []).length >= 1, "a row of buttons is present")
  assert.ok(html.includes("Project name"), "heading in place")
})

test("the whole library still passes its render sweep after Round 2 (icon and project-card draw in both modes)", () => {
  // Sanity: every item still renders without undefined/[object].
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made({ framework })
    for (const item of LIBRARY) {
      const b = item.make()
      const page: SitePage = { ...pages[0], sections: [item.section ? b : mk("section", {}, [b])] }
      const html = renderPage(site, [page], page, {})
      assert.ok(html.includes("</main>") && !html.includes("undefined") && !html.includes("[object"), `${item.id} (${framework ?? "plain"})`)
    }
  }
})

test("the Icon block is registered in BLOCKS so it has an editor field and can be moved around the tree", () => {
  const def = BLOCKS.icon
  assert.ok(def, "BLOCKS.icon")
  assert.equal(def.name, "Icon")
  assert.ok(def.edit && def.edit.some((f) => f.k === "name"), "has a Which icon field")
})
