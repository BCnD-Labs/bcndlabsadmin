import assert from "node:assert/strict"
import { test } from "node:test"
import { flatFile, relativize } from "../shared/site-bootstrap.ts"
import { buildSite, mk, renderPage, siteFromTemplate, youtubeId } from "../shared/sitebuilder.ts"
import { emptyWorkspace, validWorkspace } from "../shared/workspace.ts"
import type { Site, SitePage } from "../src/lib/types.ts"

const ts = "2026-11-01T00:00:00Z"
function made(key: string, over: Partial<Site> = {}) {
  const t = siteFromTemplate("Zombie Guide", key)
  const site: Site = { ...t.site, id: "s1", domain: "", ...over, createdAt: ts, updatedAt: ts }
  const pages: SitePage[] = t.pages.map((p, i) => ({ ...p, id: `p${i}`, siteId: "s1", createdAt: ts, updatedAt: ts }))
  return { site, pages }
}

test("the Tutorial guide template is nine pages in Bootstrap mode with the button, fonts and progress on every step", () => {
  const { site, pages } = made("tutorial")
  assert.equal(pages.length, 9)
  assert.equal(site.framework, "bootstrap")
  assert.equal(site.themeToggle, true)
  const files = buildSite(site, pages, [], [])
  const html = Object.keys(files).filter((f) => f.endsWith(".html"))
  assert.deepEqual(html.sort(), ["contact.html", "gallery.html", "index.html", "overview.html", "step-1.html", "step-2.html", "step-3.html", "step-4.html", "step-5.html"])
  assert.ok(!("theme.css" in files) && !("style.css" in files) && "css/style.css" in files, "one stylesheet, in css/")
  const step = files["step-2.html"]
  assert.ok(step.includes("Step 2 of 5 (40%)") && step.includes('aria-valuenow="40"') && step.includes('class="progress-bar"'))
  assert.ok(step.includes('rel="prev" href="step-1.html"') && step.includes('rel="next" href="step-3.html"'), "previous and next follow the page order, as relative links")
  const bootstrapAt = step.indexOf("bootstrap.min.css"), styleAt = step.indexOf('href="css/style.css"')
  assert.ok(bootstrapAt > 0 && styleAt > bootstrapAt, "Bootstrap loads first, your style.css second")
  assert.ok(step.includes('integrity="sha384-') && step.includes("bootstrap.bundle.min.js"))
  assert.ok(step.includes('<html lang="en">') && step.includes("<header>") && step.includes("<nav") && step.includes('<main id="main">') && step.includes("<footer"))
  assert.equal((step.match(/<h1>/g) ?? []).length, 1, "one h1 per page")
  assert.ok(step.includes("data-theme-toggle") && step.includes('data-bs-toggle="collapse"'), "a theme button and a phone menu button")
  assert.ok(step.includes("fonts.googleapis.com/css2?family=Poppins") && step.includes("family=Inter"))
  assert.ok(files["css/style.css"].includes('--font-heading: "Poppins"') && files["css/style.css"].includes(':root[data-theme="dark"]'))
})

