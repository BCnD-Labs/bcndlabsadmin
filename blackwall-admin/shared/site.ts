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
  /** The website connection it publishes to. Absent: the first one, as before sites could have their own. */
  connectionId?: string
  /** The last failed attempt, if publishing at the scheduled time didn't work. */
  error?: string
  triedAt?: string
}

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
  head: string
  header: string
  footer: string
  bodyClass: string
  siteName: string
}

export const MARK_START = "<!-- blackwall:posts -->"
export const MARK_END = "<!-- /blackwall:posts -->"
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
  return {
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

/** Minimal post styles, scoped to `.bw-post` so they only fill gaps the site's CSS leaves. */
const POST_CSS = `.bw-post{max-width:46rem}
.bw-post-meta{opacity:.75;margin:.25rem 0 1.25rem}
.bw-post-cover{display:block;width:100%;height:auto;border-radius:12px;margin:0 0 1.5rem}
.bw-post-body img{max-width:100%;height:auto;border-radius:8px}
.bw-post-body pre{overflow-x:auto;padding:1rem;border-radius:8px;background:rgba(127,127,127,.12)}
.bw-post-body blockquote{margin:1rem 0;padding-left:1rem;border-left:3px solid currentColor;opacity:.85}
.bw-post-back{display:inline-block;margin-bottom:.75rem}`

/** The full HTML page for a post. `blogHref` is the link back to the blog index (site-root path). */
export function renderPostPage(post: SitePost, chrome: SiteChrome, blogHref: string, opts: { baseHref?: string } = {}): string {
  const title = escapeHtml(post.title)
  const site = chrome.siteName ? ` — ${escapeHtml(chrome.siteName)}` : ""
  const tags = post.tags.filter(Boolean)
  return `<!doctype html>
<!--
  Published with Blackwall: ${escapeHtml(post.slug)}
  Edit this post in Blackwall (CMS → Posts). Changes made to this file directly
  are replaced the next time the post is updated there.
-->
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${opts.baseHref ? `<base href="${escapeHtml(opts.baseHref)}">` : ""}
    ${chrome.head}
    <title>${title}${site}</title>
    <meta name="description" content="${escapeHtml(post.excerpt)}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${escapeHtml(post.excerpt)}">
    ${post.cover ? `<meta property="og:image" content="${escapeHtml(post.cover)}">` : ""}
    <style>${POST_CSS}</style>
  </head>
  <body class="${escapeHtml([chrome.bodyClass, "page-post"].filter(Boolean).join(" "))}">
  ${chrome.header}
  <main>
    <section class="section">
      <div class="container">
        <a class="bw-post-back label" href="${escapeHtml(blogHref)}">← Blog</a>
        <article class="bw-post">
          ${tags.length ? `<ul class="chips">${tags.map((t) => `<li class="chip">${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
          <h1>${title}</h1>
          <p class="bw-post-meta"><time datetime="${escapeHtml(post.date)}">${formatPostDate(post.date)}</time></p>
          ${post.cover ? `<img class="bw-post-cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt ?? "")}">` : ""}
          <div class="bw-post-body">
${renderMarkdown(post.markdown)}
          </div>
        </article>
      </div>
    </section>
  </main>
  ${chrome.footer}
  </body>
</html>
`
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

/** One card in the blog index, in the same markup as the site's hand-written cards unless the site chose its own. */
export const postCard = renderCard

/** Newest first. */
export const sortPosts = (posts: SitePost[]) => [...posts].sort((a, b) => b.date.localeCompare(a.date))

/** The order of the blog list: featured posts first, then newest first. */
export const sortCards = (posts: SitePost[]) => [...posts].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.date.localeCompare(a.date))

/** Replaces the block between the markers. Returns null when the page has no markers (leave it alone). */
export function updateIndexBlock(html: string, posts: SitePost[], hrefFor: (p: SitePost) => string, template?: string): string | null {
  const region = findRegions(html).find((r) => r.name === "posts")
  if (!region) return null
  const indent = /([ \t]*)$/.exec(html.slice(0, region.at))?.[1] ?? ""
  const cards = sortCards(posts).map((p) => `${indent}${renderCard(p, hrefFor(p), template)}`)
  const body = cards.length ? `\n${cards.join("\n")}\n${indent}` : `\n${indent}`
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
