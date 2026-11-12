import assert from "node:assert/strict"
import { test } from "node:test"
import { EMBED_PROVIDERS, embedOf } from "../shared/site-embed.ts"
import { BLOCKS, buildCustomJs, buildSite, cleanScript, mk, ownBlockJs, renderPage, siteFromTemplate } from "../shared/sitebuilder.ts"
import { LIBRARY } from "../shared/site-library.ts"
import type { Site, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-11T00:00:00Z"
function made(over: Partial<Site> = {}) {
  const t = siteFromTemplate("Lab", "simple")
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}

/* -------- Embed block -------- */

test("embedOf picks the right iframe URL for each supported provider, and rejects everything else", () => {
  const cases: [string, string, RegExp][] = [
    ["YouTube watch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ$/],
    ["youtu.be short", "https://youtu.be/dQw4w9WgXcQ", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ$/],
    ["YouTube shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ", /\/embed\/dQw4w9WgXcQ$/],
    ["Vimeo", "https://vimeo.com/76979871", /player\.vimeo\.com\/video\/76979871$/],
    ["Loom", "https://www.loom.com/share/abcdef1234567890xyz1", /loom\.com\/embed\/abcdef1234567890xyz1$/],
    ["CodePen", "https://codepen.io/user/pen/aBc123", /codepen\.io\/user\/embed\/aBc123\?editors=/],
    ["Calendly", "https://calendly.com/me/30min", /calendly\.com\/me\/30min\?embed_/],
    ["Spotify track", "https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P", /open\.spotify\.com\/embed\/track\/7ouMYWpwJ422jRcDASZB7P$/],
  ]
  for (const [label, url, want] of cases) {
    const r = embedOf(url)
    assert.ok(r, `${label} matched`)
    assert.match(r!.src, want, `${label} iframe URL`)
  }
  assert.equal(embedOf("https://example.com/not-supported"), null)
  assert.equal(embedOf(""), null)
})

test("the Embed block renders an iframe in the right wrapper, or a helpful placeholder when the URL isn't known", () => {
  const { site, pages } = made()
  const good = mk("embed", { url: "https://youtu.be/dQw4w9WgXcQ" })
  const bad = mk("embed", { url: "https://example.com/" })
  const empty = mk("embed", { url: "" })
  const page: SitePage = { ...pages[0], sections: [mk("section", {}, [good, bad, empty])] }
  // Not-in-preview: unknown URL falls back to a plain link, empty URL falls back to nothing.
  const html = renderPage(site, [page], page, {})
  assert.match(html, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"[^>]*loading="lazy"/, "iframe emitted")
  assert.ok(html.includes('aspect-ratio: 16 / 9'), "YouTube keeps 16:9")
  assert.ok(html.includes("example.com"), "bad URL shows as a link on the published page")
  // In preview the editor sees the dashed box.
  const preview = renderPage(site, [page], page, { preview: true })
  assert.ok(preview.includes("embed-empty"), "editor preview shows the empty-state box")
  assert.ok(preview.includes(EMBED_PROVIDERS[0]), "preview lists providers")
})

test("the Embed block is in the component library and the block registry sees it", () => {
  assert.ok(LIBRARY.some((i) => i.id === "embed"), "library entry")
  assert.ok(BLOCKS.embed, "block def")
})

/* -------- User JavaScript -------- */

test("cleanScript strips any </script and clamps the length so no textarea can break the page", () => {
  assert.equal(cleanScript(""), "")
  assert.equal(cleanScript("   "), "")
  assert.equal(cleanScript("alert(1);"), "alert(1);")
  const out = cleanScript("evil</script><script>alert(1)</script>")
  assert.ok(!out.includes("</script>"), "no bare close-script tag survives")
  assert.ok(out.includes("<\\/script>"), "neutered form present")
  assert.ok(cleanScript("a".repeat(20000)).length <= 16384, "clamped")
})

test("buildCustomJs returns empty when nothing is set, and wraps every snippet in its own try/catch", () => {
  const { site, pages } = made()
  assert.equal(buildCustomJs({ ...site, customJs: undefined }, pages), "", "nothing set → nothing to write")
  const withSite = { ...site, customJs: "console.log('hi');" }
  const js = buildCustomJs(withSite, pages)
  assert.match(js, /\/\* Your JavaScript for the whole site \*\//)
  assert.match(js, /try \{ \(function \(\) \{\s*console\.log/)
  assert.match(js, /\}\)\(\); \} catch \(e\)/)
})

test("per-block JS is wired to the block's own class, one snippet per block, in page order", () => {
  const { site, pages } = made()
  const a = mk("heading", { js: "el.textContent = 'rewritten';" })
  const b = mk("text", { js: "el.classList.add('seen');" })
  pages[0].sections = [mk("section", {}, [a, b])]
  const perBlock = ownBlockJs(pages)
  assert.match(perBlock, new RegExp(`\\.x-${a.id.replace(/[^\w-]/g, "")}`))
  assert.match(perBlock, new RegExp(`\\.x-${b.id.replace(/[^\w-]/g, "")}`))
  // Both appear.
  assert.equal((perBlock.match(/querySelectorAll/g) ?? []).length, 2)
})

test("buildSite writes /custom.js only when there's user code, and the HTML links it", () => {
  const { site, pages } = made({ customJs: "" })
  const files = buildSite(site, pages, [], [], [], [])
  assert.ok(!("custom.js" in files), "no custom.js when nothing set")
  for (const [n, h] of Object.entries(files)) if (n.endsWith(".html")) assert.ok(!h.includes("custom.js"), `${n} has no link`)

  const { site: s2, pages: p2 } = made({ customJs: "console.log('x');" })
  const f2 = buildSite(s2, p2, [], [], [], [])
  assert.ok(f2["custom.js"]?.includes("console.log"), "custom.js carries the code")
  for (const [n, h] of Object.entries(f2)) if (n.endsWith(".html")) assert.ok(h.includes("<script src=\"/custom.js\" defer>"), `${n} links custom.js`)
})

test("per-block JS makes the block emit its .x-<id> class (so its own JS and CSS can find it)", () => {
  const { site, pages } = made()
  const b = mk("text", { js: "el.textContent = 'x';" })
  pages[0].sections = [mk("section", {}, [b])]
  const html = renderPage(site, [pages[0]], pages[0], {})
  assert.ok(html.includes(`x-${b.id.replace(/[^\w-]/g, "")}`), "block carries its own class")
})

test("older-shape sites still load and still build with no Round 3 fields set", () => {
  const { site, pages } = made()
  const files = buildSite(site, pages, [], [], [], [])
  for (const [n, h] of Object.entries(files)) {
    if (!n.endsWith(".html")) continue
    assert.ok(!h.includes("custom.js"), `${n}: no link when customJs unset`)
  }
  assert.ok(!files["custom.js"], "no custom.js file")
})

test("the Embed block respects the editor preview state cleanly (no placeholder on the published page unless a bad URL)", () => {
  const { site, pages } = made()
  const b = mk("embed", { url: "" })
  pages[0].sections = [mk("section", {}, [b])]
  const html = renderPage(site, [pages[0]], pages[0], {})
  assert.ok(!html.includes("embed-empty"), "no editor placeholder on the published page")
})
