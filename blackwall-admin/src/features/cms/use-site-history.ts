import { useCallback, useEffect, useRef, useState } from "react"
import { EditHistory, changeKey, samePage, sameSite, type SiteSnapshot } from "@shared/edit-history"
import type { Site, SitePage } from "@/lib/types"
import { isApplyingRemote } from "@/services/workspace-sync"
import { useWorkspace } from "@/stores/workspace"

type Lists = { sites: Site[]; pages: SitePage[] }

function take(state: Lists, siteId: string): SiteSnapshot | null {
  const site = state.sites.find((s) => s.id === siteId)
  return site ? { site, pages: state.pages.filter((p) => p.siteId === siteId) } : null
}

function changedPages(a: SiteSnapshot, b: SiteSnapshot) {
  const ids = new Set<string>()
  for (const p of a.pages) { const o = b.pages.find((x) => x.id === p.id); if (!o || !samePage(p, o)) ids.add(p.id) }
  for (const p of b.pages) if (!a.pages.some((x) => x.id === p.id)) ids.add(p.id)
  return [...ids]
}
const same = (a: SiteSnapshot, b: SiteSnapshot) => sameSite(a.site, b.site) && a.pages.length === b.pages.length && !changedPages(a, b).length

/**
 * Undo and redo for everything edited on one site while its workspace is open: pages, blocks, the look, settings.
 * Every change on this device is noticed where it lands in the store, so no editor has to remember to report it; undoing
 * writes through the store too, so the usual revision checks apply when it saves. A change arriving from another device
 * clears the history rather than risk undoing over it.
 */
export function useSiteHistory(siteId: string) {
  const history = useRef(new EditHistory<SiteSnapshot>())
  const restoring = useRef(false)
  const [can, setCan] = useState({ undo: false, redo: false })
  const refresh = useCallback(() => setCan({ undo: history.current.canUndo, redo: history.current.canRedo }), [])

  useEffect(() => {
    history.current = new EditHistory()
    return useWorkspace.subscribe((state, prev) => {
      if ((state.pages === prev.pages && state.sites === prev.sites) || restoring.current) return
      const before = take(prev, siteId), after = take(state, siteId)
      if (!before || !after || same(before, after)) return
      if (isApplyingRemote()) history.current.clear()
      else history.current.record(before, changeKey(before, after))
      refresh()
    })
  }, [siteId, refresh])

  const restore = useCallback((target: SiteSnapshot, from: SiteSnapshot) => {
    const at = new Date().toISOString()
    restoring.current = true
    try {
      useWorkspace.setState((state) => {
        const live = new Map(from.pages.map((p) => [p.id, p]))
        const pages = target.pages.map((p) => { const now = live.get(p.id); return now && samePage(now, p) ? now : { ...p, updatedAt: at } })
        const sites = state.sites.map((s) => (s.id !== siteId || sameSite(s, target.site) ? s : { ...target.site, updatedAt: at, publishedAt: s.publishedAt, publishedSha: s.publishedSha, exportedAt: s.exportedAt, guideHidden: s.guideHidden }))
        return { sites, pages: [...pages, ...state.pages.filter((p) => p.siteId !== siteId)] }
      })
    } finally { restoring.current = false }
    refresh()
    return changedPages(target, from)
  }, [siteId, refresh])

  /** Both return the ids of the pages that changed, so the editor can show the one affected. */
  const undo = useCallback(() => {
    const now = take(useWorkspace.getState(), siteId)
    const target = now && history.current.undo(now)
    return now && target ? restore(target, now) : []
  }, [siteId, restore])
  const redo = useCallback(() => {
    const now = take(useWorkspace.getState(), siteId)
    const target = now && history.current.redo(now)
    return now && target ? restore(target, now) : []
  }, [siteId, restore])

  return { undo, redo, canUndo: can.undo, canRedo: can.redo }
}
