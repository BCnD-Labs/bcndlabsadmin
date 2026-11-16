import { createHash } from "node:crypto"
import { cleanPagePath, findRegions, htmlTitle, pagePaths, regionBody, regionText, replaceRegion, type AdoptedPageFile, type SiteScan } from "../../shared/site-adopt.ts"
import {
  DEFAULT_SITE,
  MARK_START,
  SLUG_RE,
  cleanPost,
  extractChrome,
  joinUrl,
  parseManifest,
  postPath,
  relativePath,
  renderPostPage,
  sortPosts,
  trimSlashes,
  updateIndexBlock,
  type ScheduledPost,
  type SiteChrome,
  type SiteMediaItem,
  type SiteOverview,
  type SitePage,
  type SitePost,
} from "../../shared/site.ts"
import { ProviderError, getJson, need } from "../http.ts"
import type { StoredConnection } from "../store.ts"
import type { TestResult } from "./index.ts"

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The "Website" connection: a static site deployed from a GitHub repository
 * (e.g. Azure Static Web Apps). Publishing commits files to the repository and
 * the site's own deploy picks them up. See shared/site.ts for the file layout.
 */
export interface SiteConfig {
  repo: string
  branch: string
  siteUrl: string
  postsDir: string
  imagesDir: string
  blogIndex: string
}

export function siteConfig(c: StoredConnection): SiteConfig {
  const repo = need(c.config.repo, "Repository").replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "")
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new ProviderError("Repository must look like owner/name", 400)
  return {
    repo,
    branch: c.config.branch || DEFAULT_SITE.branch,
    siteUrl: (c.config.siteUrl || "").replace(/\/+$/, ""),
    postsDir: trimSlashes(c.config.postsDir || DEFAULT_SITE.postsDir),
    imagesDir: trimSlashes(c.config.imagesDir || DEFAULT_SITE.imagesDir),
    blogIndex: trimSlashes(c.config.blogIndex || DEFAULT_SITE.blogIndex),
  }
}

type Change = { path: string; content: string | Buffer } | { path: string; delete: true }
/** A post page to (re)render from the updated post list before committing. */
type PostChange = Change | { path: string; render: string }

