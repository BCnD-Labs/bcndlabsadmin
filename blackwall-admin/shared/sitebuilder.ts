/**
 * The CMS site builder: Pagesmith's block model (sections, rows, cards and content blocks,
 * section presets, site templates and palettes), ported to TypeScript and extended with
 * posts, a course portal ("Posts by week"), real images and links, and reusable forms.
 *
 * Pure functions, no DOM: the browser uses it for the live preview, the server for
 * publishing, so what you preview is exactly what gets committed.
 */
import { renderMarkdown } from "./site.ts"
import type { Draft, Site, SiteBlock, SiteForm, SitePage, SitePalette } from "../src/lib/types.ts"

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
const onAccent = (a: string) => (lum(a) > 0.45 ? "#111111" : "#ffffff")

export const SWATCH_KEYS = ["bg", "surface", "text", "muted", "border", "accent"] as const
export const SWATCH_INFO: Record<(typeof SWATCH_KEYS)[number], { l: string; d: string }> = {
  bg: { l: "Page", d: "Behind everything" },
  surface: { l: "Boxes", d: "Cards and shaded strips" },
  text: { l: "Text", d: "Headings and paragraphs" },
  muted: { l: "Faint", d: "Captions, footer" },
  border: { l: "Lines", d: "Borders and rules" },
  accent: { l: "Accent", d: "Links and buttons" },
}

export const STARTERS: Record<string, { name: string; light: SitePalette; dark: SitePalette }> = {
  midnight: { name: "Midnight", light: { bg: "#ffffff", surface: "#f4f5f7", text: "#1a1c1e", muted: "#5c6166", border: "#dfe2e6", accent: "#3b6fe0" }, dark: { bg: "#1e1f20", surface: "#262829", text: "#e5e6e6", muted: "#9a9b9c", border: "#3a3b3c", accent: "#6f9ef5" } },
  forest: { name: "Forest", light: { bg: "#ffffff", surface: "#f2f6f3", text: "#1b2420", muted: "#54605b", border: "#dae2dd", accent: "#2f8457" }, dark: { bg: "#161a18", surface: "#1f2522", text: "#e3e8e5", muted: "#95a09b", border: "#333b37", accent: "#57b183" } },
  ember: { name: "Ember", light: { bg: "#fffdfb", surface: "#f8f2ee", text: "#241c18", muted: "#665a53", border: "#e7dcd4", accent: "#c9512a" }, dark: { bg: "#1f1a17", surface: "#282220", text: "#eae4e0", muted: "#a2968f", border: "#3d3531", accent: "#e87d55" } },
  slate: { name: "Slate", light: { bg: "#ffffff", surface: "#f3f4f8", text: "#1a1c24", muted: "#575c6c", border: "#dcdee8", accent: "#5560c4" }, dark: { bg: "#17181d", surface: "#1f2128", text: "#e4e5ea", muted: "#95989f", border: "#34363f", accent: "#8d96ea" } },
  rose: { name: "Rose", light: { bg: "#fffcfd", surface: "#f9f0f4", text: "#241a1e", muted: "#67565d", border: "#e9dae0", accent: "#c0426f" }, dark: { bg: "#1d181a", surface: "#262022", text: "#eae2e5", muted: "#a1949a", border: "#3b3236", accent: "#e4799e" } },
  sand: { name: "Sand", light: { bg: "#fffefb", surface: "#f7f3ea", text: "#232019", muted: "#635b4c", border: "#e5ddcb", accent: "#9c7022" }, dark: { bg: "#1c1a16", surface: "#25221c", text: "#e8e4da", muted: "#9e978a", border: "#393428", accent: "#d3a44e" } },
}

/* ------------------------------------------------------------------- blocks */

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."

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
  preview: boolean
}

/** What a block's editor shows: the field key, its label, and the kind of input. */
export interface BlockField { k: string; l: string; kind?: "text" | "big" | "select" | "number" | "form" | "url"; note?: string; options?: { value: string; label: string }[] }

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

