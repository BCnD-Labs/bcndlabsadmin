/**
 * Website publishing, shared by the server (which commits the files) and the
 * browser (which previews them). The site is a static site deployed from a
 * GitHub repository (Azure Static Web Apps rebuilds it on every push), so a
 * published post is three things in that repo:
 *
 *  - `<postsDir>/<slug>.html`: the post page, built from the site's own header
 *    and stylesheets so it looks like the rest of the site;
 *  - `<postsDir>/index.json`: Blackwall's list of published posts, including
 *    each post's Markdown so it can be edited again from any browser;
 *  - the blog index page: Blackwall rewrites only what sits between the two
 *    `blackwall:posts` marker comments, and leaves the file alone without them.
 */
import { Marked } from "marked"
import { findRegions } from "./site-adopt.ts"

export interface SitePost {
  slug: string
  title: string
  excerpt: string
  tags: string[]
  /** Site-root path of the cover image, e.g. `/assets/blog_images/cover.png`. */
  cover?: string
  coverAlt?: string
  /** Publish time (ISO). */
  date: string
  updated?: string
  markdown: string
  /** Groups the site's own script can filter by. A post may have several. Optional: older posts have none. */
  categories?: string[]
  /** Shown before other posts in the blog list. */
  featured?: boolean
  /** A small picture for list cards (site-root path), apart from the cover on the post itself. */
  thumbnail?: string
  thumbnailAlt?: string
}

export interface SiteManifest {
  version: 1
  posts: SitePost[]
}

export interface ScheduledPost {
  post: SitePost
  publishAt: string
  createdAt: string
  /** What the schedule is filed under when two sites can use the same post address. Absent: the post's slug, as before. */
  key?: string
  /** A Pagesmith post: the site and the draft to publish (the whole site is published with it). */
  siteId?: string
  draftId?: string
  /** "pr": open a pull request instead of committing to the live branch. */
  mode?: "direct" | "pr"
  /** It ran after its time because the server wasn't running then. */
  late?: boolean
  /** The website connection it publishes to. Absent: the first one, as before sites could have their own. */
  connectionId?: string
  /** The last failed attempt, if publishing at the scheduled time didn't work. */
  error?: string
  triedAt?: string
}

export const scheduleKey = (s: Pick<ScheduledPost, "key" | "post">) => s.key ?? s.post.slug

export interface SitePage {
  /** Repo path, e.g. `pages/about/about.html`. */
  path: string
  title: string
  url: string
}

export interface SiteMediaItem {
  /** Site-root path, e.g. `/assets/blog_images/cover.png`. */
  path: string
  name: string
  size: number
  url: string
}

export interface SiteOverview {
  siteUrl: string
  repo: string
  branch: string
  blogUrl: string
  /** Where post pages live, e.g. `https://example.com/pages/blog/posts`. */
  postsUrl: string
  posts: SitePost[]
  scheduled: ScheduledPost[]
  pages: SitePage[]
  /** Whether the blog index has the marker comments, i.e. whether posts get listed there. */
  indexMarkers: boolean
}

/** Pieces of the site's own markup reused for post pages (URLs already site-root relative). */
export interface SiteChrome {
  /** The page's own language ("en"); posts are written in the same one. */
  lang?: string
  head: string
  header: string
  footer: string
  bodyClass: string
  siteName: string
}

/** What a blog page needs for posts to be listed on it: an element Blackwall may fill with the post cards. */
export const POSTS_REGION = '<div data-region="posts"></div>'
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const DEFAULT_SITE = {
  branch: "main",
  postsDir: "pages/blog/posts",
  imagesDir: "assets/blog_images",
  blogIndex: "pages/blog/blog.html",
}

const md = new Marked({ gfm: true, breaks: false })

