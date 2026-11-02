import { toast } from "sonner"
import { siteFromTemplate } from "@shared/sitebuilder"
import type { Site } from "@/lib/types"
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

/** Unpublished changes: pages, posts or settings edited after the last publish. */
export function useUnpublished(site?: Site) {
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  if (!site) return { pages: [], posts: [], settings: false, count: 0 }
  const since = site.publishedAt ?? ""
  const p = pages.filter((x) => x.siteId === site.id && x.updatedAt > since)
  const d = drafts.filter((x) => x.siteId === site.id && x.publishedAt && x.updatedAt > since)
  const settings = !site.publishedAt || site.updatedAt > since
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