export const pageHref = (p: Pick<SitePage, "slug">) => (p.slug ? `/${p.slug}/` : "/")
export const postHref = (d: Pick<Draft, "slug">) => `/posts/${d.slug}/`
const fmtDate = (key?: string) => (key ? new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "")

function postCard(d: Draft, show: string[]) {
  const o = [`<a class="post-card" href="${esc(postHref(d))}">`]
  if (show.includes("cover")) o.push(d.cover ? `  <img src="${esc(d.cover)}" alt="${esc(d.coverAlt ?? "")}" loading="lazy">` : '  <div class="post-card__cover"></div>')
  o.push('  <div class="post-card__body">')
  const kicker = [show.includes("course") && d.course, show.includes("week") && d.week != null && `Week ${d.week}`].filter(Boolean).join(" · ")
  if (kicker) o.push(`    <span class="post-card__kicker">${esc(kicker)}</span>`)
  o.push(`    <span class="post-card__title">${esc(d.title || "Untitled")}</span>`)
  if (show.includes("summary") && d.excerpt) o.push(`    <span class="post-card__summary">${esc(d.excerpt)}</span>`)
  if (show.includes("due") && d.due) o.push(`    <span class="post-card__meta">Due ${esc(fmtDate(d.due))}</span>`)
  o.push("  </div>", "</a>")
  return o
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
    open: (b) => [`<div class="row row--${esc(b.cols || "3")}">`], close: () => ["</div>"],
  },
  card: { name: "Card", container: true, def: {}, open: () => ['<article class="card">'], close: () => ["</article>"] },
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
    html: (b) => [`<a class="btn${b.style === "outline" ? " btn--outline" : ""}" href="${esc(safeHref(b.href))}">${txt(b.text, "Button")}</a>`],
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
    edit: [{ k: "src", l: "Image", kind: "url", note: "An image address or one from the asset library" }, { k: "alt", l: "Describe it" }, { k: "shape", l: "Shape", kind: "select", options: [{ value: "wide", label: "Wide" }, { value: "square", label: "Square" }, { value: "tall", label: "Tall" }] }],
    html: (b) => {
      const shape = b.shape === "square" ? " ph--square" : b.shape === "tall" ? " ph--tall" : ""
      const src = str(b.src).trim()
      return src ? [`<img class="pic${shape}" src="${esc(src)}" alt="${esc(b.alt)}" loading="lazy">`] : [`<div class="ph${shape}">${txt(b.alt, "Picture")}</div>`]
    },
  },
  divider: { name: "Divider", def: {}, html: () => ["<hr>"] },
  table: {
    name: "Table", def: { rows: "Week|Topic\n6|CSS Grid\n7|Responsive design" },
    edit: [{ k: "rows", l: "Rows", kind: "big", note: "One row per line, cells separated with |. The first line is the header." }],
    html: (b) => {
      const lines = str(b.rows).split("\n").map((s) => s.trim()).filter(Boolean)
      const rows = lines.length ? lines : ["Heading|Heading", "Cell|Cell"]
      return ["<table>", ...rows.flatMap((ln, i) => ["  <tr>", ...ln.split("|").map((c) => `    <${i ? "td" : "th"}>${esc(c.trim())}</${i ? "td" : "th"}>`), "  </tr>"]), "</table>"]
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
        ...posts.filter((p) => p.week === w).sort((a, c) => a.title.localeCompare(c.title, undefined, { numeric: true })).flatMap((p) => postCard(p, show).map((l) => `    ${l}`)),
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
      return posts.length ? ['<div class="post-grid">', ...posts.flatMap((p) => postCard(p, show).map((l) => `  ${l}`)), "</div>"] : ['<p class="muted">No posts yet.</p>']
    },
  },
  form: {
    name: "Form", def: { formId: "" }, edit: [{ k: "formId", l: "Form", kind: "form", note: "Pick one from the form library" }],
    html: (b, ctx) => {
      const form = ctx.forms.find((f) => f.id === b.formId)
      if (!form) return ['<p class="muted">Choose a form for this block.</p>']
      const action = ctx.site.formEndpoint ? `${ctx.site.formEndpoint.replace(/\/+$/, "")}/submit` : "#"
      const o = [`<form class="form" data-blackwall-form action="${esc(action)}" method="post">`, `  <input type="hidden" name="_form" value="${esc(form.id)}">`, `  <input type="hidden" name="_site" value="${esc(ctx.site.id)}">`]
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
      if (ctx.site.turnstileKey) o.push(`  <div class="cf-turnstile" data-sitekey="${esc(ctx.site.turnstileKey)}"></div>`)
      o.push(`  <p><button class="btn" type="submit">${txt(form.submitLabel, "Send")}</button></p>`, `  <p class="form__done" hidden>${txt(form.successMessage, "Thanks! Check your email to confirm.")}</p>`, "</form>")
      return o
    },
  },
  sitename: {
    name: "Site name", def: {},
    html: (_b, ctx) => (ctx.where === "footer" ? [`<p class="site-copy">${esc(ctx.site.footerText || `© ${new Date().getFullYear()} ${ctx.site.name}`)}</p>`] : [`<a class="site-title" href="/">${esc(ctx.site.name)}</a>`]),
  },
  nav: {
    name: "Page links", def: {},
    html: (_b, ctx) => [
      `<nav class="site-nav" aria-label="${ctx.where === "footer" ? "Footer" : "Main"}">`, "  <ul>",
      ...menuPages(ctx.pages).map((p) => `    <li><a href="${esc(pageHref(p))}"${p.id === ctx.current ? ' aria-current="page"' : ""}>${esc(p.title)}</a></li>`),
      "  </ul>", "</nav>",
    ],
  },
}

