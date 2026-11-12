export const HOME_PANELS = ["today", "learning", "recent", "journal", "projects", "events", "pinned"] as const
export type HomePanel = typeof HOME_PANELS[number]
export const HOME_LABELS: Record<HomePanel, string> = {
  today: "Today", learning: "Learning next", recent: "Recently done", journal: "Journal",
  projects: "Projects", events: "Upcoming events", pinned: "Pinned notes",
}
export type HomePrefs = {
  order: HomePanel[]
  collapsed: HomePanel[]
  closedGroups: string[]
  expandedGroups: string[]
  expandedToday: boolean
}
export const DEFAULT_HOME_PREFS: HomePrefs = {
  order: [...HOME_PANELS], collapsed: [], closedGroups: [], expandedGroups: [], expandedToday: false,
}
const uniqueStrings = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : []
export function sanitizeHomePrefs(value: unknown): HomePrefs {
  const p = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const known = (value: string): value is HomePanel => HOME_PANELS.includes(value as HomePanel)
  const order = uniqueStrings(p.order).filter(known)
  return {
    order: [...order, ...HOME_PANELS.filter(item => !order.includes(item))],
    collapsed: uniqueStrings(p.collapsed).filter(known),
    closedGroups: uniqueStrings(p.closedGroups),
    expandedGroups: uniqueStrings(p.expandedGroups),
    expandedToday: p.expandedToday === true,
  }
}
export function moveHomePanel(order: HomePanel[], panel: HomePanel, direction: -1 | 1): HomePanel[] {
  const next = [...order], from = next.indexOf(panel), to = from + direction
  if (from >= 0 && to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]]
  return next
}
export function toggleItem<T>(items: T[], item: T): T[] { return items.includes(item) ? items.filter(value => value !== item) : [...items, item] }
