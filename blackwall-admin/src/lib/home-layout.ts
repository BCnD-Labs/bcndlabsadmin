import type { PanelType } from "./home-slots"

/**
 * Home layout: one ordered list of every block Home can show, each with visibility and width.
 * Replaces the fixed four slots (prefs v5). Widths map to the Home grid: narrow = 1 column,
 * wide = 2, full = the whole row (3 columns on wide screens; phones stack everything).
 */
export const BLOCK_IDS = ["prs", "week", "repos", "productivity", "coursework", "calendar", "development", "website", "analytics", "projects", "log", "services"] as const
export type BlockId = (typeof BLOCK_IDS)[number]
export type BlockWidth = "narrow" | "wide" | "full"
export const BLOCK_WIDTHS: BlockWidth[] = ["narrow", "wide", "full"]

export interface LayoutItem {
  id: BlockId
  visible: boolean
  width: BlockWidth
}

export const BLOCK_LABELS: Record<BlockId, string> = {
  prs: "Pull requests",
  week: "This week",
  repos: "Repositories",
  productivity: "Tasks & notes",
  coursework: "Assignments & exams",
  calendar: "Calendar & agenda",
  development: "GitHub summary",
  website: "Website content",
  analytics: "Website traffic",
  projects: "Projects",
  log: "Daily log",
  services: "Linked services",
}

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "prs", visible: true, width: "wide" },
  { id: "week", visible: true, width: "narrow" },
  { id: "repos", visible: true, width: "full" },
  { id: "productivity", visible: true, width: "wide" },
  { id: "coursework", visible: true, width: "narrow" },
  { id: "website", visible: true, width: "wide" },
  { id: "services", visible: true, width: "narrow" },
  { id: "projects", visible: true, width: "narrow" },
  { id: "log", visible: true, width: "narrow" },
  { id: "development", visible: false, width: "narrow" },
  { id: "calendar", visible: false, width: "wide" },
  { id: "analytics", visible: false, width: "wide" },
]
const defaultOf = (id: BlockId) => DEFAULT_LAYOUT.find((b) => b.id === id)!

const isBlock = (v: unknown): v is BlockId => (BLOCK_IDS as readonly unknown[]).includes(v)

/** Known ids once each, valid widths; blocks added in later versions are appended hidden. */
export function sanitizeLayout(raw: unknown): LayoutItem[] {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map((b) => ({ ...b }))
  const seen = new Set<BlockId>()
  const out: LayoutItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object" || !isBlock(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    out.push({ id: item.id, visible: item.visible !== false, width: BLOCK_WIDTHS.includes(item.width) ? item.width : defaultOf(item.id).width })
  }
  for (const b of DEFAULT_LAYOUT) if (!seen.has(b.id)) out.push({ ...b, visible: false })
  return out
}

/** v4 → v5: the overview panels first, then the four chosen slots in order, then projects/log/services. */
export function layoutFromSlots(slots: PanelType[] | undefined, showProjects = true, showLog = true): LayoutItem[] {
  const chosen = (slots ?? []).filter((t): t is Exclude<PanelType, "empty"> => t !== "empty")
  const ordered: LayoutItem[] = [
    { ...defaultOf("prs") }, { ...defaultOf("week") }, { ...defaultOf("repos") },
    ...chosen.map((id) => ({ ...defaultOf(id), visible: true })),
    { ...defaultOf("services") },
    { ...defaultOf("projects"), visible: showProjects },
    { ...defaultOf("log"), visible: showLog },
  ]
  return sanitizeLayout(ordered)
}

export function moveBlock(layout: LayoutItem[], from: BlockId, to: BlockId): LayoutItem[] {
  const next = layout.filter((b) => b.id !== from)
  const moving = layout.find((b) => b.id === from)
  const at = next.findIndex((b) => b.id === to)
  if (!moving || at < 0) return layout
  const fromIndex = layout.findIndex((b) => b.id === from)
  const toIndex = layout.findIndex((b) => b.id === to)
  next.splice(fromIndex < toIndex ? at + 1 : at, 0, moving)
  return next
}

export function stepBlock(layout: LayoutItem[], id: BlockId, delta: -1 | 1): LayoutItem[] {
  const i = layout.findIndex((b) => b.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= layout.length) return layout
  const next = [...layout]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const patchBlock = (layout: LayoutItem[], id: BlockId, patch: Partial<Omit<LayoutItem, "id">>) =>
  layout.map((b) => (b.id === id ? { ...b, ...patch } : b))
