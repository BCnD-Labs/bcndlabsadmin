import { toast } from "sonner"
import { cloneBlocks, siteFromSite, siteFromTemplate } from "@shared/sitebuilder"
import type { Site, SitePage } from "@/lib/types"
import { api } from "@/services/connector"
import { syncWorkspace, useWorkspaceSync } from "@/services/workspace-sync"
import { usePrefs } from "@/stores/prefs"
import { useWorkspace } from "@/stores/workspace"

/** The site the Website section shows: your last pick, else the first site. */
export function useCurrentSite(): Site | undefined {
  const sites = useWorkspace((s) => s.sites)
  const id = usePrefs((s) => s.cmsSiteId)
  return sites.find((s) => s.id === id) ?? sites[0]
}

export const selectSite = (id: string) => usePrefs.getState().set({ cmsSiteId: id })

/** A new site from one of the templates, with its pages; it becomes the current site. */
export function createSite(name: string, template: string, domain = "") {
  const { create } = useWorkspace.getState()
  const t = siteFromTemplate(name, template)
  const site = create("sites", { ...t.site, domain })
  for (const p of t.pages) create("pages", { ...p, siteId: site.id })
  selectSite(site.id)
  return site
}

/** A new site that starts as a copy of one you kept as a template (its look and its pages). */
export function createSiteFromSite(name: string, sourceId: string, domain = "") {
  const { create, sites, pages } = useWorkspace.getState()
  const source = sites.find((s) => s.id === sourceId)
  if (!source) return createSite(name, "simple", domain)
  const own = pages.filter((p) => p.siteId === source.id).sort((a, b) => a.order - b.order)
  const t = siteFromSite(name, source, own)
  const site = create("sites", { ...t.site, domain })
  // Pages get new ids here, so a nested page's link to its parent is rebuilt from the copies.
  const made = t.pages.map((p) => create("pages", { ...p, siteId: site.id }))
  own.forEach((p, i) => { const up = own.findIndex((x) => x.id === p.parentId); if (up >= 0) useWorkspace.getState().update("pages", made[i].id, { parentId: made[up].id }) })
  selectSite(site.id)
  return site
}

/** A copy of a page right after it, with its own address. */
export function duplicatePage(page: SitePage): SitePage {
  const { create, pages } = useWorkspace.getState()
  const taken = new Set(pages.filter((p) => p.siteId === page.siteId).map((p) => p.slug))
  let slug = `${page.slug || "home"}-copy`, n = 2
  while (taken.has(slug)) slug = `${page.slug || "home"}-copy-${n++}`
  const order = Math.max(...pages.filter((p) => p.siteId === page.siteId).map((p) => p.order)) + 1
  return create("pages", { siteId: page.siteId, title: `${page.title} copy`, slug, description: page.description, inMenu: false, order, sections: cloneBlocks(page.sections) })
}

/** When the site's files last left Blackwall: a publish or a copy/download, whichever is later. */
export const deployedAt = (site: Site) => [site.publishedAt, site.exportedAt].filter(Boolean).sort().at(-1)

/** Saves a text file through the browser (the Mac app asks where to put it). */
export function saveFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Unpublished changes: pages, posts or settings edited after the files last left Blackwall. */
export function useUnpublished(site?: Site) {
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  if (!site) return { pages: [], posts: [], settings: false, count: 0 }
  const since = deployedAt(site) ?? ""
  const p = pages.filter((x) => x.siteId === site.id && x.updatedAt > since)
  const d = drafts.filter((x) => x.siteId === site.id && x.publishedAt && x.updatedAt > since)
  const settings = !since || site.updatedAt > since
  return { pages: p, posts: d, settings, count: p.length + d.length + (settings && !p.length && !d.length ? 1 : 0) }
}

/** Push local edits to the server before it builds from them. */
async function flushWorkspace() {
  for (let i = 0; i < 25; i++) {
    await syncWorkspace()
    if (useWorkspaceSync.getState().status === "saved") return
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error("Your latest edits haven't reached the server yet. Try again in a moment.")
}

export async function publishSite(site: Site) {
  await flushWorkspace()
  const r = await api<{ sha: string; files: number; removed: number; repo: string; branch: string; url?: string }>(`sites/${site.id}/publish`, { method: "POST" })
  // Recorded a second after the edits so they no longer count as unpublished.
  useWorkspace.getState().update("sites", site.id, { publishedAt: new Date(Date.now() + 1000).toISOString(), publishedSha: r.sha })
  toast.success(`Published ${r.files} files to ${r.repo}`, { description: r.removed ? `${r.removed} old files removed` : undefined, action: r.url ? { label: "Open site", onClick: () => window.open(r.url, "_blank", "noreferrer") } : undefined })
  return r
}
