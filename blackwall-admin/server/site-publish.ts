import { buildSite } from "../shared/sitebuilder.ts"
import { trimSlashes } from "../shared/site.ts"
import type { Collections } from "../shared/workspace.ts"
import { ProviderError } from "./http.ts"
import { repoFor } from "./providers/website.ts"
import type { ConnectionStore } from "./store.ts"
import { approvedComments } from "../shared/site-inbox.ts"
import { readInbox } from "./forms-inbox.ts"

/** Paths Blackwall generated last time, so files it no longer makes are removed (and nothing else is). */
const MANIFEST = ".blackwall-site.json"

/**
 * Builds a CMS site from the workspace and commits it to its repository in one commit:
 * every page, published post, stylesheet, sitemap and redirect. Files Blackwall made
 * before but doesn't make now are deleted; files it never made are never touched.
 */
export async function publishSite(store: ConnectionStore, ws: Collections, siteId: string) {
  const site = ws.sites.find((s) => s.id === siteId)
  if (!site) throw new ProviderError("That site doesn't exist", 404)
  const c = site.connectionId ? await store.get(site.connectionId) : await store.firstOk("website")
  if (!c || c.provider !== "website") throw new ProviderError("Choose a GitHub repository to publish to in Site settings.", 409)
  const { cfg, repo } = repoFor(c)
  const root = trimSlashes(site.root ?? "")
  const at = (p: string) => (root ? `${root}/${p}` : p)
  const files = buildSite(site, ws.pages, ws.drafts, ws.forms, approvedComments(await readInbox(store), site.id))
  let previous: string[] = []
  try {
    previous = JSON.parse((await repo.read(at(MANIFEST))) ?? "{}").files ?? []
  } catch {
    previous = []
  }
  const paths = Object.keys(files)
  const changes = [
    ...paths.map((p) => ({ path: at(p), content: files[p] })),
    ...previous.filter((p) => !(p in files)).map((p) => ({ path: at(p), delete: true as const })),
    { path: at(MANIFEST), content: `${JSON.stringify({ generator: "Blackwall", site: site.name, files: paths.sort() }, null, 2)}\n` },
  ]
  const posts = ws.drafts.filter((d) => d.siteId === site.id && d.publishedAt).length
  const sha = await repo.commit(`Publish ${site.name}: ${ws.pages.filter((p) => p.siteId === site.id).length} pages, ${posts} posts (via Blackwall)`, changes)
  return { sha, files: paths.length, removed: previous.filter((p) => !(p in files)).length, repo: cfg.repo, branch: cfg.branch, url: site.domain ? `https://${site.domain.replace(/^https?:\/\//, "")}` : undefined }
}