/** The handful of GitHub REST calls publishing needs. */
export class Repo {
  private readonly headers: Record<string, string>
  readonly repo: string
  readonly branch: string
  constructor(token: string, repo: string, branch: string) {
    this.repo = repo
    this.branch = branch
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "blackwall-admin",
    }
  }

  call<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
    return getJson<T>(
      `https://api.github.com/repos/${this.repo}${path}`,
      { method, headers: { ...this.headers, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined },
      "GitHub",
    )
  }

  /** A text file's contents, or null if it doesn't exist. */
  async read(path: string): Promise<string | null> {
    const raw = await this.raw(path)
    return raw ? raw.body.toString("utf8") : null
  }

  /** A file's bytes (any size), or null if it doesn't exist. */
  async raw(path: string): Promise<{ body: Buffer; type: string } | null> {
    let res: Response
    try {
      res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`, {
        headers: { ...this.headers, Accept: "application/vnd.github.raw" },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (e) {
      throw new ProviderError(`GitHub failed: ${(e as Error).message}`)
    }
    if (res.status === 404) return null
    if (!res.ok) throw new ProviderError(`GitHub: HTTP ${res.status} reading ${path}`, res.status === 401 || res.status === 403 ? 401 : 502)
    return { body: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "application/octet-stream" }
  }

  /** Directory listing (files only), or [] if the directory doesn't exist. */
  async list(dir: string): Promise<{ path: string; name: string; size: number }[]> {
    try {
      const items = await this.call<any[]>(`/contents/${encodePath(dir)}?ref=${encodeURIComponent(this.branch)}`)
      return Array.isArray(items) ? items.filter((i) => i.type === "file").map((i) => ({ path: i.path, name: i.name, size: i.size })) : []
    } catch (e) {
      if (String((e as Error).message).includes("HTTP 404")) return []
      throw e
    }
  }

  /** Every file path in the branch. */
  async tree(): Promise<string[]> {
    const t = await this.call<any>(`/git/trees/${encodeURIComponent(this.branch)}?recursive=1`)
    return (t.tree ?? []).filter((e: any) => e.type === "blob").map((e: any) => e.path as string)
  }

  /** Writes and deletes several files as one commit on the branch. Retries once if the branch moved meanwhile. */
  async commit(message: string, changes: Change[], attempt = 1): Promise<string> {
    const ref = await this.call<any>(`/git/ref/heads/${encodeURIComponent(this.branch)}`)
    const head: string = ref.object.sha
    const base = await this.call<any>(`/git/commits/${head}`)
    const tree = []
    for (const c of changes) {
      if ("delete" in c) {
        tree.push({ path: c.path, mode: "100644", type: "blob", sha: null })
        continue
      }
      const content = Buffer.isBuffer(c.content) ? c.content : Buffer.from(c.content, "utf8")
      const blob = await this.call<any>("/git/blobs", "POST", { content: content.toString("base64"), encoding: "base64" })
      tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha })
    }
    const newTree = await this.call<any>("/git/trees", "POST", { base_tree: base.tree.sha, tree })
    const commit = await this.call<any>("/git/commits", "POST", { message, tree: newTree.sha, parents: [head] })
    try {
      await this.call(`/git/refs/heads/${encodeURIComponent(this.branch)}`, "PATCH", { sha: commit.sha })
    } catch (e) {
      if (attempt < 2 && /HTTP 422/.test((e as Error).message)) return this.commit(message, changes, attempt + 1)
      throw e
    }
    return commit.sha
  }
}

const encodePath = (p: string) => trimSlashes(p).split("/").map(encodeURIComponent).join("/")

export function repoFor(c: StoredConnection) {
  const cfg = siteConfig(c)
  return { cfg, repo: new Repo(need(c.secrets.token, "GitHub token"), cfg.repo, cfg.branch) }
}

export async function testWebsite(c: StoredConnection): Promise<TestResult> {
  const { cfg, repo } = repoFor(c)
  const info = await repo.call<any>("")
  await repo.call(`/branches/${encodeURIComponent(cfg.branch)}`)
  const index = await repo.read(cfg.blogIndex)
  const manifest = parseManifest(await repo.read(`${cfg.postsDir}/index.json`))
  const canPush = info.permissions?.push !== false
  const summary = [
    { label: "Repository", value: `${info.full_name} (${cfg.branch})` },
    { label: "Site", value: cfg.siteUrl || "Add the site URL so previews and links work" },
    { label: "Published posts", value: String(manifest.posts.length) },
    {
      label: "Blog index",
      value: index === null ? `${cfg.blogIndex} not found` : index.includes(MARK_START) ? `${cfg.blogIndex}: lists your posts` : `${cfg.blogIndex}: add the marker comments to list posts there`,
    },
  ]
  if (!canPush) return { status: "error", account: info.full_name, message: "This token can read the repository but not write to it. Give it Contents: Read and write.", summary }
  return { status: "ok", account: info.full_name, summary }
}

// --- reading -------------------------------------------------------------------

const chromeCache = new Map<string, { at: number; chrome: SiteChrome }>()

export async function siteChrome(c: StoredConnection): Promise<SiteChrome> {
  const { cfg, repo } = repoFor(c)
  const key = `${cfg.repo}@${cfg.branch}:${cfg.blogIndex}`
  const hit = chromeCache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.chrome
  const html = (await repo.read(cfg.blogIndex)) ?? ""
  const chrome = extractChrome(html, cfg.blogIndex)
  chromeCache.set(key, { at: Date.now(), chrome })
  return chrome
}

/** "pages/about/about.html" → "About", "index.html" → "Home". */
function pageTitle(path: string) {
  const parts = path.split("/")
  const file = parts.at(-1)!.replace(/\.html?$/, "")
  const name = file === "index" ? (parts.length > 1 ? parts.at(-2)! : "Home") : file
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

export async function siteOverview(c: StoredConnection, scheduled: ScheduledPost[]): Promise<SiteOverview> {
  const { cfg, repo } = repoFor(c)
  const [manifestText, files, index] = await Promise.all([repo.read(`${cfg.postsDir}/index.json`), repo.tree(), repo.read(cfg.blogIndex)])
  // Top-level pages only (depth ≤ 3), not posts or coursework sub-pages.
  const pages: SitePage[] = files
    .filter((p) => /\.html?$/.test(p) && p.split("/").length <= 3 && !p.startsWith(`${cfg.postsDir}/`))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, 24)
    .map((p) => ({ path: p, title: pageTitle(p), url: cfg.siteUrl ? joinUrl(cfg.siteUrl, p) : "" }))
  return {
    siteUrl: cfg.siteUrl,
    repo: cfg.repo,
    branch: cfg.branch,
    blogUrl: cfg.siteUrl ? joinUrl(cfg.siteUrl, cfg.blogIndex) : "",
    postsUrl: cfg.siteUrl ? joinUrl(cfg.siteUrl, cfg.postsDir) : "",
    posts: sortPosts(parseManifest(manifestText).posts),
    scheduled,
    pages,
    indexMarkers: !!index?.includes(MARK_START),
  }
}

/**
 * Reads an adopted site's repository without writing anything: which pages it has (by file name, so one request
 * covers any number of pages), whether its blog index has the posts region, and how many posts Blackwall published.
 */
export async function scanSite(c: StoredConnection): Promise<SiteScan> {
  const { cfg, repo } = repoFor(c)
  const [manifestText, files, index] = await Promise.all([repo.read(`${cfg.postsDir}/index.json`), repo.tree(), repo.read(cfg.blogIndex)])
  const { paths, more } = pagePaths(files, cfg.postsDir)
  return {
    repo: cfg.repo,
    branch: cfg.branch,
    siteUrl: cfg.siteUrl,
    pages: paths.map((p) => ({ path: p, title: pageTitle(p), url: cfg.siteUrl ? joinUrl(cfg.siteUrl, p) : "" })),
    morePages: more,
    postsDir: cfg.postsDir,
    imagesDir: cfg.imagesDir,
    blogIndex: cfg.blogIndex,
    blogIndexFound: index !== null,
    indexMarkers: !!findRegions(index ?? "").some((r) => r.name === "posts"),
    posts: parseManifest(manifestText).posts.length,
  }
}

/** The fingerprint a client must send back to change a file: it proves they saw the file as it is now. */
export const fingerprint = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 24)

/** One hand-written page, as it is in the repository now, with its marked regions. */
export async function readAdoptedPage(c: StoredConnection, rawPath: string): Promise<AdoptedPageFile> {
  const path = cleanPagePath(rawPath)
  if (!path) throw new ProviderError("That isn't a page of the site", 400)
  const { repo } = repoFor(c)
  const html = await repo.read(path)
  if (html === null) throw new ProviderError("That page isn't in the repository", 404)
  return { path, html, title: htmlTitle(html) || pageTitle(path), sha: fingerprint(html), regions: findRegions(html).map((r) => ({ name: r.name, text: regionText(r) })) }
}

/**
 * Changes the text inside one marked region of one page, and nothing else. The file is read again first:
 * if it is no longer what the editor showed (the owner pushed from somewhere else), nothing is written.
 */
export async function saveRegion(c: StoredConnection, rawPath: string, name: string, content: string, baseSha: string) {
  const page = await readAdoptedPage(c, rawPath)
  if (page.sha !== baseSha) throw new ProviderError("This page was changed somewhere else since you opened it. Reload it to see the new version; nothing was saved.", 409)
  const region = findRegions(page.html).find((r) => r.name === name)
  if (!region) throw new ProviderError(`This page has no “${name}” region any more, so nothing was saved.`, 409)
  const next = replaceRegion(page.html, name, regionBody(region, content))
  if (next === null || next === page.html) return { ...page, changed: false as const }
  const { repo } = repoFor(c)
  const sha = await repo.commit(`Edit “${name}” on ${page.path} (via Blackwall)`, [{ path: page.path, content: next }])
  return { ...(await readAdoptedPage(c, page.path)), changed: true as const, commit: sha }
}

export async function siteMedia(c: StoredConnection): Promise<SiteMediaItem[]> {
  const { cfg, repo } = repoFor(c)
  const files = await repo.list(cfg.imagesDir)
  return files
    .filter((f) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f.name))
    .map((f) => ({ path: `/${f.path}`, name: f.name, size: f.size, url: cfg.siteUrl ? joinUrl(cfg.siteUrl, f.path) : "" }))
    .sort((a, b) => b.name.localeCompare(a.name))
}

/** Image bytes for previews of files that may not be deployed yet. Only inside the images folder. */
export async function siteRaw(c: StoredConnection, path: string) {
  const { cfg, repo } = repoFor(c)
  const clean = trimSlashes(path)
  if (!clean.startsWith(`${cfg.imagesDir}/`) || clean.includes("..")) throw new ProviderError("Not a site image", 400)
  return repo.raw(clean)
}

// --- writing -------------------------------------------------------------------

async function writePosts(c: StoredConnection, message: string, mutate: (posts: SitePost[]) => { posts: SitePost[]; changes: PostChange[] }) {
  const { cfg, repo } = repoFor(c)
  const manifestPath = `${cfg.postsDir}/index.json`
  const [manifestText, index, chrome] = await Promise.all([repo.read(manifestPath), repo.read(cfg.blogIndex), siteChrome(c)])
  const { posts, changes } = mutate(parseManifest(manifestText).posts)
  const blogHref = `/${cfg.blogIndex}`
  const all: Change[] = changes.map((ch) => {
    if (!("render" in ch)) return ch
    const post = posts.find((p) => p.slug === ch.render)!
    return { path: ch.path, content: renderPostPage(post, chrome, blogHref) }
  })
  all.push({ path: manifestPath, content: `${JSON.stringify({ version: 1, posts: sortPosts(posts) }, null, 2)}\n` })
  if (index) {
    const next = updateIndexBlock(index, posts, (p) => relativePath(cfg.blogIndex, postPath(cfg.postsDir, p.slug)))
    if (next !== null && next !== index) all.push({ path: cfg.blogIndex, content: next })
  }
  await repo.commit(message, all)
  return { posts: sortPosts(posts) }
}

/** Publishes or updates a post. `previousSlug` renames it: the old page is removed in the same commit. */
export async function publishPost(c: StoredConnection, input: Partial<SitePost>, previousSlug?: string) {
  let post: SitePost
  try {
    post = cleanPost(input)
  } catch (e) {
    throw new ProviderError((e as Error).message, 400)
  }
  if (previousSlug && !SLUG_RE.test(previousSlug)) throw new ProviderError("Bad previous slug", 400)
  const { cfg, repo } = repoFor(c)
  const before = parseManifest(await repo.read(`${cfg.postsDir}/index.json`)).posts
  const updating = before.some((p) => p.slug === (previousSlug ?? post.slug))
  const result = await writePosts(c, `${updating ? "Update" : "Publish"} post: ${post.title} (via Blackwall)`, (posts) => {
    const old = posts.find((p) => p.slug === (previousSlug ?? post.slug))
    if (old) {
      post.date = old.date
      post.updated = new Date().toISOString()
    }
    if (posts.some((p) => p.slug === post.slug && p !== old)) throw new ProviderError(`Another post already uses ${post.slug}`, 409)
    const changes: PostChange[] = [{ path: postPath(cfg.postsDir, post.slug), render: post.slug }]
    if (old && old.slug !== post.slug) changes.push({ path: postPath(cfg.postsDir, old.slug), delete: true })
    return { posts: [...posts.filter((p) => p !== old), post], changes }
  })
  return { ...result, post, url: cfg.siteUrl ? joinUrl(cfg.siteUrl, postPath(cfg.postsDir, post.slug)) : "" }
}

/** Takes a post off the site: its page, its manifest entry and its card in the blog index. */
export async function unpublishPost(c: StoredConnection, slug: string) {
  if (!SLUG_RE.test(slug)) throw new ProviderError("Bad slug", 400)
  const { cfg } = repoFor(c)
  return writePosts(c, `Remove post: ${slug} (via Blackwall)`, (posts) => {
    const old = posts.find((p) => p.slug === slug)
    if (!old) throw new ProviderError("That post isn't published", 404)
    return { posts: posts.filter((p) => p !== old), changes: [{ path: postPath(cfg.postsDir, slug), delete: true }] }
  })
}

const IMAGE_TYPES: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", webp: "webp", avif: "avif", svg: "svg" }

/** Commits an image to the images folder and returns its site path. */
export async function uploadImage(c: StoredConnection, name: string, base64: string): Promise<SiteMediaItem> {
  const { cfg, repo } = repoFor(c)
  const ext = IMAGE_TYPES[(name.split(".").pop() ?? "").toLowerCase()]
  if (!ext) throw new ProviderError("Use a PNG, JPG, GIF, WebP, AVIF or SVG image", 400)
  const bytes = Buffer.from(base64, "base64")
  if (!bytes.length) throw new ProviderError("The image is empty", 400)
  if (bytes.length > 8 * 1024 * 1024) throw new ProviderError("Images can be up to 8 MB", 413)
  const stem =
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  const taken = new Set((await repo.list(cfg.imagesDir)).map((f) => f.name))
  let file = `${stem}.${ext}`
  for (let i = 2; taken.has(file); i++) file = `${stem}-${i}.${ext}`
  const path = `${cfg.imagesDir}/${file}`
  await repo.commit(`Add image: ${file} (via Blackwall)`, [{ path, content: bytes }])
  return { path: `/${path}`, name: file, size: bytes.length, url: cfg.siteUrl ? joinUrl(cfg.siteUrl, path) : "" }
}

export async function deleteImage(c: StoredConnection, path: string) {
  const { cfg, repo } = repoFor(c)
  const clean = trimSlashes(path)
  if (!clean.startsWith(`${cfg.imagesDir}/`) || clean.includes("..")) throw new ProviderError("Not a site image", 400)
  await repo.commit(`Remove image: ${clean.split("/").pop()} (via Blackwall)`, [{ path: clean, delete: true }])
}
