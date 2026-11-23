/**
 * Adopting an existing, hand-written site. Blackwall never rewrites a file it did not create, except for the
 * contents of regions the owner marked: an element carrying `data-region="NAME"`,
 *
 *   <div class="cards" data-region="posts"> ... </div>
 *
 * (older pages may mark one with a pair of comments instead, `<!-- blackwall:NAME --> ... <!-- /blackwall:NAME -->`, which still works).
 * Everything outside a region is the owner's and is shown read-only. The posts list is just a region named
 * `posts` (see shared/site.ts), so the blog index keeps working as before.
 */

export const REGION_NAME = /^[a-z][a-z0-9-]{0,39}$/

const START = /<!--\s*blackwall:([a-z][a-z0-9-]{0,39})\s*-->/g

export interface Region {
  /** An element carrying data-region, or the older pair of comments. */
  kind?: "attribute" | "comment"
  name: string
  /** Offset of the opening marker. */
  at: number
  /** Offsets of the text between the markers. */
  from: number
  to: number
  content: string
}


const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
const OPEN_REGION = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?\sdata-region=(["'])([a-z][a-z0-9-]{0,39})\2[^>]*>/g

/** The page with comments, scripts and styles blanked out (same length), so tags inside them are never mistaken for the page's own. */
function masked(html: string): string {
  return html.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, (m) => m.replace(/[^\n]/g, " "))
}

/** Where an element's contents end: the matching closing tag of the same name, counting nested ones. Null when it never closes. */
function closeOf(text: string, tag: string, from: number): number | null {
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
  tags.lastIndex = from
  let depth = 1
  for (let m = tags.exec(text); m; m = tags.exec(text)) {
    if (m[1]) depth--
    else if (!m[0].endsWith("/>")) depth++
    if (depth === 0) return m.index
  }
  return null
}

function attributeRegions(html: string): Region[] {
  const text = masked(html)
  const out: Region[] = []
  for (const m of text.matchAll(OPEN_REGION)) {
    const tag = m[1].toLowerCase()
    if (VOID.has(tag) || m[0].endsWith("/>")) continue
    const from = m.index + m[0].length
    const to = closeOf(text, tag, from)
    if (to !== null) out.push({ kind: "attribute", name: m[3], at: m.index, from, to, content: html.slice(from, to) })
  }
  return out
}

/** Every complete region in the page, in order. A region that never closes is ignored, and so is a repeated name. */
export function findRegions(html: string): Region[] {
  const all = [...commentRegions(html), ...attributeRegions(html)].sort((a, b) => a.at - b.at)
  return all.filter((r, i) => all.findIndex((x) => x.name === r.name) === i)
}

function commentRegions(html: string): Region[] {
  const out: Region[] = []
  for (const m of html.matchAll(START)) {
    const name = m[1]
    if (out.some((r) => r.name === name)) continue
    const from = m.index + m[0].length
    const end = new RegExp(`<!--\\s*/blackwall:${name}\\s*-->`, "g")
    end.lastIndex = from
    const close = end.exec(html)
    if (!close) continue
    out.push({ kind: "comment", name, at: m.index, from, to: close.index, content: html.slice(from, close.index) })
  }
  return out
}

/** Swaps the text between a region's markers. Returns null when the page has no such region, so the caller leaves the file alone. */
export function replaceRegion(html: string, name: string, content: string): string | null {
  const region = findRegions(html).find((r) => r.name === name)
  return region ? html.slice(0, region.from) + content + html.slice(region.to) : null
}

/** What the owner sees and edits for a region: the text between the markers, without the blank lines around it. */
export const regionText = (region: Pick<Region, "content">) => region.content.replace(/^\s*\n/, "").replace(/\n\s*$/, "")

/** Writes an edited region back with the same line breaks and indent the file had around it. */
export function regionBody(region: Pick<Region, "content">, text: string): string {
  const indent = /\n([ \t]*)$/.exec(region.content)?.[1] ?? ""
  const multiline = region.content.startsWith("\n") || region.content.includes("\n") || text.includes("\n")
  if (!multiline) return text
  const lines = text.replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, "")
  return lines ? `\n${lines}\n${indent}` : `\n${indent}`
}

