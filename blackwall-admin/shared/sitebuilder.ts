/**
 * The CMS site builder: Pagesmith's block model (sections, rows, cards and content blocks,
 * section presets, site templates and palettes), ported to TypeScript and extended with
 * posts, a course portal ("Posts by week"), real images and links, and reusable forms.
 *
 * Pure functions, no DOM: the browser uses it for the live preview, the server for
 * publishing, so what you preview is exactly what gets committed.
 */
import { renderMarkdown } from "./site.ts"
import { STARTERS } from "./site-starters.ts"
import type { InboxItem } from "./site-inbox.ts"
import { findAsset, imagePathsInPost } from "./assets.ts"
import type { Asset, Draft, Site, SiteBlock, SiteForm, SitePage } from "../src/lib/types.ts"
import { ANIMATIONS, BOOTSTRAP, previewAssets, BOOTSTRAP_BRIDGE, COMPONENT_CSS, REDUCED_MOTION_CSS, THEME_SCRIPT, THEME_TOGGLE_SCRIPT, fontName, flatFile, googleFontsHref, isBootstrap, relativize } from "./site-bootstrap.ts"

/* ------------------------------------------------------------------ colours */

function clean(h: string) {
  let n = String(h || "").trim().replace(/^#/, "")
  if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2]
  return /^[0-9a-f]{6}$/i.test(n) ? `#${n.toLowerCase()}` : null
}
function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt((clean(hex) ?? "#000000").substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrast = (a: string, b: string) => {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** Button text on the accent colour: whichever of near-black and white reads better on it. */
export const onAccent = (a: string) => (contrast(a, "#111111") >= contrast(a, "#ffffff") ? "#111111" : "#ffffff")

export const SWATCH_KEYS = ["bg", "surface", "text", "muted", "border", "accent"] as const
export const SWATCH_INFO: Record<(typeof SWATCH_KEYS)[number], { l: string; d: string }> = {
  bg: { l: "Page", d: "Behind everything" },
  surface: { l: "Boxes", d: "Cards and shaded strips" },
  text: { l: "Text", d: "Headings and paragraphs" },
  muted: { l: "Faint", d: "Captions, footer" },
  border: { l: "Lines", d: "Borders and rules" },
  accent: { l: "Accent", d: "Links and buttons" },
}

export { STARTERS } from "./site-starters.ts"

/** The look beyond colours: type, corners and page width. Each is one CSS variable in theme.css. */
export const FONTS = {
  sans: { name: "Clean", about: "Modern sans-serif", css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  serif: { name: "Classic", about: "Book-style serif", css: 'Georgia, "Times New Roman", serif' },
  rounded: { name: "Friendly", about: "Soft, rounded letters", css: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif' },
  mono: { name: "Typewriter", about: "Code-style monospace", css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
} as const
export const CORNERS = { sharp: { name: "Sharp", px: 0 }, soft: { name: "Soft", px: 8 }, round: { name: "Round", px: 18 } } as const
export const WIDTHS = { narrow: { name: "Narrow", px: 880 }, normal: { name: "Normal", px: 1100 }, wide: { name: "Wide", px: 1320 } } as const

/* ------------------------------------------------------------------- blocks */

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const txt = (v: unknown, fb: string) => esc(String(v ?? "").trim() || fb)
const str = (v: unknown) => (typeof v === "string" ? v : "")
/** Only http(s), mailto, tel, site paths and #anchors make it into an href. */
export const safeHref = (v: unknown) => {
  const s = str(v).trim()
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s) ? s : "#"
}

export interface BuildCtx {
  site: Site
  pages: SitePage[]
  /** Published posts of this site (drafts excluded unless previewing). */
  posts: Draft[]
  forms: SiteForm[]
  /** The page being rendered (for aria-current) and where blocks sit. */
  current?: string
  where: "header" | "page" | "footer"
  h1: boolean
  /** Bootstrap mode: blocks draw Bootstrap 5 markup. */
  boot: boolean
  preview: boolean
  /** The asset library: gives pictures their size in the published markup. */
  assets: Asset[]
  /** Previews only: where to load each library picture from (site path → a URL the editor can show). */
  assetUrls: Record<string, string>
}

/** A picture's address (in a preview, the library's own copy) and its width and height attributes when it is a library picture. */
function pic(ctx: Pick<BuildCtx, "assets" | "assetUrls" | "preview">, src: string) {
  const a = findAsset(ctx.assets, src)
  return { src: (ctx.preview && ctx.assetUrls[src]) || src, size: a ? ` width="${a.width}" height="${a.height}"` : "" }
}

/** What a block's editor shows: the field key, its label, and the kind of input. */
export interface BlockField { k: string; l: string; kind?: "text" | "big" | "select" | "number" | "form" | "url" | "asset"; note?: string; options?: { value: string; label: string }[] }

export interface BlockDef {
  name: string
  container?: boolean
  inset?: number
  def: Record<string, unknown>
  edit?: BlockField[]
  open?: (b: SiteBlock, ctx: BuildCtx) => string[]
  close?: (b: SiteBlock, ctx: BuildCtx) => string[]
  html?: (b: SiteBlock, ctx: BuildCtx) => string[]
}

/** The address a site lives at. Only a site on this computer is plain http. */
export function siteOrigin(domain: string | undefined) {
  const host = String(domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
  if (!/^[\w.-]+(:\d+)?$/.test(host)) return ""
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"}://${host}`
}

export const pageHref = (p: Pick<SitePage, "slug">) => (p.slug ? `/${p.slug}/` : "/")
export const postHref = (d: Pick<Draft, "slug">) => `/posts/${d.slug}/`
const fmtDate = (key?: string) => (key ? new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "")

function postCard(d: Draft, show: string[], ctx: BuildCtx) {
  const o = [`<a class="post-card" href="${esc(postHref(d))}">`]
  if (show.includes("cover")) o.push(d.cover ? `  <img src="${esc(pic(ctx, d.cover).src)}"${pic(ctx, d.cover).size} alt="${esc(d.coverAlt ?? "")}" loading="lazy">` : '  <div class="post-card__cover"></div>')
  o.push('  <div class="post-card__body">')
  const kicker = [show.includes("course") && d.course, show.includes("week") && d.week != null && `Week ${d.week}`].filter(Boolean).join(" · ")
  if (kicker) o.push(`    <span class="post-card__kicker">${esc(kicker)}</span>`)
  o.push(`    <span class="post-card__title">${esc(d.title || "Untitled")}</span>`)
  if (show.includes("summary") && d.excerpt) o.push(`    <span class="post-card__summary">${esc(d.excerpt)}</span>`)
  if (show.includes("due") && d.due) o.push(`    <span class="post-card__meta">Due ${esc(fmtDate(d.due))}</span>`)
  o.push("  </div>", "</a>")
  return o
}

/** The 11-character id of a YouTube watch, share, embed or Shorts link; undefined for anything else. */
export function youtubeId(url: string) {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?=$|[?&#/])/.exec(url.trim())
  return m?.[1]
}

/** The colours a badge or an alert can take. */
export const TONES = [{ value: "primary", label: "Accent" }, { value: "secondary", label: "Quiet" }, { value: "success", label: "Green" }, { value: "warning", label: "Yellow" }, { value: "danger", label: "Red" }]
const tone = (b: SiteBlock) => (TONES.some((t) => t.value === b.tone) ? String(b.tone) : "primary")
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
/** "Label|detail" lines, blanks dropped: what the dropdown, calendar and accordion blocks keep their content in. */
export const pairLines = (v: unknown) => str(v).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const at = l.indexOf("|"); return at < 0 ? [l, ""] : [l.slice(0, at).trim(), l.slice(at + 1).trim()] })
const thisMonth = () => new Date().toISOString().slice(0, 7)

/** One month as an accessible table (a caption, column headers, a cell per day) with the listed dates marked. */
function calendarHtml(b: SiteBlock, boot: boolean) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(str(b.month).trim())
  if (!m) return ['<p class="muted">Pick a month like 2026-11.</p>']
  const year = Number(m[1]), month = Number(m[2])
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const events = new Map<string, string[]>()
  for (const [date, what] of pairLines(b.events)) if (date.startsWith(`${m[1]}-${m[2]}-`) && what) events.set(date, [...(events.get(date) ?? []), what])
  const cells: string[] = []
  for (let i = 0; i < first; i++) cells.push('<td class="calendar__empty"></td>')
  for (let d = 1; d <= count; d++) {
    const key = `${m[1]}-${m[2]}-${String(d).padStart(2, "0")}`
    cells.push(`<td><span class="calendar__day">${d}</span>${(events.get(key) ?? []).map((e) => `<span class="calendar__ev">${esc(e)}</span>`).join("")}</td>`)
  }
  while (cells.length % 7) cells.push('<td class="calendar__empty"></td>')
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(`    <tr>${cells.slice(i, i + 7).join("")}</tr>`)
  const table = [`<table class="${boot ? "table table-bordered " : ""}calendar">`, `  <caption>${MONTHS[month - 1]} ${year}</caption>`, `  <thead><tr>${DAYS.map((d) => `<th scope="col"><abbr title="${d}">${d.slice(0, 3)}</abbr></th>`).join("")}</tr></thead>`, "  <tbody>", ...rows, "  </tbody>", "</table>"]
  return boot ? ['<div class="table-responsive">', ...table.map((l) => `  ${l}`), "</div>"] : table
}

export const BLOCKS: Record<string, BlockDef> = {
  section: {
    name: "Section", container: true, inset: 2, def: { tone: "page" },
    edit: [{ k: "tone", l: "Background", kind: "select", options: [{ value: "page", label: "Page" }, { value: "tinted", label: "Shaded" }] }],
    open: (b) => [`<section class="section${b.tone === "tinted" ? " section--tinted" : ""}">`, '  <div class="container">'],
    close: () => ["  </div>", "</section>"],
  },
  row: {
    name: "Row", container: true, def: { cols: "3" },
    edit: [{ k: "cols", l: "Columns", kind: "select", options: [{ value: "2", label: "Two" }, { value: "3", label: "Three" }, { value: "side", label: "Main + side" }] }],
    open: (b, ctx) => {
      const cols = ["2", "3", "side"].includes(String(b.cols)) ? String(b.cols) : "3"
      return [ctx.boot ? `<div class="row g-4 row--${cols}">` : `<div class="row row--${cols}">`]
    },
    close: () => ["</div>"],
  },
  card: { name: "Card", container: true, def: {}, open: (_b, ctx) => (ctx.boot ? ['<article class="card h-100">', '  <div class="card-body">'] : ['<article class="card">']), close: (_b, ctx) => (ctx.boot ? ["  </div>", "</article>"] : ["</article>"]) },
  heading: {
    name: "Heading", def: { level: "2", text: "" },
    edit: [{ k: "text", l: "Heading" }, { k: "level", l: "Size", kind: "select", options: [{ value: "1", label: "Page title" }, { value: "2", label: "Section" }, { value: "3", label: "Small" }] }],
    html: (b, ctx) => {
      let lv = b.level === "1" ? (ctx.h1 ? 2 : 1) : Number(b.level || 2)
      if (lv === 1) ctx.h1 = true
      if (![1, 2, 3].includes(lv)) lv = 2
      return [`<h${lv}>${txt(b.text, "Heading")}</h${lv}>`]
    },
  },
  text: { name: "Text", def: { text: "" }, edit: [{ k: "text", l: "Text", kind: "big" }], html: (b) => str(b.text).trim() ? str(b.text).split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`) : [`<p>${LOREM}</p>`] },
  richtext: {
    name: "Rich text", def: { md: "" }, edit: [{ k: "md", l: "Text (Markdown)", kind: "big", note: "**bold**, *italic*, [links](https://…), lists, ## headings" }],
    html: (b) => [`<div class="prose">`, renderMarkdown(str(b.md) || LOREM), "</div>"],
  },
  button: {
    name: "Button", def: { text: "", href: "", style: "solid" },
    edit: [{ k: "text", l: "Label" }, { k: "href", l: "Goes to", kind: "url", note: "A page like /contact/ or a full https:// address" }, { k: "style", l: "Style", kind: "select", options: [{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }] }],
    html: (b, ctx) => [`<a class="${ctx.boot ? (b.style === "outline" ? "btn btn-outline-primary" : "btn btn-primary") : `btn${b.style === "outline" ? " btn--outline" : ""}`}" href="${esc(safeHref(b.href))}">${txt(b.text, "Button")}</a>`],
  },
  link: { name: "Link", def: { text: "", href: "" }, edit: [{ k: "text", l: "Link text" }, { k: "href", l: "Goes to", kind: "url" }], html: (b) => [`<a href="${esc(safeHref(b.href))}">${txt(b.text, "Link text")}</a>`] },
  list: {
    name: "List", def: { items: "" }, edit: [{ k: "items", l: "List", kind: "big", note: "One item per line" }],
    html: (b) => {
      const lines = str(b.items).split("\n").map((s) => s.trim()).filter(Boolean)
      return ['<ul class="list">', ...(lines.length ? lines : ["First item", "Second item", "Third item"]).map((l) => `  <li>${esc(l)}</li>`), "</ul>"]
    },
  },
  image: {
    name: "Picture", def: { src: "", alt: "", shape: "wide" },
    edit: [{ k: "src", l: "Image", kind: "asset", note: "Pictures come from your asset library, where you can crop and shrink them first." }, { k: "alt", l: "Describe it" }, { k: "shape", l: "Shape", kind: "select", options: [{ value: "wide", label: "Wide" }, { value: "square", label: "Square" }, { value: "tall", label: "Tall" }] }],
    html: (b, _ctx) => {
      const shape = b.shape === "square" ? " ph--square" : b.shape === "tall" ? " ph--tall" : ""
      const src = str(b.src).trim()
      const p = pic(_ctx, src)
      return src ? [`<img class="pic${shape}" src="${esc(p.src)}"${p.size} alt="${esc(b.alt)}" loading="lazy">`] : [`<div class="ph${shape}">${txt(b.alt, "Picture")}</div>`]
    },
  },
  divider: { name: "Divider", def: {}, html: () => ["<hr>"] },
  html: {
    name: "Custom HTML", def: { code: "" },
    edit: [{ k: "code", l: "HTML", kind: "big", note: "Your own markup, published exactly as written. Use it for embeds or to bring over a section from another site." }],
    html: (b) => (str(b.code).trim() ? str(b.code).split("\n") : ['<p class="muted">Paste your HTML into this block.</p>']),
  },
  table: {
    name: "Table", def: { rows: "Week|Topic\n6|CSS Grid\n7|Responsive design" },
    edit: [{ k: "rows", l: "Rows", kind: "big", note: "One row per line, cells separated with |. The first line is the header." }],
    html: (b, ctx) => {
      const lines = str(b.rows).split("\n").map((s) => s.trim()).filter(Boolean)
      const rows = lines.length ? lines : ["Heading|Heading", "Cell|Cell"]
      const table = ["<table>", ...rows.flatMap((ln, i) => ["  <tr>", ...ln.split("|").map((c) => `    <${i ? "td" : "th"}${i ? "" : ' scope="col"'}>${esc(c.trim())}</${i ? "td" : "th"}>`), "  </tr>"]), "</table>"]
      return ctx.boot ? ['<div class="table-responsive">', ...table.map((l, i) => (i === 0 ? '  <table class="table table-bordered">' : `  ${l}`)), "</div>"] : table
    },
  },
  postsByWeek: {
    name: "Posts by week", def: { course: "", order: "newest", show: "cover,week,title,summary,due" },
    edit: [
      { k: "course", l: "Course", note: "Only posts with this course code; empty shows every course" },
      { k: "order", l: "Order", kind: "select", options: [{ value: "newest", label: "Newest week first" }, { value: "oldest", label: "Oldest week first" }] },
      { k: "show", l: "Each post shows", note: "Any of: cover, course, week, title, summary, due" },
    ],
    html: (b, ctx) => {
      const course = str(b.course).trim().toLowerCase()
      const show = str(b.show || "cover,week,title,summary,due").split(",").map((s) => s.trim())
      const posts = ctx.posts.filter((p) => p.week != null && (!course || (p.course ?? "").toLowerCase() === course))
      if (!posts.length) return ['<p class="muted">No posts yet. Posts with a week number show up here.</p>']
      const weeks = [...new Set(posts.map((p) => p.week!))].sort((a, b2) => (b.order === "oldest" ? a - b2 : b2 - a))
      return weeks.flatMap((w) => [
        `<div class="week" id="week-${String(w).padStart(2, "0")}">`,
        `  <h2 class="week__label">Week ${w}</h2>`,
        '  <div class="post-grid">',
        ...posts.filter((p) => p.week === w).sort((a, c) => a.title.localeCompare(c.title, undefined, { numeric: true })).flatMap((p) => postCard(p, show, ctx).map((l) => `    ${l}`)),
        "  </div>",
        "</div>",
      ])
    },
  },
  postList: {
    name: "Latest posts", def: { count: 3, show: "cover,title,summary" },
    edit: [{ k: "count", l: "How many", kind: "number" }, { k: "show", l: "Each post shows", note: "Any of: cover, course, week, title, summary, due" }],
    html: (b, ctx) => {
      const n = Math.max(1, Math.min(24, Number(b.count) || 3))
      const show = str(b.show || "cover,title,summary").split(",").map((s) => s.trim())
      const posts = [...ctx.posts].sort((a, c) => (c.publishedAt ?? c.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt)).slice(0, n)
      return posts.length ? ['<div class="post-grid">', ...posts.flatMap((p) => postCard(p, show, ctx).map((l) => `  ${l}`)), "</div>"] : ['<p class="muted">No posts yet.</p>']
    },
  },
  newsletter: {
    name: "Newsletter sign-up", def: { text: "Get new posts by email.", button: "Subscribe", group: "" },
    edit: [{ k: "text", l: "Text", kind: "big" }, { k: "button", l: "Button" }, { k: "group", l: "MailerLite group ID", note: "Empty uses the Worker's default group" }],
    html: (b, ctx) => [
      ...formOpen(ctx, "newsletter", b.group ? { _group: String(b.group) } : {}, "form form--inline"),
      b.text ? `  <p class="form__lead">${esc(b.text)}</p>` : "",
      '  <p class="field field--row">', `    <label class="sr-only" for="nl-${esc(b.id)}">Email</label>`, `    <input id="nl-${esc(b.id)}" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>`, `    <button class="btn" type="submit">${txt(b.button, "Subscribe")}</button>`, "  </p>",
      ...formClose(ctx, "Thanks! Check your inbox to confirm your subscription."),
    ].filter(Boolean),
  },
  form: {
    name: "Form", def: { formId: "" }, edit: [{ k: "formId", l: "Form", kind: "form", note: "Pick one from the form library" }],
    html: (b, ctx) => {
      const form = ctx.forms.find((f) => f.id === b.formId)
      if (!form) return ['<p class="muted">Choose a form for this block.</p>']
      const o = formOpen(ctx, "form", { _form: form.id })
      const fields = form.fields.some((f) => f.type === "email") ? form.fields : [{ id: "email", label: "Email", type: "email" as const, required: true }, ...form.fields]
      for (const f of fields) {
        const id = `f-${esc(form.id)}-${esc(f.id)}`
        const req = f.type === "email" || f.required ? " required" : ""
        if (f.type === "checkbox") {
          o.push('  <p class="field field--check">', `    <label><input type="checkbox" id="${id}" name="${esc(f.id)}"${req}> ${esc(f.label)}</label>`, "  </p>")
          continue
        }
        o.push('  <p class="field">', `    <label for="${id}">${esc(f.label)}</label>`)
        if (f.type === "textarea") o.push(`    <textarea id="${id}" name="${esc(f.id)}" rows="5"${req}></textarea>`)
        else if (f.type === "select") o.push(`    <select id="${id}" name="${esc(f.id)}"${req}>`, ...(f.options ?? []).map((x) => `      <option>${esc(x)}</option>`), "    </select>")
        else o.push(`    <input id="${id}" name="${esc(f.id)}" type="${f.type === "email" ? "email" : "text"}"${req}>`)
        o.push("  </p>")
      }
      o.push(...formClose(ctx, txt(form.successMessage, "Thanks! Your message was sent."), txt(form.submitLabel, "Send")))
      return o
    },
  },
  progress: {
    name: "Step progress", def: { current: 1, total: 5 },
    edit: [{ k: "current", l: "This step", kind: "number" }, { k: "total", l: "Steps in all", kind: "number", note: "Shows a bar like “Step 2 of 5 (40%)”." }],
    html: (b) => {
      const total = Math.max(1, Math.round(Number(b.total) || 1)), current = Math.min(total, Math.max(0, Math.round(Number(b.current) || 0)))
      const pct = Math.round((current / total) * 100)
      return [`<div class="progress step-progress" role="progressbar" aria-label="Tutorial progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">`, `  <div class="progress-bar" style="width: ${pct}%">Step ${current} of ${total} (${pct}%)</div>`, "</div>"]
    },
  },
  pager: {
    name: "Previous / next", def: {},
    html: (_b, ctx) => {
      const order = [...ctx.pages].sort((a, c) => a.order - c.order), at = order.findIndex((p) => p.id === ctx.current)
      const prev = at > 0 ? order[at - 1] : undefined, next = at >= 0 ? order[at + 1] : undefined
      if (!prev && !next) return ctx.preview ? ['<p class="muted">Previous and next links appear here when the site has other pages.</p>'] : []
      const a = (p: SitePage, rel: "prev" | "next") => `<a class="${ctx.boot ? "btn btn-outline-primary" : "btn btn--outline"}" rel="${rel}" href="${esc(pageHref(p))}">${rel === "prev" ? "← " : ""}${esc(p.title)}${rel === "next" ? " →" : ""}</a>`
      return ['<nav class="step-pager" aria-label="Previous and next page">', prev ? `  ${a(prev, "prev")}` : "  <span></span>", next ? `  ${a(next, "next")}` : "  <span></span>", "</nav>"]
    },
  },
  video: {
    name: "Video or audio", def: { url: "", title: "" },
    edit: [{ k: "url", l: "YouTube link or audio file", kind: "url", note: "A YouTube address (watch, share or embed link), or a link to an .mp3, .ogg or .wav file." }, { k: "title", l: "What it is", note: "A short name; screen readers announce it." }],
    html: (b, ctx) => {
      const url = str(b.url).trim(), title = str(b.title).trim() || "Video"
      const id = youtubeId(url)
      if (id) {
        if (ctx.preview) return [`<div class="ph">Video: ${esc(title)} (it plays on the published page)</div>`]
        return [`<div class="ratio ratio-16x9 video-embed">`, `  <iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(title)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`, "</div>"]
      }
      if (/\.(mp3|ogg|wav|m4a)(\?.*)?$/i.test(url) && safeHref(url) !== "#") return [`<audio controls preload="none" src="${esc(safeHref(url))}" aria-label="${esc(title)}"></audio>`]
      return [`<div class="ph">${url ? "That isn't a YouTube or audio address" : "Paste a YouTube link or an audio file"}</div>`]
    },
  },
  badge: {
    name: "Badge", def: { text: "", tone: "primary" },
    edit: [{ k: "text", l: "Label" }, { k: "tone", l: "Colour", kind: "select", options: TONES }],
    html: (b, ctx) => [ctx.boot ? `<span class="badge text-bg-${tone(b)}">${txt(b.text, "Badge")}</span>` : `<span class="badge badge--${tone(b)}">${txt(b.text, "Badge")}</span>`],
  },
  alert: {
    name: "Alert", def: { text: "", tone: "primary" },
    edit: [{ k: "text", l: "Message", kind: "big" }, { k: "tone", l: "Colour", kind: "select", options: TONES }],
    html: (b, ctx) => [`<div class="${ctx.boot ? `alert alert-${tone(b)}` : `callout callout--${tone(b)}`}" role="note">${txt(b.text, "A note worth reading")}</div>`],
  },
  dropdown: {
    name: "Dropdown", def: { label: "Menu", items: "First option|/\nSecond option|/", style: "solid" },
    edit: [{ k: "label", l: "Button label" }, { k: "items", l: "Options", kind: "big", note: "One per line: the words, then | and where it goes (a page like /about/ or a full address)." }, { k: "style", l: "Style", kind: "select", options: [{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }] }],
    html: (b, ctx) => {
      const items = pairLines(b.items), label = txt(b.label, "Menu"), outline = b.style === "outline"
      const link = (cls: string) => (a: string[]) => `<li><a class="${cls}" href="${esc(safeHref(a[1]))}">${esc(a[0])}</a></li>`
      if (ctx.boot) {
        const menu = ctx.preview ? '<ul class="dropdown-menu show" style="position: static">' : '<ul class="dropdown-menu">'
        return ['<div class="dropdown">', `  <button class="btn ${outline ? "btn-outline-primary" : "btn-primary"} dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">${label}</button>`, `  ${menu}`, ...items.map((a) => `    ${link("dropdown-item")(a)}`), "  </ul>", "</div>"]
      }
      return ['<details class="dd">', `  <summary class="btn${outline ? " btn--outline" : ""}">${label}</summary>`, '  <ul class="dd__menu">', ...items.map((a) => `    ${link("")(a).replace(' class=""', "")}`), "  </ul>", "</details>"]
    },
  },
  tooltip: {
    name: "Tooltip", def: { text: "", tip: "" },
    edit: [{ k: "text", l: "Words people hover or tab to" }, { k: "tip", l: "What it says", kind: "big" }],
    html: (b) => {
      const id = `tip-${String(b.id).replace(/[^\w-]/g, "")}`
      return [`<span class="tip" tabindex="0" aria-describedby="${id}">${txt(b.text, "Hover me")}<span class="tip__text" role="tooltip" id="${id}">${txt(b.tip, "A short explanation")}</span></span>`]
    },
  },
  meter: {
    name: "Progress bar", def: { label: "", value: 50 },
    edit: [{ k: "label", l: "What it measures" }, { k: "value", l: "Percent done (0 to 100)", kind: "number" }],
    html: (b) => {
      const pct = Math.min(100, Math.max(0, Math.round(Number(b.value) || 0))), label = txt(b.label, "Progress")
      return [`<div class="progress step-progress" role="progressbar" aria-label="${label}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">`, `  <div class="progress-bar" style="width: ${pct}%">${label} (${pct}%)</div>`, "</div>"]
    },
  },
  accordion: {
    name: "Accordion", def: { items: "A question people ask|Its answer.\nAnother question|Another answer." },
    edit: [{ k: "items", l: "Questions", kind: "big", note: "One per line: the heading, then | and what opens beneath it." }],
    html: (b) => {
      const items = pairLines(b.items)
      return ['<div class="acc-list">', ...(items.length ? items : [["Heading", "What opens beneath it."]]).flatMap(([q, a]) => ["  <details class=\"acc\">", `    <summary>${esc(q)}</summary>`, `    <div class="acc__body"><p>${esc(a)}</p></div>`, "  </details>"]), "</div>"]
    },
  },
  calendar: {
    name: "Calendar", def: { month: thisMonth(), events: "" },
    edit: [{ k: "month", l: "Month", note: "Like 2026-11" }, { k: "events", l: "Marked dates", kind: "big", note: "One per line: the date, then | and what it is. Example: 2026-11-20|Report due" }],
    html: (b, ctx) => calendarHtml(b, ctx.boot),
  },
  sitename: {
    name: "Site name", def: {},
    html: (_b, ctx) => (ctx.where === "footer" ? [`<p class="site-copy">${esc(ctx.site.footerText || `© ${new Date().getFullYear()} ${ctx.site.name}`)}</p>`] : [`<a class="site-title" href="/">${esc(ctx.site.name)}</a>`]),
  },
  nav: {
    name: "Page links", def: {},
    html: (_b, ctx) => {
      const link = (p: SitePage) => `<a href="${esc(pageHref(p))}"${p.id === ctx.current ? ' aria-current="page"' : ""}>${esc(p.title)}</a>`
      const open = [`<nav class="site-nav" aria-label="${ctx.where === "footer" ? "Footer" : "Main"}">`, "  <ul>"], close = ["  </ul>", "</nav>"]
      if (ctx.where === "footer") {
        const list = footerPages(ctx.pages)
        return !list.length && ctx.pages.some((p) => p.inFooter != null) ? [] : [...open, ...list.map((p) => `    <li>${link(p)}</li>`), ...close]
      }
      return [...open, ...menuTree(ctx.pages).flatMap(({ page, kids }) => (kids.length
        ? [`    <li class="has-sub">${link(page)}`, `      <ul class="sub" aria-label="${esc(page.title)} pages">`, ...kids.map((k) => `        <li>${link(k)}</li>`), "      </ul>", "    </li>"]
        : [`    <li>${link(page)}</li>`])), ...close]
    },
  },
}

/** The opening of every form the Worker receives: where it posts, what it is, and a honeypot bots fill in. */
function formOpen(ctx: BuildCtx, kind: "form" | "comment" | "newsletter", hidden: Record<string, string> = {}, cls = "form") {
  const action = ctx.site.formEndpoint ? `${ctx.site.formEndpoint.replace(/\/+$/, "")}/submit` : "#"
  return [
    `<form class="${cls}" data-blackwall-form action="${esc(action)}" method="post">`,
    `  <input type="hidden" name="_kind" value="${kind}">`,
    `  <input type="hidden" name="_site" value="${esc(ctx.site.id)}">`,
    ...Object.entries(hidden).map(([k, v]) => `  <input type="hidden" name="${esc(k)}" value="${esc(v)}">`),
    '  <p class="hp" aria-hidden="true"><label>Leave this empty <input name="_hp" tabindex="-1" autocomplete="off"></label></p>',
  ]
}
/** Human check, the button (unless the form placed its own) and the thank-you line. */
function formClose(ctx: BuildCtx, done: string, button?: string) {
  return [
    ctx.site.turnstileKey ? `  <div class="cf-turnstile" data-sitekey="${esc(ctx.site.turnstileKey)}"></div>` : "",
    button ? `  <p><button class="btn" type="submit">${button}</button></p>` : "",
    `  <p class="form__done" hidden>${done}</p>`,
    '  <p class="form__verify" hidden>We emailed you a link: click it to confirm and it\'s sent.</p>',
    "</form>",
  ].filter(Boolean)
}

/** Blocks you can add inside a section (containers and content), in menu order. */
export const ADDABLE = ["heading", "text", "richtext", "button", "link", "list", "image", "video", "progress", "meter", "pager", "badge", "alert", "dropdown", "tooltip", "accordion", "calendar", "table", "divider", "html", "postsByWeek", "postList", "form", "newsletter", "row", "card"]

export const menuPages = (pages: SitePage[]) => [...pages].filter((p) => p.inMenu).sort((a, b) => a.order - b.order)

/** The main menu as it is drawn: top-level pages, each with its drop-down. A page whose parent can't hold it (gone, hidden or itself nested) sits at the top level. */
export function menuTree(pages: SitePage[]): { page: SitePage; kids: SitePage[] }[] {
  const listed = menuPages(pages)
  const nested = (p: SitePage) => !!p.parentId && listed.some((x) => x.id === p.parentId && !x.parentId)
  return listed.filter((p) => !nested(p)).map((page) => ({ page, kids: listed.filter((k) => k.parentId === page.id && nested(k)) }))
}

/** The footer menu: the pages picked for it, or the main menu flat while nothing has been picked. */
export function footerPages(pages: SitePage[]): SitePage[] {
  return pages.some((p) => p.inFooter != null) ? [...pages].filter((p) => p.inFooter).sort((a, b) => a.order - b.order) : menuPages(pages)
}

let uid = 0
export const rid = (p: string) => `${p}${(++uid).toString(36)}${Math.random().toString(36).slice(2, 6)}`
export function mk(type: string, props: Record<string, unknown> = {}, kids?: SiteBlock[]): SiteBlock {
  const def = BLOCKS[type]
  const b: SiteBlock = { id: rid("b"), type, ...structuredClone(def.def), ...props }
  if (def.container) b.kids = kids ?? []
  return b
}

/* ----------------------------------------------------------------- sections */

export interface SectionPreset { name: string; about: string; make: () => SiteBlock }
export const SECTIONS: Record<string, SectionPreset> = {
  hero: { name: "Big opening", about: "A title, a sentence, a button.", make: () => mk("section", {}, [mk("heading", { level: "1" }), mk("text"), mk("button", { text: "Get started" })]) },
  textPicture: { name: "Words and a picture", about: "Text on one side, a photo on the other.", make: () => mk("section", { tone: "tinted" }, [mk("row", { cols: "2" }, [mk("card", {}, [mk("heading"), mk("text")]), mk("image")])]) },
  threeCards: { name: "Three boxes", about: "A heading, then three boxes side by side.", make: () => mk("section", {}, [mk("heading", { text: "What I do" }), mk("row", { cols: "3" }, [0, 1, 2].map(() => mk("card", {}, [mk("heading", { level: "3" }), mk("text")])))]) },
  photoGrid: { name: "Photo grid", about: "Six photos in a grid, three across.", make: () => mk("section", {}, [mk("heading", { text: "Gallery" }), mk("row", { cols: "3" }, [0, 1, 2, 3, 4, 5].map(() => mk("image", { shape: "square" })))]) },
  plainText: { name: "Just words", about: "A heading and some text.", make: () => mk("section", {}, [mk("heading"), mk("richtext")]) },
  linkList: { name: "A list", about: "A heading and a bulleted list.", make: () => mk("section", {}, [mk("heading", { text: "Sources" }), mk("list")]) },
  profileCard: { name: "Profile card", about: "A photo beside a name, a role and a short bio.", make: () => mk("section", {}, [mk("row", { cols: "2" }, [mk("image", { shape: "square" }), mk("card", {}, [mk("heading", { level: "1", text: "Your Name" }), mk("heading", { level: "3", text: "What you do" }), mk("text")])])]) },
  sidebar: { name: "Main area with a sidebar", about: "A wide column and a narrow one beside it.", make: () => mk("section", {}, [mk("row", { cols: "side" }, [mk("card", {}, [mk("heading"), mk("richtext")]), mk("card", {}, [mk("heading", { level: "3", text: "On the side" }), mk("list")])])]) },
  table: { name: "A table", about: "Rows and columns, with a header row.", make: () => mk("section", {}, [mk("heading", { text: "Details" }), mk("table")]) },
  callToAction: { name: "Closing nudge", about: "A shaded strip with a heading and a button.", make: () => mk("section", { tone: "tinted" }, [mk("heading", { text: "Ready to talk?" }), mk("text"), mk("button", { text: "Contact me", href: "/contact/" })]) },
  coursePortal: { name: "Posts by week", about: "Course portal: posts grouped by week, newest first.", make: () => mk("section", {}, [mk("heading", { level: "1", text: "Course portal" }), mk("postsByWeek")]) },
  latestPosts: { name: "Latest posts", about: "Your newest posts as cards.", make: () => mk("section", {}, [mk("heading", { text: "Latest posts" }), mk("postList")]) },
  assignment: { name: "Assignment", about: "A title, the course and week, then your write-up.", make: () => mk("section", {}, [mk("heading", { level: "1" }), mk("text"), mk("richtext")]) },
  contact: { name: "Contact form", about: "A heading, a sentence and a form from your library.", make: () => mk("section", {}, [mk("heading", { level: "1", text: "Contact" }), mk("text"), mk("form")]) },
}
/** A step of a tutorial: its progress bar, a title, the text and a picture. */
const stepSection = (n: number, of: number) => mk("section", {}, [mk("progress", { current: n, total: of }), mk("heading", { level: "1" }), mk("text"), mk("image"), mk("richtext"), mk("pager")])
SECTIONS.step = { name: "Tutorial step", about: "A “Step 1 of 5” bar, a title, text, a picture and previous / next links.", make: () => stepSection(1, 5) }
SECTIONS.video = { name: "Video", about: "A YouTube video (or an audio file) with a title.", make: () => mk("section", { tone: "tinted" }, [mk("heading", { text: "Watch it done" }), mk("video")]) }
export const SECTION_ORDER = ["hero", "textPicture", "threeCards", "photoGrid", "profileCard", "sidebar", "plainText", "linkList", "table", "coursePortal", "assignment", "latestPosts", "callToAction", "contact", "step", "video"]
export const section = (k: string): SiteBlock => {
  // "step:2:5" is the second of five steps.
  const step = /^step:(\d+):(\d+)$/.exec(k)
  return step ? { ...stepSection(Number(step[1]), Number(step[2])), preset: "step" } : { ...SECTIONS[k].make(), preset: k }
}

export const TEMPLATES: Record<string, { name: string; about: string; starter: string; /** Site settings the template turns on. */ site?: Partial<Pick<Site, "framework" | "themeToggle" | "fontHeading" | "fontBody">>; pages: { title: string; slug: string; sections: string[] }[] }> = {
  simple: { name: "Simple site", about: "Home, about, contact.", starter: "midnight", pages: [{ title: "Home", slug: "", sections: ["hero", "threeCards", "callToAction"] }, { title: "About", slug: "about", sections: ["plainText", "textPicture"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  portal: { name: "Course portal", about: "Home, a blog of weekly assignments, about, contact.", starter: "midnight", pages: [{ title: "Home", slug: "", sections: ["hero", "latestPosts"] }, { title: "Blog", slug: "blog", sections: ["coursePortal"] }, { title: "About", slug: "about", sections: ["profileCard", "plainText"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  blog: { name: "Blog", about: "Home with latest posts, about, contact.", starter: "forest", pages: [{ title: "Home", slug: "", sections: ["hero", "latestPosts"] }, { title: "About", slug: "about", sections: ["textPicture"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  portfolio: { name: "Project showcase", about: "Projects with pictures and a write-up.", starter: "ember", pages: [{ title: "Home", slug: "", sections: ["hero", "textPicture"] }, { title: "Projects", slug: "projects", sections: ["threeCards", "photoGrid"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  tutorial: { name: "Tutorial guide (Bootstrap)", about: "A step-by-step guide: home, overview, five steps with progress bars, gallery and contact. Bootstrap 5, light/dark button, Google Fonts.", starter: "midnight", site: { framework: "bootstrap", themeToggle: true, fontHeading: "Poppins", fontBody: "Inter" }, pages: [
    { title: "Home", slug: "", sections: ["hero", "threeCards", "callToAction"] },
    { title: "Overview", slug: "overview", sections: ["plainText", "linkList", "video"] },
    ...[1, 2, 3, 4, 5].map((n) => ({ title: `Step ${n}`, slug: `step-${n}`, sections: [`step:${n}:5`] })),
    { title: "Gallery", slug: "gallery", sections: ["photoGrid"] },
    { title: "Contact", slug: "contact", sections: ["contact"] },
  ] },
  onepage: { name: "One-page site", about: "Opening, what you do, gallery, contact.", starter: "slate", pages: [{ title: "Home", slug: "", sections: ["hero", "threeCards", "photoGrid", "contact"] }] },
}

/* --------------------------------------------------------------------- emit */

/** These blocks can draw more than one element, so their editor wrapper is a real box the outline can go around. */
const MANY_ROOTS = new Set(["text", "postsByWeek", "html"])

function emit(list: SiteBlock[], indent: string, ctx: BuildCtx, out: string[]) {
  for (const b of list) {
    const def = BLOCKS[b.type]
    if (!def) continue
    // In the editor's preview every block sits in a transparent wrapper, so a click can be traced back to its block.
    const marked = ctx.preview && ctx.where === "page"
    if (marked) out.push(`${indent}<div data-bw="${esc(b.id)}" data-bw-t="${esc(b.type)}" style="display:${MANY_ROOTS.has(b.type) ? "block" : "contents"}">`)
    emitBlock(b, def, indent, ctx, out)
    if (marked) out.push(`${indent}</div>`)
  }
}

const DESIGN_VALUES = { align: ["center", "right"], top: ["none", "s", "m", "l"], bottom: ["none", "s", "m", "l"], bg: ["surface", "accent"], anim: Object.keys(ANIMATIONS) } as const
const DESIGN_PREFIX = { align: "bs-a-", top: "bs-t-", bottom: "bs-b-", bg: "bs-bg-", anim: "bs-an-" } as const

/** The classes for a block's Style tab choices; only known values get through. Empty for a block with none. */
function designClass(b: SiteBlock) {
  if (!b.design) return ""
  return (Object.keys(DESIGN_VALUES) as (keyof typeof DESIGN_VALUES)[]).flatMap((k) => ((DESIGN_VALUES[k] as readonly string[]).includes(String(b.design?.[k])) ? [`${DESIGN_PREFIX[k]}${b.design?.[k]}`] : [])).join(" ")
}

function emitBlock(b: SiteBlock, def: BlockDef, indent: string, ctx: BuildCtx, out: string[]) {
  const cls = designClass(b)
  if (def.container) {
    def.open!(b, ctx).forEach((l, i) => out.push(indent + (i === 0 && cls ? l.replace('class="', `class="${cls} `) : l)))
    const inner = indent + "  ".repeat(def.inset ?? 1)
    if (b.type === "row" && ctx.boot) {
      // Bootstrap's grid wants each child in its own column: full width on phones, then the row's split.
      const cols = ["2", "3", "side"].includes(String(b.cols)) ? String(b.cols) : "3"
      ;(b.kids ?? []).forEach((kid, i) => {
        out.push(`${inner}<div class="col-12 col-md-${cols === "2" ? 6 : cols === "3" ? 4 : i === 0 ? 8 : 4}">`)
        emit([kid], inner + "  ", ctx, out)
        out.push(`${inner}</div>`)
      })
    } else emit(b.kids ?? [], inner, ctx, out)
    def.close!(b, ctx).forEach((l) => out.push(indent + l))
  } else if (cls) {
    out.push(`${indent}<div class="bs ${cls}">`)
    def.html!(b, ctx).forEach((l) => out.push(`${indent}  ${l}`))
    out.push(`${indent}</div>`)
  } else def.html!(b, ctx).forEach((l) => out.push(indent + l))
}

const FORM_SCRIPT = `<script>
document.querySelectorAll("form[data-blackwall-form]").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    if (f.action.endsWith("#")) return;
    e.preventDefault();
    var btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
    fetch(f.action, { method: "POST", body: new FormData(f) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.j.error || "Couldn't send");
        f.querySelectorAll(".field, [type=submit], .cf-turnstile, .form__lead").forEach(function (el) { el.hidden = true; });
        var v = f.querySelector(r.j.verify && f.querySelector("[name=_kind]").value !== "newsletter" ? ".form__verify" : ".form__done"); if (v) v.hidden = false;
      })
      .catch(function (err) {
        var m = f.querySelector(".form__error"); if (!m) { m = document.createElement("p"); m.className = "form__error"; m.setAttribute("role", "alert"); f.appendChild(m); }
        m.textContent = err.message; if (btn) btn.disabled = false; if (window.turnstile) window.turnstile.reset();
      });
  });
});
</script>`

/** Editor-only marks in a preview: the block under the pointer and the block being edited. */
const PREVIEW_CSS = `.bw-hover { outline: 1px dashed #4c8dff; outline-offset: 3px; cursor: pointer; } .bw-sel { outline: 2px solid #4c8dff; outline-offset: 3px; }
.bw-editing { outline: 2px solid #4c8dff; outline-offset: 3px; cursor: text; white-space: pre-wrap; min-width: 2ch; min-height: 1em; }
.bw-editing:empty::before { content: attr(data-placeholder); opacity: .45; }
#bw-tag { position: absolute; z-index: 9999; padding: 1px 6px; border-radius: 3px 3px 0 0; background: #4c8dff; color: #fff; font: 600 11px/16px system-ui, sans-serif; pointer-events: none; }
#bw-bar { position: absolute; z-index: 9998; display: flex; align-items: center; height: 26px; border-radius: 5px; background: #4c8dff; color: #fff; font: 600 11px/26px system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
#bw-bar span { padding: 0 8px; white-space: nowrap; }
#bw-bar button { width: 26px; height: 26px; padding: 0; border: 0; border-left: 1px solid rgba(255,255,255,.3); background: none; color: inherit; font: 400 14px/26px system-ui, sans-serif; cursor: pointer; }
#bw-bar button:hover { background: rgba(0,0,0,.2); }
.bw-insert { position: relative; height: 0; z-index: 30; }
.bw-insert::before { content: ""; position: absolute; left: 0; right: 0; top: -14px; height: 28px; }
.bw-insert button { position: absolute; left: 50%; top: -13px; width: 26px; height: 26px; margin-left: -13px; padding: 0; border: 0; border-radius: 50%; background: #4c8dff; color: #fff; font: 400 20px/26px system-ui, sans-serif; cursor: pointer; opacity: 0; transition: opacity .1s; }
.bw-insert:hover button { opacity: 1; }
.bw-insert--empty { height: auto; padding: 96px 20px; text-align: center; }
.bw-insert--empty::before { display: none; }
.bw-insert--empty button { position: static; width: auto; height: auto; margin: 0; padding: 8px 16px; border-radius: 8px; font-size: 14px; line-height: 20px; opacity: 1; }`

/** The strip between sections where the editor offers to add one; only ever in the editor's own preview. */
const insertStrip = (at: number, indent: string, empty = false) => `${indent}<div class="bw-insert${empty ? " bw-insert--empty" : ""}" data-bw-insert="${at}"><button type="button" tabindex="-1" aria-label="Add a section here">${empty ? "+ Add a section" : "+"}</button></div>`

interface Doc { title: string; description: string; body: string[]; current?: string; bodyClass: string }

const toggleButton = (cls: string) => `<button type="button" class="${cls}" data-theme-toggle aria-pressed="false"><span data-theme-label>Dark mode</span></button>`

/** Bootstrap mode's header: a collapsing navbar (a menu button on phones) with drop-downs and the light/dark button. */
function bootHeader(ctx: BuildCtx, toggle: boolean, extras: string[]) {
  const link = (p: SitePage, cls: string) => `<a class="${cls}${p.id === ctx.current ? " active" : ""}" href="${esc(pageHref(p))}"${p.id === ctx.current ? ' aria-current="page"' : ""}>${esc(p.title)}</a>`
  const items = menuTree(ctx.pages).flatMap(({ page, kids }) => (kids.length
    ? ['        <li class="nav-item dropdown">', `          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">${esc(page.title)}</a>`, '          <ul class="dropdown-menu">', `            <li>${link(page, "dropdown-item")}</li>`, ...kids.map((k) => `            <li>${link(k, "dropdown-item")}</li>`), "          </ul>", "        </li>"]
    : [`        <li class="nav-item">${link(page, "nav-link")}</li>`]))
  return [
    '<nav class="navbar navbar-expand-lg" aria-label="Main">', '  <div class="container">', `    <a class="navbar-brand" href="/">${esc(ctx.site.name)}</a>`,
    '    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-menu" aria-controls="main-menu" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>',
    '    <div class="collapse navbar-collapse" id="main-menu">', '      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">', ...items, "      </ul>",
    ...(extras.length ? ['      <div class="d-flex flex-wrap align-items-center gap-2 ms-lg-3 mb-2 mb-lg-0">', ...extras.map((l) => `  ${l}`), "      </div>"] : []),
    ...(toggle ? [`      ${toggleButton("btn btn-outline-primary btn-sm ms-lg-3 mb-2 mb-lg-0")}`] : []),
    "    </div>", "  </div>", "</nav>",
  ]
}

function bootFooter(ctx: BuildCtx) {
  const list = footerPages(ctx.pages), own = ctx.pages.some((p) => p.inFooter != null)
  return [
    '<div class="container d-flex flex-wrap justify-content-between align-items-center gap-3 py-4">',
    `  <p class="mb-0 text-body-secondary">${esc(ctx.site.footerText || `© ${new Date().getFullYear()} ${ctx.site.name}`)}</p>`,
    ...(list.length || !own ? ['  <nav aria-label="Footer">', '    <ul class="nav">', ...list.map((p) => `      <li class="nav-item"><a class="nav-link" href="${esc(pageHref(p))}"${p.id === ctx.current ? ' aria-current="page"' : ""}>${esc(p.title)}</a></li>`), "    </ul>", "  </nav>"] : []),
    "</div>",
  ]
}

/** Bootstrap needs its own classes on form fields; the form blocks draw plain ones, so they are dressed here. */
const bootForms = (line: string) => line
  .replace(/<label for=/g, '<label class="form-label" for=')
  .replace(/<(input|textarea)\b(?![^>]*(?:type="(?:hidden|checkbox)"|name="_hp"))/g, '<$1 class="form-control"')
  .replace(/<select /g, '<select class="form-select" ')
  .replace('<button class="btn" type="submit">', '<button class="btn btn-primary" type="submit">')

const PRECONNECT = ['    <link rel="preconnect" href="https://fonts.googleapis.com">', '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>']

function documentHtml(site: Site, pages: SitePage[], doc: Doc, opts: { preview: boolean; bare?: boolean; posts: Draft[]; forms: SiteForm[]; assets?: Asset[]; assetUrls?: Record<string, string> }) {
  const ctx: BuildCtx = { site, pages, posts: opts.posts, forms: opts.forms, current: doc.current, where: "header", h1: false, boot: isBootstrap(site), preview: opts.preview, assets: opts.assets ?? [], assetUrls: opts.assetUrls ?? {} }
  const boot = ctx.boot, toggle = !!site.themeToggle && site.darkMode, fonts = googleFontsHref(site)
  const head: string[] = [], foot: string[] = [], extras: string[] = []
  // Header items: the editor's preview marks each so a click selects it; the published page draws them plainly.
  if (!opts.bare && site.headerBlocks?.length) emit(site.headerBlocks, "        ", { ...ctx, where: "page", h1: true }, extras)
  if (!boot) {
    emit([mk("sitename"), mk("nav")], "      ", ctx, head)
    if (extras.length) head.push('      <div class="site-extras">', ...extras, "      </div>")
    if (toggle) head.push(`      ${toggleButton("btn btn--outline theme-toggle")}`)
    ctx.where = "footer"
    emit([mk("sitename"), mk("nav")], "      ", ctx, foot)
  }
  const hasForm = doc.body.some((l) => l.includes("data-blackwall-form"))
  const css = boot
    ? (opts.preview ? `    <style>\n${buildBootstrapCss(site, pages)}\n${PREVIEW_CSS}\n    </style>` : '    <link rel="stylesheet" href="/css/style.css">')
    : opts.preview ? `    <style>\n${buildTheme(site)}\n${buildCss(pages)}\n${PREVIEW_CSS}\n    </style>` : '    <link rel="stylesheet" href="/theme.css">\n    <link rel="stylesheet" href="/style.css">'
  const body = boot ? doc.body.map(bootForms) : doc.body
  return [
    "<!doctype html>", '<html lang="en">', "  <head>", '    <meta charset="UTF-8">', '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `    <title>${esc(doc.title)}</title>`,
    doc.description ? `    <meta name="description" content="${esc(doc.description)}">` : "",
    `    <meta property="og:title" content="${esc(doc.title)}">`,
    doc.description ? `    <meta property="og:description" content="${esc(doc.description)}">` : "",
    toggle && !opts.preview ? `    ${THEME_SCRIPT.replace(/\n/g, "\n    ")}` : "",
    boot ? (opts.preview && previewAssets.bootstrapCssUrl ? `    <link rel="stylesheet" href="${esc(previewAssets.bootstrapCssUrl)}">` : `    <link rel="stylesheet" href="${BOOTSTRAP.css.href}" integrity="${BOOTSTRAP.css.integrity}" crossorigin="anonymous">`) : "",
    ...(fonts ? [...PRECONNECT, `    <link rel="stylesheet" href="${esc(fonts)}">`] : []),
    css,
    hasForm && site.turnstileKey && !opts.preview ? '    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : "",
    "  </head>", `  <body class="${esc(doc.bodyClass)}">`,
    ...(opts.bare ? [] : ['    <a class="skip-link" href="#main">Skip to main content</a>']),
    ...(opts.bare ? [] : boot ? ["    <header>", ...bootHeader(ctx, toggle, extras).map((l) => `      ${l}`), "    </header>"] : ['    <header class="site-header">', ...head, "    </header>"]),
    '    <main id="main">', ...body, "    </main>",
    ...(opts.bare ? [] : boot ? ['    <footer class="border-top mt-5">', ...bootFooter(ctx).map((l) => `      ${l}`), "    </footer>"] : ['    <footer class="site-footer">', ...foot, "    </footer>"]),
    hasForm ? FORM_SCRIPT : "",
    toggle && !opts.preview && !opts.bare ? THEME_TOGGLE_SCRIPT : "",
    boot && !opts.preview ? `    <script src="${BOOTSTRAP.js.href}" integrity="${BOOTSTRAP.js.integrity}" crossorigin="anonymous"></script>` : "",
    "  </body>", "</html>", "",
  ].filter((l) => l !== "").join("\n")
}

const slugClass = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"

export function renderPage(site: Site, pages: SitePage[], page: SitePage, opts: { preview?: boolean; edit?: boolean; bare?: boolean; posts?: Draft[]; forms?: SiteForm[]; assets?: Asset[]; assetUrls?: Record<string, string> } = {}) {
  const ctx: BuildCtx = { site, pages, posts: opts.posts ?? [], forms: opts.forms ?? [], current: page.id, where: "page", h1: false, boot: isBootstrap(site), preview: !!opts.preview, assets: opts.assets ?? [], assetUrls: opts.assetUrls ?? {} }
  const body: string[] = []
  if (opts.edit && opts.preview) {
    if (!page.sections.length) body.push(insertStrip(0, "      ", true))
    page.sections.forEach((s, i) => { body.push(insertStrip(i, "      ")); emit([s], "      ", ctx, body) })
    if (page.sections.length) body.push(insertStrip(page.sections.length, "      "))
  } else emit(page.sections, "      ", ctx, body)
  const title = page.slug ? `${page.title} — ${site.name}` : site.name
  return documentHtml(site, pages, { title, description: page.description, body, current: page.id, bodyClass: `page-${slugClass(page.slug || "home")}` }, { preview: !!opts.preview, bare: opts.bare, posts: opts.posts ?? [], forms: opts.forms ?? [], assets: opts.assets, assetUrls: opts.assetUrls })
}

/** One section by itself, in the site's own look, with no menu or footer around it: what the section picker and the Sections list show. */
export function renderSectionPreview(site: Site, block: SiteBlock, opts: { posts?: Draft[]; forms?: SiteForm[]; assets?: Asset[]; assetUrls?: Record<string, string> } = {}) {
  const page: SitePage = { id: "section-preview", siteId: site.id, title: "", slug: "", description: "", inMenu: false, order: 0, sections: [block], createdAt: "", updatedAt: "" }
  return renderPage(site, [page], page, { ...opts, preview: true, bare: true })
}

/** Approved comments and the comment form, under a post (when the site has comments on). */
function commentsHtml(site: Site, pages: SitePage[], post: Draft, comments: InboxItem[], preview: boolean) {
  const ctx: BuildCtx = { site, pages, posts: [], forms: [], where: "page", h1: true, boot: isBootstrap(site), preview, assets: [], assetUrls: {} }
  const mine = comments.filter((c) => c.post === post.slug)
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  return [
    '      <section class="section comments" aria-labelledby="comments-title">', '        <div class="container container--narrow">',
    `          <h2 id="comments-title">${mine.length ? `${mine.length} comment${mine.length === 1 ? "" : "s"}` : "Comments"}</h2>`,
    ...mine.flatMap((c) => [
      '          <article class="comment">', `            <p class="comment__meta"><b>${esc(c.name || "Anonymous")}</b> · <time datetime="${esc(c.at)}">${when(c.at)}</time></p>`,
      ...esc(c.fields.comment ?? "").split(/\n{2,}/).map((para) => `            <p>${para.replace(/\n/g, "<br>")}</p>`), "          </article>",
    ]),
    ...[
      ...formOpen(ctx, "comment", { _post: post.slug }),
      '  <p class="field"><label for="c-name">Name</label><input id="c-name" name="name" autocomplete="name" required></p>',
      '  <p class="field"><label for="c-email">Email <span class="muted">(never shown)</span></label><input id="c-email" name="email" type="email" autocomplete="email" required></p>',
      '  <p class="field"><label for="c-text">Comment</label><textarea id="c-text" name="comment" rows="5" required></textarea></p>',
      ...formClose(ctx, "Thanks! Your comment will appear once it's approved.", "Post comment"),
    ].map((l) => `          ${l}`),
    "        </div>", "      </section>",
  ]
}

export function renderPost(site: Site, pages: SitePage[], post: Draft, opts: { preview?: boolean; forms?: SiteForm[]; comments?: InboxItem[]; assets?: Asset[]; assetUrls?: Record<string, string> } = {}) {
  const pc = { assets: opts.assets ?? [], assetUrls: opts.assetUrls ?? {}, preview: !!opts.preview }
  /** Library pictures typed into the Markdown get their address swapped for the preview's copy. */
  const bodyHtml = renderMarkdown(post.body).replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/g, (m, a: string, u: string, z: string) => (pc.preview && pc.assetUrls[u] ? `${a}${pc.assetUrls[u]}${z}` : m))
  const kicker = [post.course, post.week != null && `Week ${post.week}`, post.due && `Due ${fmtDate(post.due)}`].filter(Boolean).join(" · ")
  const body = [
    '      <article class="section post">', '        <div class="container container--narrow">',
    kicker ? `          <p class="post__kicker">${esc(kicker)}</p>` : "",
    `          <h1>${esc(post.title || "Untitled")}</h1>`,
    post.cover ? `          <img class="post__cover" src="${esc(pic(pc, post.cover).src)}"${pic(pc, post.cover).size} alt="${esc(post.coverAlt ?? "")}">` : "",
    '          <div class="prose">', bodyHtml, "          </div>",
    "        </div>", "      </article>",
    ...(site.comments ? commentsHtml(site, pages, post, opts.comments ?? [], !!opts.preview) : []),
  ].filter(Boolean)
  return documentHtml(site, pages, { title: `${post.title} — ${site.name}`, description: post.excerpt, body, bodyClass: "page-post" }, { preview: !!opts.preview, posts: [], forms: opts.forms ?? [], assets: opts.assets, assetUrls: opts.assetUrls })
}

/** theme.css: the palette as CSS variables, dark mode, then your own CSS. `extra` goes between them (Bootstrap mode's bridge to Bootstrap). */
export function buildTheme(site: Site, extra = "") {
  const toggle = !!site.themeToggle && site.darkMode
  const body = fontName(site.fontBody), heading = fontName(site.fontHeading)
  const fallback = FONTS[site.font ?? "sans"]?.css ?? FONT
  const vars = (pal: Site["light"], pad: string) => [...SWATCH_KEYS.map((k) => `${pad}--${k}: ${pal[k]};`), `${pad}--accent-text: ${onAccent(pal.accent)};`]
  const o = [`/* ${site.name} — colours (generated by Blackwall; edit them in Site settings) */`, ":root {"]
  for (const k of SWATCH_KEYS) o.push(`  --${k}: ${site.light[k]};`)
  o.push(`  --accent-text: ${onAccent(site.light.accent)};`)
  o.push(`  --font: ${body ? `"${body}", ${fallback}` : fallback};`)
  if (heading) o.push(`  --font-heading: "${heading}", ${fallback};`)
  o.push(`  --radius: ${CORNERS[site.corners ?? "soft"]?.px ?? 8}px;`, `  --width: ${WIDTHS[site.width ?? "normal"]?.px ?? 1100}px;`, "}")
  if (site.darkMode) {
    if (toggle) {
      o.push("@media (prefers-color-scheme: dark) {", '  :root:not([data-theme="light"]) {', ...vars(site.dark, "    "), "  }", "}", ':root[data-theme="dark"] {', ...vars(site.dark, "  "), "}")
    } else o.push("@media (prefers-color-scheme: dark) {", "  :root {", ...vars(site.dark, "    "), "  }", "}")
  }
  if (heading) o.push("h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }")
  if (extra.trim()) o.push("", extra.trimEnd())
  if (site.customCss.trim()) o.push("", "/* Your CSS */", site.customCss)
  return o.join("\n") + "\n"
}

/** css/style.css of a Bootstrap-mode site: the palette and fonts as variables, Bootstrap bridged to them, the layout touches Bootstrap lacks, then your own CSS. */
export function buildBootstrapCss(site: Site, pages: SitePage[] = []) {
  return buildTheme(site, [BOOTSTRAP_BRIDGE, COMPONENT_CSS, pages.some((p) => usesDesign(p.sections)) ? DESIGN_CSS : "", animationCss(pages)].join(""))
}

export function buildCss(pages: SitePage[] = []) {
  return `/* Layout (generated by Blackwall) */
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font, ${FONT}); font-size: 16px; line-height: 1.6; background: var(--bg); color: var(--text); }
h1 { font-size: 36px; } h2 { font-size: 26px; } h3 { font-size: 19px; }
h1, h2, h3 { margin: 0 0 20px; line-height: 1.25; }
a { color: var(--accent); }
img { max-width: 100%; display: block; }
.muted { color: var(--muted); }
.container { max-width: var(--width, 1100px); margin: 0 auto; padding: 0 20px; }
.container--narrow { max-width: 760px; }
.section { padding: 64px 0; }
.section--tinted { background: var(--surface); }
.row { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 700px) { .row--2 { grid-template-columns: repeat(2, 1fr); } .row--3 { grid-template-columns: repeat(3, 1fr); } .row--side { grid-template-columns: 2fr 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius, 8px); padding: 20px; }
.btn { display: inline-block; padding: 12px 22px; border: 1px solid var(--accent); border-radius: var(--radius, 8px); background: var(--accent); color: var(--accent-text); font: inherit; text-decoration: none; cursor: pointer; }
.btn--outline { background: none; color: var(--accent); }
.ph { height: 240px; display: grid; place-items: center; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius, 8px); color: var(--muted); font-size: 13px; }
.ph--square { height: 260px; } .ph--tall { height: 320px; }
.pic { width: 100%; height: 240px; object-fit: cover; border-radius: var(--radius, 8px); }
.pic.ph--square { aspect-ratio: 1; height: auto; } .pic.ph--tall { aspect-ratio: 4 / 5; height: auto; }
.list { padding-left: 20px; margin: 0 0 20px; } .list li { margin-bottom: 6px; }
hr { border: 0; border-top: 1px solid var(--border); margin: 48px 0; }
table { border-collapse: collapse; width: 100%; margin: 0 0 20px; }
th, td { border: 1px solid var(--border); padding: 10px; text-align: left; }
th { background: var(--surface); }
.prose { max-width: 70ch; } .prose img { border-radius: var(--radius, 8px); margin: 16px 0; }
.prose pre { background: var(--surface); padding: 14px; border-radius: var(--radius, 8px); overflow: auto; }
.form { max-width: 480px; } .field { margin: 0 0 18px; } .field label { display: block; margin-bottom: 6px; }
.field input:not([type=checkbox]), .field textarea, .field select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius, 8px); background: var(--bg); color: var(--text); font: inherit; }
.field--check label { display: flex; gap: 8px; align-items: center; }
.cf-turnstile { margin: 0 0 18px; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.form--inline { max-width: 560px; } .field--row { display: flex; gap: 8px; } .field--row input { flex: 1; min-width: 0; }
.form__error { color: #c0392b; }
.comments { border-top: 1px solid var(--border); } .comments .form { margin-top: 28px; }
.comment { padding: 14px 0; border-bottom: 1px solid var(--border); } .comment p { margin: 0 0 6px; }
.comment__meta { font-size: 14px; color: var(--muted); } .comment__meta b { color: var(--text); }
.week { margin: 0 0 40px; }
.week__label { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.post-card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius, 10px); overflow: hidden; text-decoration: none; color: var(--text); background: var(--bg); }
.post-card:hover { border-color: var(--accent); }
.post-card img, .post-card__cover { width: 100%; height: 150px; object-fit: cover; background: var(--surface); }
.post-card__body { display: grid; gap: 4px; padding: 12px 14px 16px; }
.post-card__kicker { font-size: 12px; font-weight: 600; color: var(--accent); }
.post-card__title { font-weight: 700; }
.post-card__summary, .post-card__meta { font-size: 14px; color: var(--muted); }
.post__kicker { color: var(--accent); font-weight: 600; margin: 0 0 8px; }
.post__cover { border-radius: var(--radius, 10px); margin: 0 0 24px; width: 100%; }
.site-header, .site-footer { display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; max-width: var(--width, 1100px); margin: 0 auto; padding: 20px; }
.site-header { border-bottom: 1px solid var(--border); }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); }
.site-title { font-weight: bold; font-size: 18px; color: var(--text); text-decoration: none; }
.site-copy { margin: 0; }
.site-nav ul { display: flex; flex-wrap: wrap; gap: 20px; list-style: none; margin: 0; padding: 0; }
.site-nav a { text-decoration: none; }
.site-nav a[aria-current=page] { font-weight: 700; }
.skip-link { position: absolute; left: 8px; top: -64px; z-index: 2000; padding: 8px 16px; background: var(--accent); color: var(--accent-text); border-radius: var(--radius, 8px); }
.skip-link:focus { top: 8px; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.progress { height: 24px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius, 8px); margin: 0 0 20px; }
.progress-bar { height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 10px; white-space: nowrap; background: var(--accent); color: var(--accent-text); font-size: 13px; font-weight: 600; }
.step-pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 32px; }
.ratio { position: relative; width: 100%; } .ratio::before { content: ""; display: block; padding-top: 56.25%; } .ratio > * { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
audio { width: 100%; }
.theme-toggle { cursor: pointer; font-size: 14px; padding: 6px 12px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
${pages.some((p) => p.parentId) ? MENU_CSS : ""}${pages.some((p) => usesDesign(p.sections)) ? DESIGN_CSS : ""}${COMPONENT_CSS}${animationCss(pages)}`
}

/** The keyframes of the entrance animations a site uses, and the rule that turns them off for visitors who ask for less motion. */
export function animationCss(pages: SitePage[]) {
  const used = new Set<string>()
  const scan = (list: SiteBlock[]) => list.forEach((b) => { if (b.design?.anim && ANIMATIONS[b.design.anim]) used.add(b.design.anim); if (b.kids) scan(b.kids) })
  pages.forEach((p) => scan(p.sections))
  return used.size ? `${[...used].map((k) => ANIMATIONS[k].css).join("\n")}\n${REDUCED_MOTION_CSS}\n` : ""
}

const usesDesign = (list: SiteBlock[]): boolean => list.some((b) => (b.design && designClass(b)) || (b.kids && usesDesign(b.kids)))

/** Drop-down menus, no script needed: open on hover and on keyboard focus; on phones they are simply listed. */
const MENU_CSS = `.site-nav .has-sub { position: relative; }
.site-nav .has-sub > a::after { content: " \\25BE"; font-size: .8em; }
.site-nav .sub { display: none; position: absolute; top: 100%; left: -14px; z-index: 20; flex-direction: column; flex-wrap: nowrap; gap: 0; min-width: 180px; padding: 6px 0; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius, 8px); }
.site-nav .has-sub:hover > .sub, .site-nav .has-sub:focus-within > .sub { display: flex; }
.site-nav .sub a { display: block; padding: 6px 14px; white-space: nowrap; }
@media (max-width: 560px) { .site-nav .sub { display: flex; position: static; min-width: 0; padding: 4px 0 0 12px; background: none; border: 0; } .site-nav .sub a { padding: 3px 0; } }
`

/** One block's own alignment, spacing and background (the inspector's Style tab). */
const DESIGN_CSS = `.bs-a-center { text-align: center; } .bs-a-right { text-align: right; }
.bs-a-center .form, .bs-a-center .prose { margin-left: auto; margin-right: auto; text-align: left; }
.bs-t-none { margin-top: 0; } .bs-t-s { margin-top: 12px; } .bs-t-m { margin-top: 28px; } .bs-t-l { margin-top: 56px; }
.bs-b-none { margin-bottom: 0; } .bs-b-s { margin-bottom: 12px; } .bs-b-m { margin-bottom: 28px; } .bs-b-l { margin-bottom: 56px; }
div.bs[class*="bs-t-"] > :first-child { margin-top: 0; } div.bs[class*="bs-b-"] > :last-child { margin-bottom: 0; }
.section.bs-t-none { padding-top: 0; } .section.bs-t-s { margin-top: 0; padding-top: 24px; } .section.bs-t-m { margin-top: 0; padding-top: 64px; } .section.bs-t-l { margin-top: 0; padding-top: 120px; }
.section.bs-b-none { padding-bottom: 0; } .section.bs-b-s { margin-bottom: 0; padding-bottom: 24px; } .section.bs-b-m { margin-bottom: 0; padding-bottom: 64px; } .section.bs-b-l { margin-bottom: 0; padding-bottom: 120px; }
.bs-bg-surface { background: var(--surface); } .bs-bg-accent { background: var(--accent); color: var(--accent-text); }
div.bs.bs-bg-surface, div.bs.bs-bg-accent { padding: 16px; border-radius: var(--radius, 8px); }
.bs-bg-accent a:not(.btn) { color: inherit; } .bs-bg-accent .btn { background: var(--accent-text); border-color: var(--accent-text); color: var(--accent); }
`

const redirectHtml = (to: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${esc(to)}"><meta http-equiv="refresh" content="0; url=${esc(to)}"></head><body><p>This page moved to <a href="${esc(to)}">${esc(to)}</a>.</p></body></html>\n`

const cleanPath = (p: string) => "/" + p.replace(/^\/+|\/+$/g, "")

/** Every file of the site, keyed by path relative to the site's root folder. */
export function buildSite(site: Site, pages: SitePage[], posts: Draft[], forms: SiteForm[], comments: InboxItem[] = [], assets: Asset[] = []): Record<string, string> {
  const files: Record<string, string> = {}
  const live = posts.filter((p) => p.siteId === site.id && p.publishedAt)
  const own = pages.filter((p) => p.siteId === site.id)
  // Bootstrap mode writes flat .html files with relative links, so the folder can be put anywhere.
  const flat = isBootstrap(site)
  const put = (file: string, html: string) => { files[file] = flat ? relativize(html, file) : html }
  for (const pg of own) {
    const file = flat ? flatFile(pageHref(pg)) : pg.slug ? `${pg.slug}/index.html` : "index.html"
    put(file, renderPage(site, own, pg, { posts: live, forms, assets }))
  }
  for (const p of live) put(flat ? flatFile(postHref(p)) : `posts/${p.slug}/index.html`, renderPost(site, own, p, { forms, comments, assets }))
  if (flat) files["css/style.css"] = buildBootstrapCss(site, own)
  else {
    files["theme.css"] = buildTheme(site)
    files["style.css"] = buildCss(own)
  }
  const base = site.domain ? `https://${site.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : ""
  const urls = [...own.map(pageHref), ...live.map(postHref)]
  files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + (flat && u !== "/" ? `/${flatFile(u)}` : u))}</loc></url>`).join("\n")}\n</urlset>\n`
  files["robots.txt"] = `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`
  // Redirects: _redirects for hosts that read it (Cloudflare Pages, Netlify), and a small
  // page at the old address for hosts that don't (GitHub Pages).
  const redirects = flat ? [] : site.redirects.filter((r) => r.from.trim() && r.to.trim())
  if (redirects.length) files["_redirects"] = redirects.map((r) => `${cleanPath(r.from)} ${r.to.startsWith("http") ? r.to : cleanPath(r.to) + (r.to.endsWith("/") ? "/" : "")} 301`).join("\n") + "\n"
  for (const r of redirects) {
    const from = cleanPath(r.from).slice(1)
    if (from && !files[`${from}/index.html`]) files[`${from}/index.html`] = redirectHtml(r.to)
  }
  files[".nojekyll"] = ""
  return files
}

/** A new site from a template: its record fields and its pages (the caller adds ids and times). */
export function siteFromTemplate(name: string, key: string): { site: Omit<Site, "id" | "createdAt" | "updatedAt">; pages: Omit<SitePage, "id" | "siteId" | "createdAt" | "updatedAt">[] } {
  const t = TEMPLATES[key] ?? TEMPLATES.simple
  const s = STARTERS[t.starter]
  return {
    site: { name, domain: "", root: "", starter: t.starter, light: { ...s.light }, dark: { ...s.dark }, darkMode: true, customCss: "", footerText: "", redirects: [], ...t.site },
    pages: t.pages.map((p, i) => ({ title: p.title, slug: p.slug, description: "", inMenu: true, order: i, sections: nameFirstHeading(p.sections.map(section), p.slug ? p.title : name) })),
  }
}

/** The page's first heading becomes its title (as the page's one big heading), so a new page opens with its own name instead of a blank or sample "Heading". */
export function nameFirstHeading(sections: SiteBlock[], title: string): SiteBlock[] {
  let done = false
  const go = (list: SiteBlock[]): SiteBlock[] => list.map((b) => {
    if (!done && b.type === "heading") { done = true; return { ...b, text: title, level: "1" } }
    return b.kids ? { ...b, kids: go(b.kids) } : b
  })
  return go(sections)
}

/** What a new page can start as: a title, an address and the sections that usually make it up. */
export const PAGE_KINDS: Record<string, { name: string; about: string; title: string; slug: string; sections: string[] }> = {
  blank: { name: "Blank page", about: "Start empty and add your own sections.", title: "", slug: "", sections: [] },
  about: { name: "About", about: "Who you are, with a photo.", title: "About", slug: "about", sections: ["profileCard", "plainText"] },
  contact: { name: "Contact", about: "A short note and a contact form.", title: "Contact", slug: "contact", sections: ["contact"] },
  projects: { name: "Projects", about: "Boxes for your work, then a photo grid.", title: "Projects", slug: "projects", sections: ["threeCards", "photoGrid"] },
  services: { name: "Services", about: "What you offer, then a nudge to get in touch.", title: "Services", slug: "services", sections: ["threeCards", "callToAction"] },
  blog: { name: "Blog", about: "Your newest posts as cards.", title: "Blog", slug: "blog", sections: ["latestPosts"] },
  portal: { name: "Course portal", about: "Posts grouped by week.", title: "Course portal", slug: "portal", sections: ["coursePortal"] },
  assignment: { name: "Assignment page", about: "The course and week, then your write-up.", title: "Assignment", slug: "assignment", sections: ["assignment"] },
  gallery: { name: "Gallery", about: "A grid of photos.", title: "Gallery", slug: "gallery", sections: ["photoGrid"] },
  links: { name: "Links / resources", about: "A heading and a list.", title: "Resources", slug: "resources", sections: ["linkList"] },
}

/** A copy of blocks with fresh ids (for duplicating a page or building a site from a template site). */
export function cloneBlocks(list: SiteBlock[]): SiteBlock[] {
  return list.map((b) => ({ ...structuredClone(b), id: rid("b"), kids: b.kids ? cloneBlocks(b.kids) : undefined })).map((b) => (b.kids === undefined ? (delete b.kids, b) : b))
}

/** A new site that starts as a copy of one you kept as a template: its look and its pages, with fresh ids. */
export function siteFromSite(name: string, source: Site, sourcePages: SitePage[]): { site: Omit<Site, "id" | "createdAt" | "updatedAt">; pages: Omit<SitePage, "id" | "siteId" | "createdAt" | "updatedAt">[] } {
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, publishedSha: _s, exportedAt: _e, connectionId: _k, template: _t, templateAbout: _a, guideHidden: _g, ...look } = source
  return {
    site: { ...structuredClone(look), name, domain: "", footerText: look.footerText === `© ${source.name}` ? "" : look.footerText, redirects: [] },
    pages: [...sourcePages].sort((a, b) => a.order - b.order).map((p, i) => ({ title: p.title, slug: p.slug, description: p.description, inMenu: p.inMenu, ...(p.inFooter != null ? { inFooter: p.inFooter } : {}), order: i, sections: cloneBlocks(p.sections) })),
  }
}

/* -------------------------------------------------------------- site check */

export interface SiteIssue {
  /** "fix" stops the site working or looking right; "tip" makes it better. */
  level: "fix" | "tip"
  text: string
  pageId?: string
  /** Where the fix lives, when it isn't a page. */
  area?: "settings" | "look" | "forms" | "posts"
}

/** Words the ready-made sections ship with that nobody means to publish as they are. */
const SAMPLE_TEXT = new Set(["what i do", "your name", "what you do", "ready to talk?", "on the side", "sources", "details"])

function walk(list: SiteBlock[], fn: (b: SiteBlock) => void) {
  for (const b of list) {
    fn(b)
    if (b.kids) walk(b.kids, fn)
  }
}
const has = (v: unknown) => typeof v === "string" && v.trim().length > 0

/** Plain-language problems to sort out before the files go live: placeholders, broken links, empty pages, forms that can't send. */
export function checkSite(site: Site, pages: SitePage[], posts: Draft[], forms: SiteForm[], assets: Asset[] = []): SiteIssue[] {
  const out: SiteIssue[] = []
  const own = pages.filter((p) => p.siteId === site.id)
  const live = posts.filter((p) => p.siteId === site.id && p.publishedAt)
  if (!own.length) return [{ level: "fix", text: "The site has no pages yet. Add one from the Pages tab." }]
  if (!own.some((p) => p.slug === "")) out.push({ level: "fix", text: "There is no home page. A page with an empty address is the front door of the site." })
  const slugs = new Set<string>()
  for (const p of own) {
    if (slugs.has(p.slug)) out.push({ level: "fix", text: `Two pages use the address /${p.slug}. Give one of them a new address.`, pageId: p.id })
    slugs.add(p.slug)
  }
  const known = new Set([...own.map((p) => pageHref(p)), ...live.map((p) => postHref(p))])
  let needsReceiver = !!site.comments && live.length > 0
  for (const page of own) {
    const name = page.title || "Untitled page"
    if (!page.sections.length) out.push({ level: "fix", text: `${name} is empty. Add a section to it, or delete it.`, pageId: page.id })
    let blank = 0, noAlt = 0, noImage = 0, bad = 0, noForm = 0, h1 = 0, outside = 0
    walk(page.sections, (b) => {
      if (b.type === "heading") { if (!has(b.text) || SAMPLE_TEXT.has(String(b.text).trim().toLowerCase())) blank++; if (b.level === "1") h1++ }
      else if (b.type === "text" && !has(b.text)) blank++
      else if (b.type === "richtext" && !has(b.md)) blank++
      else if (b.type === "button" && !has(b.text)) blank++
      else if (b.type === "list" && !has(b.items)) blank++
      else if (b.type === "image") { if (!has(b.src)) noImage++; else if (!findAsset(assets, String(b.src).trim())) outside++; else if (!has(b.alt)) noAlt++ }
      else if (b.type === "form") { if (!forms.some((f) => f.id === b.formId)) noForm++; else needsReceiver = true }
      else if (b.type === "newsletter") needsReceiver = true
      if (b.type === "button" || b.type === "link") {
        const href = String(b.href ?? "").trim()
        const internal = href.startsWith("/") && !href.startsWith("//")
        if (!href || href === "#") bad++
        else if (internal && !known.has(href.split(/[?#]/)[0].replace(/\/?$/, "/"))) bad++
      }
    })
    const at = { pageId: page.id }
    if (blank) out.push({ level: "fix", text: `${name}: ${blank} ${blank === 1 ? "block still shows" : "blocks still show"} placeholder text. Click it in the preview and write your own.`, ...at })
    if (noImage) out.push({ level: "fix", text: `${name}: ${noImage} ${noImage === 1 ? "picture has" : "pictures have"} no image yet.`, ...at })
    if (bad) out.push({ level: "fix", text: `${name}: ${bad} ${bad === 1 ? "button or link goes" : "buttons or links go"} nowhere (or to a page that doesn't exist).`, ...at })
    if (outside) out.push({ level: "fix", text: `${name}: ${outside} ${outside === 1 ? "picture isn't" : "pictures aren't"} from your asset library, so Blackwall can't include ${outside === 1 ? "it" : "them"} in your files. Pick ${outside === 1 ? "it" : "them"} again from the library.`, ...at })
    if (noForm) out.push({ level: "fix", text: `${name}: a form block has no form chosen.`, ...at })
    if (noAlt) out.push({ level: "tip", text: `${name}: ${noAlt} ${noAlt === 1 ? "picture needs" : "pictures need"} a description for people who can't see it.`, ...at })
    if (!has(page.description)) out.push({ level: "tip", text: `${name}: add a one-sentence description; search results and shared links use it.`, ...at })
    if (h1 > 1) out.push({ level: "tip", text: `${name} has ${h1} big page titles; one is best for search.`, ...at })
  }
  for (const post of live) {
    const missing = imagePathsInPost(post).filter((p) => !findAsset(assets, p))
    if (missing.length) out.push({ level: "fix", text: `The post “${post.title || post.slug}” uses ${missing.length === 1 ? "a picture" : `${missing.length} pictures`} that ${missing.length === 1 ? "isn't" : "aren't"} in your asset library (${missing[0]}).`, area: "posts" })
  }
  for (const post of live) if (!has(post.body)) out.push({ level: "fix", text: `The post “${post.title || post.slug}” is published but empty.`, area: "posts" })
  if (needsReceiver && !has(site.formEndpoint)) out.push({ level: "fix", text: "Forms, sign-ups or comments are on the site but can't send yet: add your form receiver address in Site settings.", area: "settings" })
  if (!has(site.domain)) out.push({ level: "tip", text: "Add your domain in Site settings so the sitemap and “Open site” point at the right place.", area: "settings" })
  const low = (["text", "muted", "accent"] as const).filter((k) => contrast(site.light[k], site.light.bg) < (k === "muted" ? 3 : 4.5))
  if (low.length) out.push({ level: "tip", text: `Some colors are hard to read on the page background (${low.map((k) => SWATCH_INFO[k].l.toLowerCase()).join(", ")}). Check the Look tab.`, area: "look" })
  return out
}


/**
 * Brings one page of an existing site over: its title, description and main content. The site's own header, footer and
 * scripts are left behind (Blackwall draws its own), and the content becomes a Custom HTML block you can replace piece by piece.
 */
export function importHtml(source: string): { title: string; description: string; body: string } {
  const pick = (re: RegExp) => re.exec(source)?.[1]?.trim() ?? ""
  const decode = (t: string) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  const title = decode(pick(/<title[^>]*>([\s\S]*?)<\/title>/i)).split(/\s[—–|-]\s/)[0].trim()
  const description = decode(pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i))
  let body = pick(/<main[^>]*>([\s\S]*?)<\/main>/i) || pick(/<body[^>]*>([\s\S]*?)<\/body>/i) || source
  body = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<header[\s\S]*?<\/header>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
  return { title, description, body: body.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim() }
}