export function renderMarkdown(source: string): string {
  return md.parse(source, { async: false })
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

export const trimSlashes = (p: string) => p.replace(/^\/+|\/+$/g, "")

export const postPath = (postsDir: string, slug: string) => `${trimSlashes(postsDir)}/${slug}.html`

export const joinUrl = (base: string, path: string) => `${base.replace(/\/+$/, "")}/${trimSlashes(path)}`

/** Relative link from one repo file to another, e.g. `pages/blog/blog.html` → `pages/blog/posts/a.html` = `posts/a.html`. */
export function relativePath(fromFile: string, toFile: string): string {
  const from = trimSlashes(fromFile).split("/").slice(0, -1)
  const to = trimSlashes(toFile).split("/")
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...Array(from.length - i).fill(".."), ...to.slice(i)].join("/")
}

const isExternal = (u: string) => /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u)

/** Rewrites relative href/src attributes in `html` so they work from any page (site-root relative). */
function rootRelative(html: string, fromFile: string): string {
  return html.replace(/\b(href|src)=(["'])([^"']*)\2/gi, (all, attr: string, q: string, url: string) => {
    if (!url || isExternal(url)) return all
    const abs = new URL(url, `https://site.invalid/${trimSlashes(fromFile)}`)
    return `${attr}=${q}${abs.pathname}${abs.search}${abs.hash}${q}`
  })
}

/** The blog link is "current" on the blog index, but not on a post page. */
const NOT_CURRENT = /\s*aria-current=["'][^"']*["']/g

/** Takes the stylesheet/font/icon links, header and footer from a page of the site (normally the blog index). */
export function extractChrome(html: string, fromFile: string): SiteChrome {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? ""
  const links = (head.match(/<link\b[^>]*>/gi) ?? []).filter((l) => /rel=["']?(stylesheet|preconnect|icon|shortcut icon)/i.test(l))
  const header = /<header\b[^>]*>[\s\S]*?<\/header>/i.exec(html)?.[0] ?? ""
  const footer = /<footer\b[^>]*>[\s\S]*?<\/footer>/i.exec(html)?.[0] ?? ""
  const title = /<title>([^<]*)<\/title>/i.exec(head)?.[1] ?? ""
  const bodyClass = /<body[^>]*\bclass=["']([^"']*)["']/i.exec(html)?.[1] ?? ""
  const lang = /<html[^>]*\blang=["']([A-Za-z0-9-]{2,12})["']/i.exec(html)?.[1]
  return {
    ...(lang ? { lang } : {}),
    head: rootRelative(links.join("\n    "), fromFile),
    header: rootRelative(header, fromFile).replace(NOT_CURRENT, ""),
    footer: rootRelative(footer, fromFile).replace(NOT_CURRENT, ""),
    bodyClass,
    // "Blog — BCnDNS_Labs" → "BCnDNS_Labs"
    siteName: title.split(/\s[—–|-]\s/).at(-1)?.trim() || "",
  }
}

/** Used when the site isn't connected: previews still render, just without the site's own styles. */
export const FALLBACK_CHROME: SiteChrome = { head: "", header: "", footer: "", bodyClass: "", siteName: "" }

export function formatPostDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

/**
 * The default look of a post page, written once to `post.css` next to the posts. It only fills gaps the site's own stylesheet leaves;
 * after it is written it belongs to the site, which is free to change it.
 */
export const POST_CSS = `.post {
  max-width: 46rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.post-back {
  display: inline-block;
  margin-bottom: 0.75rem;
}

.post-meta {
  margin: 0.25rem 0 1.25rem;
  opacity: 0.75;
}

.post-cover {
  display: block;
  width: 100%;
  height: auto;
  margin: 0 0 1.5rem;
  border-radius: 12px;
}

.post-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.post-content pre {
  overflow-x: auto;
  padding: 1rem;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.12);
}

.post-content blockquote {
  margin: 1rem 0;
  padding-left: 1rem;
  border-left: 3px solid currentColor;
  opacity: 0.85;
}
`

/** The path a site is served under: "https://owner.github.io/site/" is "/site", the top of a domain is "". */
export function siteBase(siteUrl?: string): string {
  try {
    return new URL(siteUrl ?? "").pathname.replace(/\/+$/, "")
  } catch {
    return ""
  }
}

/**
 * A root path from the site ("/img/a.png", or with the site's own folder already in front: "/site/img/a.png") written as a link relative to
 * the file that contains it ("../../img/a.png"). Relative links work wherever the site is served, so nothing depends on the site's address
 * and a prefix can never be added twice. Anything that isn't a root path (a full address, "#top", an already-relative link) is returned as is.
 */
export function toRelative(url: string | undefined, fromFile: string, base = ""): string | undefined {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return url
  const [path, ...rest] = url.split(/(?=[?#])/)
  const tail = rest.join("")
  const at = base && (path.toLowerCase() === base.toLowerCase() || path.toLowerCase().startsWith(`${base.toLowerCase()}/`)) ? path.slice(base.length) : path
  const target = trimSlashes(at)
  const depth = trimSlashes(fromFile).split("/").length - 1
  if (!target) return `${depth ? "../".repeat(depth) : "./"}${tail}`
  const rel = relativePath(fromFile, target)
  return `${rel}${at.endsWith("/") ? "/" : ""}${tail}`
}

const LOCAL_ATTR = /\b(href|src|poster)=(["'])([^"']*)\2/gi

/** Every root-path link and picture in `html` made relative to `fromFile` (see `toRelative`). Other text is untouched. */
export function localize(html: string, fromFile: string, base = ""): string {
  return html.replace(LOCAL_ATTR, (_all, attr: string, q: string, url: string) => `${attr}=${q}${toRelative(url, fromFile, base)}${q}`)
}

/** Indents rendered Markdown to sit inside the page, leaving the text of code blocks exactly as written. */
function indentBody(html: string, pad = "          "): string {
  let inPre = false
  return html.split("\n").map((line) => {
    const out = inPre || !line ? line : pad + line
    if (/<pre[\s>]/.test(line)) inPre = true
    if (/<\/pre>/.test(line)) inPre = false
    return out
  }).join("\n")
}

/** A full address for a site path, for the few places that need one (social previews). Undefined without a site address. */
function absoluteUrl(siteUrl: string | undefined, path: string | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  if (!siteUrl) return undefined
  const base = siteBase(siteUrl)
  const rooted = path.startsWith("/") ? path : `/${path}`
  const at = base && rooted.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? rooted.slice(base.length) : rooted
  try {
    return new URL(`${base}${at}`, siteUrl).href
  } catch {
    return undefined
  }
}

/**
 * The full HTML page for a post. `blogHref` is the link back to the blog index (a root path).
 * With `file` (the post's path in the repository) every root-path link is written relative to that file; the page then works from any
 * address the site is served at. `inlineStyles` embeds the default look instead of linking `post.css`, for previews only.
 */
export function renderPostPage(post: SitePost, chrome: SiteChrome, blogHref: string, opts: { baseHref?: string; file?: string; siteUrl?: string; inlineStyles?: boolean } = {}): string {
  const title = escapeHtml(post.title)
  const site = chrome.siteName ? ` — ${escapeHtml(chrome.siteName)}` : ""
  const tags = post.tags.filter(Boolean)
  const here = (html: string) => (opts.file ? localize(html, opts.file, siteBase(opts.siteUrl)) : html)
  const back = opts.file ? toRelative(blogHref, opts.file, siteBase(opts.siteUrl)) : blogHref
  const cover = opts.file ? toRelative(post.cover, opts.file, siteBase(opts.siteUrl)) : post.cover
  const share = absoluteUrl(opts.siteUrl, post.cover)
  const lines = [
    "<!doctype html>",
    `<html lang="${escapeHtml(chrome.lang ?? "en")}">`,
    "  <head>",
    '    <meta charset="utf-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    ...(opts.baseHref ? [`    <base href="${escapeHtml(opts.baseHref)}">`] : []),
    `    <title>${title}${site}</title>`,
    `    <meta name="description" content="${escapeHtml(post.excerpt)}">`,
    `    <meta property="og:title" content="${title}">`,
    `    <meta property="og:description" content="${escapeHtml(post.excerpt)}">`,
    ...(share ? [`    <meta property="og:image" content="${escapeHtml(share)}">`] : []),
    ...(chrome.head.trim() ? [`    ${here(chrome.head)}`] : []),
    opts.inlineStyles ? `    <style>${POST_CSS}</style>` : '    <link rel="stylesheet" href="post.css">',
    "  </head>",
    `  <body${[chrome.bodyClass, "page-post"].filter(Boolean).length ? ` class="${escapeHtml([chrome.bodyClass, "page-post"].filter(Boolean).join(" "))}"` : ""}>`,
    ...(chrome.header.trim() ? [`    ${here(chrome.header)}`] : []),
    "    <main>",
    '      <article class="post">',
    `        <a class="post-back" href="${escapeHtml(back ?? blogHref)}">← Blog</a>`,
    ...(tags.length ? [`        <ul class="chips">${tags.map((t) => `<li class="chip">${escapeHtml(t)}</li>`).join("")}</ul>`] : []),
    `        <h1>${title}</h1>`,
    `        <p class="post-meta"><time datetime="${escapeHtml(post.date)}">${formatPostDate(post.date)}</time></p>`,
    ...(cover ? [`        <img class="post-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(post.coverAlt ?? "")}">`] : []),
    '        <div class="post-content">',
    indentBody(here(renderMarkdown(post.markdown)).trim()),
    "        </div>",
    "      </article>",
    "    </main>",
    ...(chrome.footer.trim() ? [`    ${here(chrome.footer)}`] : []),
    "  </body>",
    "</html>",
  ]
  return `${lines.join("\n")}\n`
}

const FILENAME_ALT = /\.(png|jpe?g|gif|webp|avif|svg)$|^(img|image|photo|picture|pic|thumb|thumbnail|screenshot|dsc|untitled)[-_ ]?\d*$/i

/**
 * Pictures in a post whose description is missing or just a file name, in plain words. Empty is allowed for decoration, so this only
 * asks; the owner decides. A cover with no description is listed too; a thumbnail may be decorative and is not.
 */
export function imageNotes(post: Pick<SitePost, "markdown" | "cover" | "coverAlt">): string[] {
  const notes: string[] = []
  for (const m of post.markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)) {
    const alt = m[1].trim()
    const file = m[2].split("/").pop() ?? m[2]
    if (!alt) notes.push(`The picture ${file} has no description. That is fine if it is only decoration; otherwise describe it for people who can't see it.`)
    else if (FILENAME_ALT.test(alt) || alt.toLowerCase() === file.replace(/\.[^.]+$/, "").toLowerCase()) notes.push(`The picture ${file} is described as “${alt}”, which looks like a file name. Describe what it shows.`)
  }
  if (post.cover && !post.coverAlt?.trim()) notes.push("The cover picture has no description. Add one unless it is only decoration.")
  return notes
}

/** The kebab-case form of a category, safe in an attribute and easy for a site's own script to match: "Case Study" → "case-study". */
export const categorySlug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

const clean = (list: unknown, max = 40) => [...new Set((Array.isArray(list) ? list : []).map((t) => String(t).trim().slice(0, max)).filter(Boolean))]

/** What a card template may contain, with one plain line for each, shown beside the editor. */
export const CARD_TOKENS: { token: string; about: string }[] = [
  { token: "title", about: "The post's title, as text." },
  { token: "excerpt", about: "The one-line summary, as text." },
  { token: "excerptP", about: "The summary as a paragraph, or nothing when there is none." },
  { token: "thumb", about: "The thumbnail picture, or nothing when there is none." },
  { token: "chips", about: "A list of chips: categories first, then tags. Nothing when there are none." },
  { token: "href", about: "The address of the post page." },
  { token: "slug", about: "The post's address name." },
  { token: "date", about: "The publish date and time (ISO)." },
  { token: "categories", about: "The categories as space-separated names (\"case-study web\"), for a data-category attribute." },
  { token: "featured", about: "\"true\" or \"false\"." },
  { token: "attrs", about: "Ready-made attributes for the card's outer tag: data-category and data-featured, only when the post has them." },
]

/** The card Blackwall has always made. A site that has not chosen a template gets exactly this. */
export const DEFAULT_CARD_TEMPLATE = `<article class="card card--mini" id="post-{{slug}}"{{attrs}}>
  {{thumb}}{{chips}}
  <h3>{{title}}</h3>
  {{excerptP}}
  <div class="card-links"><a href="{{href}}">Read post ↗</a></div>
</article>`

const TOKEN = /\{\{\s*([A-Za-z]+)\s*\}\}/g

/** Problems with a card template, in plain words. An empty list means it can be used. */
export function cardIssues(template: string): string[] {
  const out: string[] = []
  if (!template.trim()) return ["The template is empty."]
  if (template.length > 4000) out.push("The template is longer than 4000 characters.")
  const unknown = [...new Set([...template.matchAll(TOKEN)].map((m) => m[1]).filter((k) => !CARD_TOKENS.some((t) => t.token === k)))]
  if (unknown.length) out.push(`Unknown ${unknown.length === 1 ? "token" : "tokens"}: ${unknown.map((k) => `{{${k}}}`).join(", ")}.`)
  if (!/\{\{\s*href\s*\}\}/.test(template)) out.push("Add {{href}} so the card links to the post.")
  if (/<\s*(script|iframe|object|embed)\b/i.test(template) || /\son[a-z]+\s*=/i.test(template)) out.push("Scripts and event handlers aren't allowed in a card.")
  return out
}

/** One card in the blog list, from the site's template (or the default one). Every value is escaped. */
export function renderCard(post: SitePost, href: string, template: string = DEFAULT_CARD_TEMPLATE): string {
  const tags = clean(post.tags)
  const categories = clean(post.categories)
  const names = categories.map(categorySlug).filter(Boolean)
  const chips = [...categories.map((c) => `<li class="chip chip--category">${escapeHtml(c)}</li>`), ...tags.map((t) => `<li class="chip">${escapeHtml(t)}</li>`)]
  const values: Record<string, string> = {
    title: escapeHtml(post.title),
    excerpt: escapeHtml(post.excerpt),
    excerptP: post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : "",
    thumb: post.thumbnail ? `<img class="post-thumb" src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(post.thumbnailAlt ?? "")}" loading="lazy">` : "",
    chips: chips.length ? `<ul class="chips">${chips.join("")}</ul>` : "",
    href: escapeHtml(href),
    slug: escapeHtml(post.slug),
    date: escapeHtml(post.date),
    categories: escapeHtml(names.join(" ")),
    featured: post.featured ? "true" : "false",
    attrs: `${names.length ? ` data-category="${escapeHtml(names.join(" "))}"` : ""}${post.featured ? ' data-featured="true"' : ""}`,
  }
  return template.replace(TOKEN, (_all, k: string) => values[k] ?? "")
}

/**
 * The draft fields for a post that exists only on the site (published or scheduled), so opening it to edit keeps everything it has:
 * leaving out categories, Featured or the thumbnail would wipe them from the card the next time it is updated.
 */
export function draftFieldsFromPost(post: SitePost) {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.markdown,
    tags: post.tags,
    cover: post.cover,
    coverAlt: post.coverAlt,
    ...(post.categories?.length ? { categories: post.categories } : {}),
    ...(post.featured ? { featured: true } : {}),
    ...(post.thumbnail ? { thumbnail: post.thumbnail, thumbnailAlt: post.thumbnailAlt } : {}),
    remoteSlug: post.slug,
  }
}

/** One card in the blog index, in the same markup as the site's hand-written cards unless the site chose its own. */
export const postCard = renderCard

/** Newest first. */
export const sortPosts = (posts: SitePost[]) => [...posts].sort((a, b) => b.date.localeCompare(a.date))

/** The order of the blog list: featured posts first, then newest first. */
export const sortCards = (posts: SitePost[]) => [...posts].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.date.localeCompare(a.date))

/** A rendered card set at `indent`: continuation lines keep their layout relative to each other, empty lines (a token with nothing in it) are dropped. */
function reindent(card: string, indent: string): string {
  const [first, ...rest] = card.split("\n").filter((l, i) => i === 0 || l.trim())
  const depth = Math.min(...rest.map((l) => /^[ \t]*/.exec(l)![0].length), Infinity)
  return [first, ...rest.map((l) => l.slice(Number.isFinite(depth) ? depth : 0))].map((l, i) => (i === 0 ? `${indent}${l}` : `${indent}${l}`)).join("\n")
}

/** Replaces the block between the markers. Returns null when the page has no markers (leave it alone). */
export function updateIndexBlock(html: string, posts: SitePost[], hrefFor: (p: SitePost) => string, template?: string): string | null {
  const region = findRegions(html).find((r) => r.name === "posts")
  if (!region) return null
  // Cards sit one level inside the element that holds them, and its closing tag stays where it was; between two comments they line up with the comments.
  const lead = /(?:^|\n)([ \t]*)[^\n]*$/.exec(html.slice(0, region.at))?.[1] ?? ""
  const indent = region.kind === "attribute" ? `${lead}  ` : /([ \t]*)$/.exec(html.slice(0, region.at))?.[1] ?? ""
  const close = region.kind === "attribute" ? lead : indent
  const cards = sortCards(posts).map((p) => reindent(renderCard(p, hrefFor(p), template), indent))
  const body = cards.length ? `\n${cards.join("\n")}\n${close}` : `\n${close}`
  return html.slice(0, region.from) + body + html.slice(region.to)
}

export function parseManifest(text: string | null): SiteManifest {
  if (!text) return { version: 1, posts: [] }
  try {
    const m = JSON.parse(text) as Partial<SiteManifest>
    const posts = Array.isArray(m.posts) ? m.posts.filter((p): p is SitePost => !!p && typeof p.slug === "string" && SLUG_RE.test(p.slug)) : []
    return { version: 1, posts: posts.map((p) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], markdown: p.markdown ?? "", excerpt: p.excerpt ?? "", ...(p.categories !== undefined ? { categories: clean(p.categories) } : {}) })) }
  } catch {
    return { version: 1, posts: [] }
  }
}

/** Checks a post before it's published; returns a cleaned copy. */
export function cleanPost(input: Partial<SitePost>): SitePost {
  const slug = String(input.slug ?? "").trim()
  if (!SLUG_RE.test(slug)) throw new Error("The slug can only use lowercase letters, numbers and dashes")
  const title = String(input.title ?? "").trim().slice(0, 200)
  if (!title) throw new Error("A title is required")
  const cover = input.cover ? String(input.cover) : undefined
  if (cover && !/^\/[\w./-]+$/.test(cover)) throw new Error("The cover image must be a file on the site")
  const thumbnail = input.thumbnail ? String(input.thumbnail) : undefined
  if (thumbnail && !/^\/[\w./-]+$/.test(thumbnail)) throw new Error("The thumbnail must be a file on the site")
  const categories = clean(input.categories).slice(0, 6)
  const date = input.date && !Number.isNaN(Date.parse(input.date)) ? new Date(input.date).toISOString() : new Date().toISOString()
  return {
    slug,
    title,
    excerpt: String(input.excerpt ?? "").trim().slice(0, 500),
    tags: (Array.isArray(input.tags) ? input.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 8),
    cover,
    coverAlt: input.coverAlt ? String(input.coverAlt).slice(0, 200) : undefined,
    date,
    updated: input.updated,
    markdown: String(input.markdown ?? ""),
    ...(categories.length ? { categories } : {}),
    ...(input.featured ? { featured: true } : {}),
    ...(thumbnail ? { thumbnail, thumbnailAlt: input.thumbnailAlt ? String(input.thumbnailAlt).slice(0, 200) : undefined } : {}),
  }
}