/** Blocks you can add inside a section (containers and content), in menu order. */
export const ADDABLE = ["heading", "text", "richtext", "button", "link", "list", "image", "table", "divider", "postsByWeek", "postList", "form", "row", "card"]

export const menuPages = (pages: SitePage[]) => [...pages].filter((p) => p.inMenu).sort((a, b) => a.order - b.order)

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
  contact: { name: "Contact form", about: "A heading, a sentence and a form from your library.", make: () => mk("section", {}, [mk("heading", { level: "1", text: "Contact" }), mk("text"), mk("form")]) },
}
export const SECTION_ORDER = ["hero", "textPicture", "threeCards", "photoGrid", "profileCard", "sidebar", "plainText", "linkList", "table", "coursePortal", "latestPosts", "callToAction", "contact"]
export const section = (k: string): SiteBlock => ({ ...SECTIONS[k].make(), preset: k })

export const TEMPLATES: Record<string, { name: string; about: string; starter: string; pages: { title: string; slug: string; sections: string[] }[] }> = {
  simple: { name: "Simple site", about: "Home, about, contact.", starter: "midnight", pages: [{ title: "Home", slug: "", sections: ["hero", "threeCards", "callToAction"] }, { title: "About", slug: "about", sections: ["plainText", "textPicture"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  portal: { name: "Course portal", about: "Home, a blog of weekly assignments, about, contact.", starter: "midnight", pages: [{ title: "Home", slug: "", sections: ["hero", "latestPosts"] }, { title: "Blog", slug: "blog", sections: ["coursePortal"] }, { title: "About", slug: "about", sections: ["profileCard", "plainText"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  blog: { name: "Blog", about: "Home with latest posts, about, contact.", starter: "forest", pages: [{ title: "Home", slug: "", sections: ["hero", "latestPosts"] }, { title: "About", slug: "about", sections: ["textPicture"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  portfolio: { name: "Project showcase", about: "Projects with pictures and a write-up.", starter: "ember", pages: [{ title: "Home", slug: "", sections: ["hero", "textPicture"] }, { title: "Projects", slug: "projects", sections: ["threeCards", "photoGrid"] }, { title: "Contact", slug: "contact", sections: ["contact"] }] },
  onepage: { name: "One-page site", about: "Opening, what you do, gallery, contact.", starter: "slate", pages: [{ title: "Home", slug: "", sections: ["hero", "threeCards", "photoGrid", "contact"] }] },
}

/* --------------------------------------------------------------------- emit */

function emit(list: SiteBlock[], indent: string, ctx: BuildCtx, out: string[]) {
  for (const b of list) {
    const def = BLOCKS[b.type]
    if (!def) continue
    if (def.container) {
      def.open!(b, ctx).forEach((l) => out.push(indent + l))
      emit(b.kids ?? [], indent + "  ".repeat(def.inset ?? 1), ctx, out)
      def.close!(b, ctx).forEach((l) => out.push(indent + l))
    } else def.html!(b, ctx).forEach((l) => out.push(indent + l))
  }
}

const FORM_SCRIPT = `<script>
document.querySelectorAll("form[data-blackwall-form]").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    if (f.action.endsWith("#")) return;
    e.preventDefault();
    var btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
    fetch(f.action, { method: "POST", body: new FormData(f) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) { if (!r.ok) throw new Error(r.j.error || "Couldn't send"); f.querySelectorAll(".field, [type=submit], .cf-turnstile").forEach(function (el) { el.hidden = true; }); f.querySelector(".form__done").hidden = false; })
      .catch(function (err) { alert(err.message); if (btn) btn.disabled = false; });
  });
});
</script>`

interface Doc { title: string; description: string; body: string[]; current?: string; bodyClass: string }

function documentHtml(site: Site, pages: SitePage[], doc: Doc, opts: { preview: boolean; posts: Draft[]; forms: SiteForm[] }) {
  const ctx: BuildCtx = { site, pages, posts: opts.posts, forms: opts.forms, current: doc.current, where: "header", h1: false, preview: opts.preview }
  const head: string[] = [], foot: string[] = []
  emit([mk("sitename"), mk("nav")], "      ", ctx, head)
  ctx.where = "footer"
  emit([mk("sitename"), mk("nav")], "      ", ctx, foot)
  const hasForm = doc.body.some((l) => l.includes("data-blackwall-form"))
  const css = opts.preview ? `    <style>\n${buildTheme(site)}\n${buildCss()}\n    </style>` : '    <link rel="stylesheet" href="/theme.css">\n    <link rel="stylesheet" href="/style.css">'
  return [
    "<!doctype html>", '<html lang="en">', "  <head>", '    <meta charset="UTF-8">', '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `    <title>${esc(doc.title)}</title>`,
    doc.description ? `    <meta name="description" content="${esc(doc.description)}">` : "",
    `    <meta property="og:title" content="${esc(doc.title)}">`,
    doc.description ? `    <meta property="og:description" content="${esc(doc.description)}">` : "",
    css,
    hasForm && site.turnstileKey && !opts.preview ? '    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : "",
    "  </head>", `  <body class="${esc(doc.bodyClass)}">`,
    '    <header class="site-header">', ...head, "    </header>",
    "    <main>", ...doc.body, "    </main>",
    '    <footer class="site-footer">', ...foot, "    </footer>",
    hasForm ? FORM_SCRIPT : "",
    "  </body>", "</html>", "",
  ].filter((l) => l !== "").join("\n")
}

const slugClass = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"

export function renderPage(site: Site, pages: SitePage[], page: SitePage, opts: { preview?: boolean; posts?: Draft[]; forms?: SiteForm[] } = {}) {
  const ctx: BuildCtx = { site, pages, posts: opts.posts ?? [], forms: opts.forms ?? [], current: page.id, where: "page", h1: false, preview: !!opts.preview }
  const body: string[] = []
  emit(page.sections, "      ", ctx, body)
  const title = page.slug ? `${page.title} — ${site.name}` : site.name
  return documentHtml(site, pages, { title, description: page.description, body, current: page.id, bodyClass: `page-${slugClass(page.slug || "home")}` }, { preview: !!opts.preview, posts: opts.posts ?? [], forms: opts.forms ?? [] })
}

export function renderPost(site: Site, pages: SitePage[], post: Draft, opts: { preview?: boolean; forms?: SiteForm[] } = {}) {
  const kicker = [post.course, post.week != null && `Week ${post.week}`, post.due && `Due ${fmtDate(post.due)}`].filter(Boolean).join(" · ")
  const body = [
    '      <article class="section post">', '        <div class="container container--narrow">',
    kicker ? `          <p class="post__kicker">${esc(kicker)}</p>` : "",
    `          <h1>${esc(post.title || "Untitled")}</h1>`,
    post.cover ? `          <img class="post__cover" src="${esc(post.cover)}" alt="${esc(post.coverAlt ?? "")}">` : "",
    '          <div class="prose">', renderMarkdown(post.body), "          </div>",
    "        </div>", "      </article>",
  ].filter(Boolean)
  return documentHtml(site, pages, { title: `${post.title} — ${site.name}`, description: post.excerpt, body, bodyClass: "page-post" }, { preview: !!opts.preview, posts: [], forms: opts.forms ?? [] })
}

/** theme.css: the palette as CSS variables, dark mode, then your own CSS. */
export function buildTheme(site: Site) {
  const o = [`/* ${site.name} — colours (generated by Blackwall; edit them in Site settings) */`, ":root {"]
  for (const k of SWATCH_KEYS) o.push(`  --${k}: ${site.light[k]};`)
  o.push(`  --accent-text: ${onAccent(site.light.accent)};`, "}")
  if (site.darkMode) {
    o.push("@media (prefers-color-scheme: dark) {", "  :root {")
    for (const k of SWATCH_KEYS) o.push(`    --${k}: ${site.dark[k]};`)
    o.push(`    --accent-text: ${onAccent(site.dark.accent)};`, "  }", "}")
  }
  if (site.customCss.trim()) o.push("", "/* Your CSS */", site.customCss)
  return o.join("\n") + "\n"
}

/** style.css: layout and components; colours come from theme.css. */
export function buildCss() {
  return `/* Layout (generated by Blackwall) */
* { box-sizing: border-box; }
body { margin: 0; font-family: ${FONT}; font-size: 16px; line-height: 1.6; background: var(--bg); color: var(--text); }
h1 { font-size: 36px; } h2 { font-size: 26px; } h3 { font-size: 19px; }
h1, h2, h3 { margin: 0 0 20px; line-height: 1.25; }
a { color: var(--accent); }
img { max-width: 100%; display: block; }
.muted { color: var(--muted); }
.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
.container--narrow { max-width: 760px; }
.section { padding: 64px 0; }
.section--tinted { background: var(--surface); }
.row { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 700px) { .row--2 { grid-template-columns: repeat(2, 1fr); } .row--3 { grid-template-columns: repeat(3, 1fr); } .row--side { grid-template-columns: 2fr 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.btn { display: inline-block; padding: 12px 22px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: var(--accent-text); font: inherit; text-decoration: none; cursor: pointer; }
.btn--outline { background: none; color: var(--accent); }
.ph { height: 240px; display: grid; place-items: center; background: var(--surface); border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); font-size: 13px; }
.ph--square { height: 260px; } .ph--tall { height: 320px; }
.pic { width: 100%; height: 240px; object-fit: cover; border-radius: 8px; }
.pic.ph--square { aspect-ratio: 1; height: auto; } .pic.ph--tall { aspect-ratio: 4 / 5; height: auto; }
.list { padding-left: 20px; margin: 0 0 20px; } .list li { margin-bottom: 6px; }
hr { border: 0; border-top: 1px solid var(--border); margin: 48px 0; }
table { border-collapse: collapse; width: 100%; margin: 0 0 20px; }
th, td { border: 1px solid var(--border); padding: 10px; text-align: left; }
th { background: var(--surface); }
.prose { max-width: 70ch; } .prose img { border-radius: 8px; margin: 16px 0; }
.prose pre { background: var(--surface); padding: 14px; border-radius: 8px; overflow: auto; }
.form { max-width: 480px; } .field { margin: 0 0 18px; } .field label { display: block; margin-bottom: 6px; }
.field input:not([type=checkbox]), .field textarea, .field select { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
.field--check label { display: flex; gap: 8px; align-items: center; }
.cf-turnstile { margin: 0 0 18px; }
.week { margin: 0 0 40px; }
.week__label { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
.post-card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; text-decoration: none; color: var(--text); background: var(--bg); }
.post-card:hover { border-color: var(--accent); }
.post-card img, .post-card__cover { width: 100%; height: 150px; object-fit: cover; background: var(--surface); }
.post-card__body { display: grid; gap: 4px; padding: 12px 14px 16px; }
.post-card__kicker { font-size: 12px; font-weight: 600; color: var(--accent); }
.post-card__title { font-weight: 700; }
.post-card__summary, .post-card__meta { font-size: 14px; color: var(--muted); }
.post__kicker { color: var(--accent); font-weight: 600; margin: 0 0 8px; }
.post__cover { border-radius: 10px; margin: 0 0 24px; width: 100%; }
.site-header, .site-footer { display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; padding: 20px; }
.site-header { border-bottom: 1px solid var(--border); }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); }
.site-title { font-weight: bold; font-size: 18px; color: var(--text); text-decoration: none; }
.site-copy { margin: 0; }
.site-nav ul { display: flex; flex-wrap: wrap; gap: 20px; list-style: none; margin: 0; padding: 0; }
.site-nav a { text-decoration: none; }
.site-nav a[aria-current=page] { font-weight: 700; }
`
}

const redirectHtml = (to: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${esc(to)}"><meta http-equiv="refresh" content="0; url=${esc(to)}"></head><body><p>This page moved to <a href="${esc(to)}">${esc(to)}</a>.</p></body></html>\n`

const cleanPath = (p: string) => "/" + p.replace(/^\/+|\/+$/g, "")

/** Every file of the site, keyed by path relative to the site's root folder. */
export function buildSite(site: Site, pages: SitePage[], posts: Draft[], forms: SiteForm[]): Record<string, string> {
  const files: Record<string, string> = {}
  const live = posts.filter((p) => p.siteId === site.id && p.publishedAt)
  const own = pages.filter((p) => p.siteId === site.id)
  for (const pg of own) files[pg.slug ? `${pg.slug}/index.html` : "index.html"] = renderPage(site, own, pg, { posts: live, forms })
  for (const p of live) files[`posts/${p.slug}/index.html`] = renderPost(site, own, p, { forms })
  files["theme.css"] = buildTheme(site)
  files["style.css"] = buildCss()
  const base = site.domain ? `https://${site.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : ""
  const urls = [...own.map(pageHref), ...live.map(postHref)]
  files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join("\n")}\n</urlset>\n`
  files["robots.txt"] = `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`
  // Redirects: _redirects for hosts that read it (Cloudflare Pages, Netlify), and a small
  // page at the old address for hosts that don't (GitHub Pages).
  const redirects = site.redirects.filter((r) => r.from.trim() && r.to.trim())
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
    site: { name, domain: "", root: "", starter: t.starter, light: { ...s.light }, dark: { ...s.dark }, darkMode: true, customCss: "", footerText: "", redirects: [] },
    pages: t.pages.map((p, i) => ({ title: p.title, slug: p.slug, description: "", inMenu: true, order: i, sections: p.sections.map(section) })),
  }
}
