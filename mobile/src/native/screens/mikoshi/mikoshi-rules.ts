import { originOf } from "../../../lib/url.ts"
import type { ServiceStatus } from "../../../lib/service-status.ts"

/** Pure rules for the Mikoshi screen (no React Native imports, so they run under node --test). */

export interface ServiceLike { id: string; name: string; url: string; description: string; group: string; pinned: boolean }

/** Section order, as on the web launcher; other group names follow alphabetically. */
export const GROUP_ORDER = ["Infrastructure", "Apps", "AI", "Media"] as const

export function groupServices<T extends ServiceLike>(services: readonly T[]): { group: string; items: T[] }[] {
  const by = new Map<string, T[]>()
  for (const s of services) {
    const g = s.group.trim() || "Other"
    by.set(g, [...(by.get(g) ?? []), s])
  }
  const rank = (g: string) => { const i = (GROUP_ORDER as readonly string[]).indexOf(g); return i < 0 ? GROUP_ORDER.length : i }
  return [...by.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([group, items]) => ({ group, items: [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name)) }))
}

/**
 * Where a tool opens. `app`: https, loads inside the app locked to its own address. `browser`: plain http,
 * which the app doesn't load yet, so it can only be handed to the browser. `invalid`: not a web address.
 */
export type ToolTarget = { kind: "app"; url: string; origin: string } | { kind: "browser"; url: string } | { kind: "invalid" }

export function toolTarget(url: string): ToolTarget {
  const u = url.trim()
  const origin = originOf(u)
  if (!origin) return { kind: "invalid" }
  return origin.startsWith("https://") ? { kind: "app", url: u, origin } : { kind: "browser", url: u }
}

/** ":9443" when the address has a port, otherwise its host: enough to tell tiles apart. */
export function addressLabel(url: string): string {
  const m = /^https?:\/\/([^/?#]*)/i.exec(url.trim())
  if (!m) return url
  const port = /:(\d{1,5})$/.exec(m[1])?.[1]
  return port ? `:${port}` : m[1].replace(/:\d+$/, "")
}

/** How many tools stay loaded in the background at once. */
export const MAX_OPEN_TOOLS = 4

/** The tools that are open (least recently used first) and the one on screen; null means the list is showing. */
export interface Tools { open: string[]; active: string | null }
export const noTools: Tools = { open: [], active: null }

/** Opens or switches to a tool, making it the most recent. Over the limit, the least recently used one is dropped. */
export function openTool(t: Tools, id: string): Tools {
  const open = [...t.open.filter((x) => x !== id), id]
  while (open.length > MAX_OPEN_TOOLS) open.shift()
  return { open, active: id }
}

/** Closes a tool. Closing the one on screen goes to the most recent remaining tool, or back to the list. */
export function closeTool(t: Tools, id: string): Tools {
  const open = t.open.filter((x) => x !== id)
  return { open, active: t.active === id ? (open[open.length - 1] ?? null) : t.active }
}

/** Back to the list, keeping every open tool loaded. */
export const showList = (t: Tools): Tools => ({ ...t, active: null })

/** Forgets tools whose service no longer exists. */
export function pruneTools(t: Tools, ids: ReadonlySet<string>): Tools {
  const open = t.open.filter((id) => ids.has(id))
  return open.length === t.open.length ? t : { open, active: t.active && ids.has(t.active) ? t.active : null }
}

export function statusSummary(urls: readonly string[], byUrl: ReadonlyMap<string, ServiceStatus>): { up: number; down: number; unchecked: number } {
  let up = 0, down = 0, unchecked = 0
  for (const u of new Set(urls)) { const s = byUrl.get(u); if (!s) unchecked++; else if (s.up) up++; else down++ }
  return { up, down, unchecked }
}