/** Pages Blackwall lists for an adopted site. Titles come from the file name until the page itself is opened. */
export interface AdoptedPage {
  /** Repo path, e.g. `pages/about/index.html`. */
  path: string
  title: string
  /** Address on the live site, when the site's address is known. */
  url: string
}

/** What a scan of the repository found. Nothing is written by a scan. */
export interface SiteScan {
  repo: string
  branch: string
  siteUrl: string
  pages: AdoptedPage[]
  /** More pages than were listed. */
  morePages: number
  postsDir: string
  imagesDir: string
  blogIndex: string
  /** Whether the blog index exists, and whether it has the posts region. */
  blogIndexFound: boolean
  indexMarkers: boolean
  posts: number
}

export interface AdoptedPageFile {
  path: string
  html: string
  title: string
  /** Fingerprint of the file as read. Saving a region sends it back, and a changed file is refused. */
  sha: string
  regions: { name: string; text: string }[]
  /** The page's own stylesheets from the repository, by repo path, so the preview can show them (the app's content policy won't load them from the site). */
  styles: Record<string, string>
}

export function htmlTitle(html: string): string {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""
  return raw.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()
}

/** Where a page file may live: an .html file inside the repo, never in a dot folder or node_modules. */
export function cleanPagePath(input: string): string | null {
  const path = String(input ?? "").replace(/^\/+/, "").replace(/\/{2,}/g, "/")
  if (!path || path.length > 300 || !/\.html?$/i.test(path)) return null
  const parts = path.split("/")
  if (parts.some((p) => !p || p === ".." || p.startsWith(".") || p === "node_modules" || /[\0<>:"\\|?*]/.test(p))) return null
  return path
}

/** Page files in a list of repo paths, shallowest first. Posts Blackwall publishes and the owner's tooling folders are left out. */
export function pagePaths(files: readonly string[], postsDir: string, limit = 200): { paths: string[]; more: number } {
  const posts = postsDir ? `${postsDir.replace(/^\/+|\/+$/g, "")}/` : ""
  const all = files
    .filter((p) => cleanPagePath(p) === p && !(posts && p.startsWith(posts)))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
  return { paths: all.slice(0, limit), more: Math.max(0, all.length - limit) }
}

const LINK = /<link\b[^>]*>/gi
const isSheet = (tag: string) => /\brel=["']?[^"'>]*stylesheet/i.test(tag)
const hrefOf = (tag: string) => /\bhref=(["'])([^"']*)\1/i.exec(tag)?.[2]

/** Where a page's relative link points inside the repository, or null for an outside address. */
export function repoPathOf(pagePath: string, href: string): string | null {
  if (!href || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return null
  const clean = href.split(/[?#]/)[0]
  const parts = clean.startsWith("/") ? [] : pagePath.split("/").slice(0, -1)
  for (const seg of clean.split("/")) {
    if (!seg || seg === ".") continue
    if (seg === "..") { if (!parts.length) return null; parts.pop() } else parts.push(seg)
  }
  return parts.length ? parts.join("/") : null
}

/** The repo paths of the stylesheets a page links to (its own, relative ones). */
export function stylesheetPaths(html: string, pagePath: string): string[] {
  const out = new Set<string>()
  for (const tag of html.match(LINK) ?? []) {
    const p = isSheet(tag) ? repoPathOf(pagePath, hrefOf(tag) ?? "") : null
    if (p && /\.css$/i.test(p)) out.add(p)
  }
  return [...out]
}

/**
 * A hand-written page made safe to show in a preview frame. The site's scripts are removed (the frame doesn't run them anyway),
 * its own stylesheets are put in the page as `<style>` (the app's content policy won't load them from the site), and when the
 * site's address is known relative pictures and links point at the live site. (A `<base href>` would be simpler, but the
 * policy forbids it.)
 */
export function adoptedPreview(html: string, siteUrl: string, path: string, styles: Record<string, string> = {}): string {
  const dir = path.split("/").slice(0, -1).join("/")
  const base = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/${dir ? `${dir}/` : ""}` : ""
  let clean = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
  clean = clean.replace(LINK, (tag) => {
    const css = isSheet(tag) ? styles[repoPathOf(path, hrefOf(tag) ?? "") ?? ""] : undefined
    return css === undefined ? tag : `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`
  })
  if (base) {
    clean = clean.replace(/\b(href|src|poster)=(["'])([^"']*)\2/gi, (all, a: string, q: string, url: string) => {
      if (!url || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return all
      try {
        return `${a}=${q}${new URL(url, base).href}${q}`
      } catch {
        return all
      }
    })
  }
  const head = /<head\b[^>]*>/i.exec(clean)
  const extra = '<base target="_blank">'
  return head ? clean.slice(0, head.index + head[0].length) + extra + clean.slice(head.index + head[0].length) : extra + clean
}

/**
 * The blog page with an empty posts list added: one new element before the end of `<main>` (or the page), and nothing else touched.
 * Whatever the owner already has on the page stays exactly as written. Returns null when the page already has a posts region.
 */
export function addPostsRegion(html: string): string | null {
  if (findRegions(html).some((r) => r.name === "posts")) return null
  const text = masked(html)
  const close = /<\/main\s*>/i.exec(text) ?? /<\/body\s*>/i.exec(text)
  const element = '<div data-region="posts"></div>'
  if (!close) return `${html}${html.endsWith("\n") || !html ? "" : "\n"}${element}\n`
  const lineStart = html.lastIndexOf("\n", close.index) + 1
  const lead = html.slice(lineStart, close.index)
  if (/\S/.test(lead)) return `${html.slice(0, close.index)}${element}${html.slice(close.index)}`
  return `${html.slice(0, lineStart)}${lead}  ${element}\n${html.slice(lineStart)}`
}

/** The open elements around a position, innermost last, found by walking the page's tags. */
function openAround(text: string, at: number): { tag: string; start: number; end: number }[] {
  const stack: { tag: string; start: number; end: number }[] = []
  for (const m of text.slice(0, at).matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)) {
    const tag = m[2].toLowerCase()
    if (VOID.has(tag) || m[0].endsWith("/>")) continue
    if (m[1]) { const i = stack.map((x) => x.tag).lastIndexOf(tag); if (i >= 0) stack.length = i } else stack.push({ tag, start: m.index, end: m.index + m[0].length })
  }
  return stack
}

/**
 * Replaces one pair of older comment markers by the same region as an attribute on the element that holds it, when that element holds
 * nothing but the region. Everything else on the page is byte-for-byte as it was. Returns null when the page has no such pair or
 * the markers share their element with other content (those are left alone rather than guessed at).
 */
export function migrateMarkers(html: string, name: string): string | null {
  const region = commentRegions(html).find((r) => r.name === name)
  if (!region || attributeRegions(html).some((r) => r.name === name)) return null
  const text = masked(html)
  const parent = openAround(text, region.at).at(-1)
  if (!parent) return null
  const closeMarker = new RegExp(`<!--\\s*/blackwall:${name}\\s*-->`).exec(html.slice(region.to))
  if (!closeMarker) return null
  const afterMarker = region.to + closeMarker[0].length
  const closeTag = closeOf(text, parent.tag, parent.end)
  if (closeTag === null || /\S/.test(text.slice(parent.end, region.at)) || /\S/.test(text.slice(afterMarker, closeTag))) return null
  const open = html.slice(parent.start, parent.end)
  const marked = open.replace(/\s*(\/?)>$/, ` data-region="${name}"$1>`)
  const lineStart = html.lastIndexOf("\n", region.at - 1) + 1
  const openFrom = /^[ \t]*$/.test(html.slice(lineStart, region.at)) ? lineStart : region.at
  const afterOpener = /^[ \t]*\r?\n/.exec(html.slice(region.from))?.[0].length ?? 0
  const closeAt = region.to
  const closeLineStart = html.lastIndexOf("\n", closeAt - 1) + 1
  const closeFrom = /^[ \t]*$/.test(html.slice(closeLineStart, closeAt)) ? closeLineStart : closeAt
  const closeTo = afterMarker + (/^[ \t]*\r?\n/.exec(html.slice(afterMarker))?.[0].length ?? 0)
  return html.slice(0, parent.start) + marked + html.slice(parent.end, openFrom) + html.slice(region.from + afterOpener, closeFrom) + html.slice(closeTo)
}

/** Names of regions still marked with the older comments. */
export const legacyRegions = (html: string) => commentRegions(html).filter((r) => !attributeRegions(html).some((a) => a.name === r.name)).map((r) => r.name)
