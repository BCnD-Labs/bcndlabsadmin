import { buildSite } from "../shared/sitebuilder.ts"
import { trimSlashes } from "../shared/site.ts"
import type { Collections } from "../shared/workspace.ts"
import { ProviderError } from "./http.ts"
import { repoFor, withTarget } from "./providers/website.ts"
import { deliver, gitBlobSha, type DeliverOptions } from "./publish-plan.ts"
import type { ConnectionStore } from "./store.ts"
import { approvedComments } from "../shared/site-inbox.ts"
import { readInbox } from "./forms-inbox.ts"
import { dav } from "./providers/nextcloud.ts"
import { SITE_IMAGES_DIR, assetCloudPath, usedAssets } from "../shared/assets.ts"
import { siteOrigin } from "../shared/sitebuilder.ts"
import type { LivePage, LiveReport } from "../shared/site-live.ts"

/** Paths Blackwall generated last time, so files it no longer makes are removed (and nothing else is). */
const MANIFEST = ".blackwall-site.json"

/** The library pictures this site uses, read from Nextcloud. A picture that can't be read stops the publish, rather than putting a broken image on the site. */
async function pictureFiles(store: ConnectionStore, ws: Collections, siteId: string) {
  const used = usedAssets(ws.assets, siteId, ws.pages, ws.drafts)
  if (!used.length) return {}
  const cloud = await store.firstOk("nextcloud")
  if (!cloud) throw new ProviderError("This site uses pictures from your library, but Nextcloud isn't connected, so they can't be published.", 409)
  const out: Record<string, Buffer> = {}
  for (const asset of used) {
    try {
      out[`${SITE_IMAGES_DIR}/${asset.file}`] = Buffer.from(await (await dav(cloud, "GET", assetCloudPath(asset))).arrayBuffer())
    } catch (e) {
      throw new ProviderError(`Couldn't get the picture “${asset.name}” from Nextcloud, so nothing was published: ${(e as Error).message}`, 502)
    }
  }
  return out
}

/**
 * Builds a CMS site from the workspace and puts it in its repository as one commit (or one pull request): every page, published
 * post, stylesheet, sitemap and redirect. Files Blackwall made before but doesn't make now are deleted. A file Blackwall never made,
 * or one edited somewhere else since Blackwall wrote it, is never replaced unless the owner agreed (`acknowledge`) after seeing the
 * plan, and nothing is written if the branch moved since they reviewed it (`expectedHead`).
 */
