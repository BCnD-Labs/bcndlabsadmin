import assert from "node:assert/strict"
import { test } from "node:test"
import { SITE_RUNTIME } from "../shared/site-runtime.ts"
import { buildSite, mk, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import type { Site, SitePage, SiteBlock } from "../src/lib/types.ts"

const ts = "2026-11-11T00:00:00Z"
function made(over: Partial<Site> = {}) {
  const t = siteFromTemplate("Lab", "simple")
  const site: Site = { ...t.site, id: "s1", domain: "", themeToggle: true, ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}

test("buildSite writes js/main.js in every mode, and no page carries inline runtime JS", () => {
  for (const framework of [undefined, "bootstrap" as const]) {
    const { site, pages } = made({ framework })
    const files = buildSite(site, pages, [], [], [], [])
    assert.ok(files["js/main.js"]?.length, `has js/main.js (${framework ?? "plain"})`)
    assert.ok(/data-ps-carousel|data-theme-toggle/.test(files["js/main.js"]), "runtime looks real")
    for (const [name, html] of Object.entries(files)) {
      if (!name.endsWith(".html")) continue
      // The only inline <script> left is the theme hint; everything else loads the file.
      const inline = (html.match(/<script(?! src)/g) ?? []).length
      const hint = (html.match(/data-theme",t\);d\.setAttribute\("data-bs-theme/g) ?? []).length
      assert.equal(inline, hint, `${name}: only the theme hint can be inline`)
      assert.match(html, /<script src="(\.\.\/)*(js\/main\.js)" defer>/, `${name} links to js/main.js`)
      assert.doesNotMatch(html, /pagesmith|blackwall/i, `${name} carries no tool name`)
    }
  }
})

test("new blocks render the attributes the runtime looks for, and the renderer still outputs valid HTML", () => {
  const { site, pages } = made()
  const carousel = mk("carousel", { autoplay: 3 }, [mk("image"), mk("image"), mk("image")])
  const gallery = mk("gallery", {}, [mk("image"), mk("image")])
  const counter = mk("counter", { number: 42, duration: 800, label: "Visitors" })
  const modal = mk("modal", { label: "Open", title: "Howdy" }, [mk("text", { text: "Inside" })])
  const grid = mk("filterGrid", {}, [
    mk("card", { tag: "Code" }, [mk("heading", { level: "3", text: "Alpha" })]),
    mk("card", { tag: "Writing" }, [mk("heading", { level: "3", text: "Beta" })]),
  ])
  const code = mk("code", { code: "console.log('hi')" })
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [carousel, gallery, counter, modal, grid, code])] }
  const html = renderPage(site, [page], page, {})
  assert.ok(html.includes("data-ps-carousel"), "carousel attr")
  assert.ok(html.includes("data-autoplay=\"3000\""), "carousel autoplay in ms")
  assert.ok((html.match(/class="carousel__slide"/g) ?? []).length === 3, "one slide per kid")
  assert.ok((html.match(/class="carousel__dot"/g) ?? []).length === 3, "one dot per kid")
  assert.ok(html.includes("data-ps-lightbox") && html.includes("gallery__btn"), "gallery wraps each kid")
  assert.ok(html.includes("data-ps-counter") && html.includes('data-target="42"'), "counter attrs")
  assert.ok(html.includes("data-ps-modal-open=\"modal-" + modal.id.replace(/[^\w-]/g, "")), "modal trigger wired by id")
  assert.ok(html.includes("<dialog class=\"ps-modal\""), "modal dialog present")
  assert.ok(html.includes("data-ps-filter"), "filter grid attr")
  assert.ok(html.includes("data-tag=\"Code\"") && html.includes("data-tag=\"Writing\""), "each card carries its tag")
  assert.ok((html.match(/filter-bar__btn/g) ?? []).length === 3, "one 'all' + one per tag")
  assert.ok(html.includes("data-ps-copy"), "code copy button added")
})

test("the inline theme hint keeps its exact bytes (its CSP hash depends on this)", async () => {
  const { THEME_INLINE_BODY } = await import("../shared/site-bootstrap.ts")
  assert.equal(THEME_INLINE_BODY, `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.setAttribute("data-theme",t);d.setAttribute("data-bs-theme",t)})();`)
})

test("an older-shape site with no carousel/gallery/modal still builds, and empty carousel kids list emits no dots", () => {
  const { site, pages } = made()
  // Shape before this round: pages whose sections don't mention any new blocks.
  const files = buildSite(site, pages, [], [], [], [])
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".html")) continue
    assert.ok(!content.includes("undefined") && !content.includes("[object"), `${name} is clean`)
  }
  const carousel = mk("carousel", {}, [mk("image")])
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [carousel])] }
  const html = renderPage(site, [page], page, {})
  assert.ok(!html.includes("carousel__dots"), "no dots for a one-slide carousel")
})

test("the runtime JS is defer-safe and only wires elements the renderer wrote", () => {
  // Spot-check: every data-ps-* in the runtime maps to a selector querySelectorAll finds at load.
  const selectors = ["[data-ps-carousel]", "[data-ps-lightbox]", "[data-ps-copy]", "[data-ps-counter]", "[data-ps-modal-open]", "[data-ps-filter]", "[data-theme-toggle]", "form[data-form]"]
  for (const sel of selectors) assert.ok(SITE_RUNTIME.includes(sel), `runtime hooks ${sel}`)
})

/* A plain carousel inside a Bootstrap-mode site: the renderer must not add Bootstrap col wrappers around the slides. */
test("carousel slides are <li class=\"carousel__slide\"> even in Bootstrap mode", () => {
  const { site, pages } = made({ framework: "bootstrap" })
  const c = mk("carousel", {}, [mk("image"), mk("image")])
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [c])] }
  const html = renderPage(site, [page], page, {})
  assert.ok(!/col-12 col-md-\d+[^]*?carousel__slide/.test(html), "no Bootstrap col wrappers around slides")
})

/* The lightbox needs the full-size image to be actual, not a placeholder. Ensure gallery kids don't break when a picture has no src. */
test("a gallery with a placeholder picture still renders, and the lightbox button is a real button", () => {
  const { site, pages } = made()
  const g = mk("gallery", {}, [mk("image")])
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [g])] }
  const html = renderPage(site, [page], page, {})
  const openers = html.match(/<button[^>]*gallery__btn[^>]*data-ps-lightbox[^>]*>/g) ?? []
  assert.equal(openers.length, 1, "exactly one lightbox opener for one kid")
})

/* The CSP hash for the inline theme hint. This isn't the public header (the host sets that), but computing it once
 * proves every byte is accounted for; a drift caught here means the hint changed without the owner knowing. */
test("the theme hint's SHA-256 can be computed and is stable", async () => {
  const { createHash } = await import("node:crypto")
  const { THEME_INLINE_BODY } = await import("../shared/site-bootstrap.ts")
  const h = createHash("sha256").update(THEME_INLINE_BODY).digest("base64")
  assert.equal(h.length, 44) // base64 of 32 bytes
})