test("a Bootstrap site works from any folder: every link between its files is relative and lands on a file that exists", () => {
  const { site, pages } = made("tutorial")
  const files = buildSite(site, pages, [], [])
  for (const [file, html] of Object.entries(files).filter(([f]) => f.endsWith(".html"))) {
    for (const [, url] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|#)/.test(url)) continue
      assert.ok(!url.startsWith("/"), `${file} has a root link ${url}`)
      assert.ok(url.split(/[?#]/)[0] in files, `${file} links to ${url}, which isn't a file`)
    }
  }
  assert.equal((files["index.html"].match(/<div class="col-12 col-md-4">/g) ?? []).length, 3, "three boxes are three Bootstrap columns")
  assert.ok(files["index.html"].includes('<div class="row g-4 row--3">') && files["index.html"].includes('<article class="card h-100">'))
  assert.ok(files["index.html"].includes('href="overview.html"') && files["index.html"].includes('href="css/style.css"'))
  const sitemap = buildSite({ ...site, domain: "me.github.io/guide" }, pages, [], [])["sitemap.xml"]
  assert.ok(!sitemap.includes("/overview/"), "the sitemap names the files")
})

test("flat files and relative links", () => {
  assert.equal(flatFile("/"), "index.html")
  assert.equal(flatFile("/about/"), "about.html")
  assert.equal(flatFile("/posts/a/"), "posts/a.html")
  assert.equal(flatFile("/images/x.webp"), "images/x.webp")
  assert.equal(relativize('<a href="/about/#x">a</a><img src="/images/x.webp"><a href="//cdn.example/x">c</a><a href="https://e.com/">e</a>', "posts/a.html"), '<a href="../about.html#x">a</a><img src="../images/x.webp"><a href="//cdn.example/x">c</a><a href="https://e.com/">e</a>')
})

test("a site saved before these settings builds exactly the way it did, and still loads", () => {
  const { site, pages } = made("simple")
  assert.equal(site.framework, undefined)
  const files = buildSite(site, pages, [], [])
  assert.ok("theme.css" in files && "style.css" in files && "about/index.html" in files && !("css/style.css" in files))
  assert.ok(files["index.html"].includes('href="/theme.css"') && !files["index.html"].includes("bootstrap"))
  assert.ok(!files["theme.css"].includes("data-theme") && !files["theme.css"].includes("--font-heading"))
  assert.ok(!files["index.html"].includes("data-theme-toggle") && !files["index.html"].includes("fonts.googleapis"))
  const data = { ...emptyWorkspace(), sites: [site], pages }
  assert.ok(validWorkspace(data))
  assert.ok(validWorkspace({ ...data, sites: [{ ...site, framework: "bootstrap", themeToggle: true, fontBody: "Inter" }] }))
  assert.ok(!validWorkspace({ ...data, sites: [{ ...site, framework: "tailwind" as "bootstrap" }] }))
  assert.ok(!validWorkspace({ ...data, sites: [{ ...site, themeToggle: "yes" as unknown as boolean }] }))
})

test("fonts: a family name is checked before it reaches a stylesheet address", () => {
  const { site, pages } = made("simple", { fontHeading: "Playfair Display", fontBody: "Bad;font" })
  const html = buildSite(site, pages, [], [])["index.html"]
  assert.ok(html.includes("family=Playfair+Display"))
  assert.ok(!html.includes("Bad") && !buildSite(site, pages, [], [])["theme.css"].includes("Bad"))
})

test("the light/dark button works in plain sites too, and needs the dark palette", () => {
  const { site, pages } = made("simple", { themeToggle: true })
  const files = buildSite(site, pages, [], [])
  assert.ok(files["index.html"].includes("data-theme-toggle") && files["theme.css"].includes(':root:not([data-theme="light"])'))
  const off = buildSite({ ...site, darkMode: false }, pages, [], [])
  assert.ok(!off["index.html"].includes("data-theme-toggle"), "no dark palette, no button")
})

test("every page has a way past the menu, and the preview shows the page without running anything", () => {
  const { site, pages } = made("simple")
  const html = renderPage(site, pages, pages[0])
  assert.ok(html.includes('class="skip-link" href="#main"') && html.includes('<main id="main">'))
  assert.ok(buildSite(site, pages, [], [])["style.css"].includes(":focus-visible"))
})

test("video: YouTube links in every common shape, a title, and no player in the editor's preview", () => {
  for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=4", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/watch?list=x&v=dQw4w9WgXcQ"]) assert.equal(youtubeId(url), "dQw4w9WgXcQ", url)
  for (const url of ["", "https://example.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short", "javascript:alert(1)", "https://youtu.be/dQw4w9WgXcQ\" onload=\"x"]) assert.equal(youtubeId(url), undefined, url)
  const { site, pages } = made("simple")
  const withVideo = (b: object): SitePage => ({ ...pages[0], sections: [mk("section", {}, [mk("video", b)])] })
  const live = renderPage(site, [pages[0]], withVideo({ url: "https://youtu.be/dQw4w9WgXcQ", title: "How to board a window" }))
  assert.ok(live.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"') && live.includes('title="How to board a window"') && live.includes("allowfullscreen"))
  const preview = renderPage(site, [pages[0]], withVideo({ url: "https://youtu.be/dQw4w9WgXcQ", title: "Boards" }), { preview: true })
  assert.ok(!preview.includes("<iframe") && preview.includes("plays on the published page"))
  assert.ok(renderPage(site, [pages[0]], withVideo({ url: "https://cdn.example.com/song.mp3", title: "Theme" })).includes('<audio controls preload="none" src="https://cdn.example.com/song.mp3" aria-label="Theme">'))
  assert.ok(!renderPage(site, [pages[0]], withVideo({ url: "https://evil.example/x" })).includes("<iframe"))
})

test("the progress bar stays within its steps", () => {
  const { site, pages } = made("simple")
  const bar = (b: object) => renderPage(site, [pages[0]], { ...pages[0], sections: [mk("section", {}, [mk("progress", b)])] })
  assert.ok(bar({ current: 9, total: 5 }).includes("Step 5 of 5 (100%)"))
  assert.ok(bar({ current: -2, total: 4 }).includes("Step 0 of 4 (0%)"))
  assert.ok(bar({ current: "x", total: 0 }).includes("of 1"))
})

test("an animation is a style choice: its keyframes are written only when used, with reduced motion respected", () => {
  const { site, pages } = made("simple")
  const none = buildSite(site, pages, [], [])["style.css"]
  assert.ok(!none.includes("@keyframes"))
  const animated = pages.map((p, i) => (i ? p : { ...p, sections: [mk("section", { design: { anim: "slide-in-bottom" } }), mk("section", { design: { anim: "nope" as "fade-in" } })] }))
  const files = buildSite(site, animated, [], [])
  assert.ok(files["index.html"].includes("bs-an-slide-in-bottom") && !files["index.html"].includes("bs-an-nope"))
  assert.ok(files["style.css"].includes("@keyframes slide-in-bottom") && files["style.css"].includes("prefers-reduced-motion") && !files["style.css"].includes("@keyframes fade-in"))
})

test("forms get Bootstrap's field classes in Bootstrap mode", () => {
  const { site, pages } = made("tutorial")
  const form = { id: "f1", name: "Contact", submitLabel: "Send", successMessage: "Thanks", fields: [{ id: "name", label: "Name", type: "text" as const, required: true }, { id: "msg", label: "Message", type: "textarea" as const, required: true }], createdAt: ts, updatedAt: ts }
  const contact = { ...pages[8], sections: [mk("section", {}, [mk("form", { formId: "f1" })])] }
  const html = buildSite(site, [...pages.slice(0, 8), contact], [], [form])["contact.html"]
  assert.ok(html.includes('<label class="form-label" for=') && html.includes('<input class="form-control"') && html.includes('<textarea class="form-control"') && html.includes('<button class="btn btn-primary" type="submit">'))
  assert.ok(html.includes('name="_hp"') && !/<input class="form-control"[^>]*name="_hp"/.test(html), "the hidden trap field is left alone")
})