export async function publishSite(store: ConnectionStore, ws: Collections, siteId: string, opts: DeliverOptions = {}) {
  const site = ws.sites.find((s) => s.id === siteId)
  if (!site) throw new ProviderError("That site doesn't exist", 404)
  if (site.adopted) throw new ProviderError("This site is run from its own files. Blackwall only changes the marked regions and the posts it publishes, so it doesn't rebuild or publish the whole site.", 409)
  // A site publishes only to the repository it was explicitly given, never to whichever connection happens to work first.
  if (!site.connectionId) throw new ProviderError("Choose the GitHub repository this site publishes to in Site settings. Nothing was published.", 409)
  const c = await store.get(site.connectionId)
  if (!c || c.provider !== "website") throw new ProviderError("This site's repository connection no longer exists. Choose another in Site settings. Nothing was published.", 409)
  const { cfg, repo } = repoFor(c)
  const delivery = await withTarget(cfg, repo, { ...opts, siteDomain: site.domain })
  const root = trimSlashes(site.root ?? "")
  const at = (p: string) => (root ? `${root}/${p}` : p)
  const comments = approvedComments(await readInbox(store), site.id)
  const files: Record<string, string | Buffer> = { ...buildSite(site, ws.pages, ws.drafts, ws.forms, comments, ws.assets), ...await pictureFiles(store, ws, site.id) }
  let previous: string[] = []
  let wrote: Record<string, string> = {}
  try {
    const m = JSON.parse((await repo.read(at(MANIFEST))) ?? "{}")
    previous = m.files ?? []
    wrote = m.hashes ?? {}
  } catch {
    previous = []
  }
  const paths = Object.keys(files).sort()
  const hashes = Object.fromEntries(paths.map((p) => [p, gitBlobSha(files[p])]))
  const gone = previous.filter((p) => !(p in files))
  const changes = [
    ...paths.map((p) => ({ path: at(p), content: files[p] })),
    ...gone.map((p) => ({ path: at(p), delete: true as const })),
    { path: at(MANIFEST), content: `${JSON.stringify({ generator: "Blackwall", site: site.name, files: paths, hashes }, null, 2)}\n` },
  ]
  // What Blackwall made last time, with the fingerprint it wrote ("" when an older publish didn't record one).
  const owned = new Map<string, string>([...previous.map((p) => [at(p), wrote[p] ?? ""] as [string, string]), [at(MANIFEST), ""]])
  const posts = ws.drafts.filter((d) => d.siteId === site.id && d.publishedAt).length
  const pages = ws.pages.filter((p) => p.siteId === site.id).length
  const message = `Update ${site.name}: ${pages} ${pages === 1 ? "page" : "pages"}, ${posts} ${posts === 1 ? "post" : "posts"}`
  const done = await deliver(repo, { message }, changes, owned, delivery)
  if (opts.plan) return { plan: done.plan }
  return {
    sha: done.committed?.sha ?? done.plan.head,
    /** Nothing differed from what is already in the repository. */
    unchanged: !done.committed,
    files: paths.length,
    removed: gone.length,
    removedPaths: gone,
    repo: cfg.repo,
    branch: done.committed?.branch ?? cfg.branch,
    pr: done.committed?.pr,
    plan: done.plan,
    url: site.domain ? `https://${site.domain.replace(/^https?:\/\//, "")}` : undefined,
  }
}

/** What identifies a page's content: its title and main area, ignoring whitespace and anything a host adds around them. */
function contentOf(html: string) {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""
  const main = /<main>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html
  return `${title}\n${main}`.replace(/\s+/g, " ").trim()
}

const addressOf = (file: string) => `/${file.replace(/(^|\/)index\.html$/, "$1")}`
const PAGE_LIMIT = 200

/**
 * Asks the real site whether it shows what was just published: every page is fetched and compared with what Blackwall built,
 * and pages removed by the publish should be gone. Hosts take a moment to deploy, so "not yet" is a normal answer.
 */
export async function checkLive(store: ConnectionStore, ws: Collections, siteId: string, removed: readonly string[]): Promise<LiveReport> {
  const site = ws.sites.find((s) => s.id === siteId)
  if (!site) throw new ProviderError("That site doesn't exist", 404)
  const origin = siteOrigin(site.domain)
  if (!origin) return { origin: "", pages: [], removed: [] }
  const files = buildSite(site, ws.pages, ws.drafts, ws.forms, approvedComments(await readInbox(store), site.id), ws.assets)
  const get = async (path: string) => {
    try {
      const res = await fetch(origin + path, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(10_000) })
      return { status: res.status, text: res.ok ? await res.text() : "" }
    } catch {
      return { status: 0, text: "" }
    }
  }
  const expected = Object.keys(files).filter((f) => f.endsWith(".html") && !/moved to/.test(files[f].slice(0, 400)) && !files[f].includes('http-equiv="refresh"')).slice(0, PAGE_LIMIT)
  const pages: LivePage[] = []
  for (const file of expected) {
    const path = addressOf(file), got = await get(path)
    pages.push({ path, state: got.status !== 200 ? "missing" : contentOf(got.text) === contentOf(files[file]) ? "current" : "old" })
  }
  const gone: LivePage[] = []
  for (const file of removed.filter((f) => f.endsWith(".html")).slice(0, PAGE_LIMIT)) {
    const path = addressOf(file), got = await get(path)
    gone.push({ path, state: got.status === 404 || got.status === 410 ? "gone" : "still-there" })
  }
  return { origin, pages, removed: gone }
}
