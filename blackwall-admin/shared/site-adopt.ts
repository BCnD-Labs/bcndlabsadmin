/**
 * Adopting an existing, hand-written site. Blackwall never rewrites a file it did not create, except for the
 * text inside marked regions the owner put there:
 *
 *   <!-- blackwall:NAME -->  ...  <!-- /blackwall:NAME -->
 *
 * Everything outside a region is the owner's and is shown read-only. The posts list is just a region named
 * `posts` (see shared/site.ts), so the blog index keeps working as before.
 */

export const REGION_NAME = /^[a-z][a-z0-9-]{0,39}$/

const START = /<!--\s*blackwall:([a-z][a-z0-9-]{0,39})\s*-->/g

export interface Region {
  name: string
  /** Offset of the opening marker. */
  at: number
  /** Offsets of the text between the markers. */
  from: number
  to: number
  content: string
}

export const regionStart = (name: string) => `<!-- blackwall:${name} -->`
export const regionEnd = (name: string) => `<!-- /blackwall:${name} -->`

/** Every complete region in the page, in order. A region without its closing marker is ignored, and so is a repeated name. */
export function findRegions(html: string): Region[] {
  const out: Region[] = []
  for (const m of html.matchAll(START)) {
    const name = m[1]
    if (out.some((r) => r.name === name)) continue
    const from = m.index + m[0].length
    const end = new RegExp(`<!--\\s*/blackwall:${name}\\s*-->`, "g")
    end.lastIndex = from
    const close = end.exec(html)
    if (!close) continue
    out.push({ name, at: m.index, from, to: close.index, content: html.slice(from, close.index) })
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
