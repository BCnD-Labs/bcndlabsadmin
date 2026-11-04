/** The tools that can sit in the Mac workspace's right-hand dock, and how a saved layout is repaired. No app imports, so tests can load it. */
export const TOOL_IDS = ["calendar", "today", "log", "notes"] as const
export type ToolId = (typeof TOOL_IDS)[number]

export const TOOL_INFO: Record<ToolId, { title: string; hint: string }> = {
  calendar: { title: "Calendar", hint: "Month at a glance; picks the day the other tools show" },
  today: { title: "Tasks", hint: "Tasks due or focused on the chosen day" },
  log: { title: "Daily log", hint: "A few lines about the chosen day" },
  notes: { title: "Notes", hint: "Your notes, newest first" },
}

export interface DockTool {
  id: ToolId
  collapsed: boolean
}

export const MIN_DOCK = 260
export const MAX_DOCK = 520
const DEFAULT_TOOLS: DockTool[] = [
  { id: "calendar", collapsed: false },
  { id: "today", collapsed: false },
  { id: "log", collapsed: false },
]

/** Saved layouts may be old or hand-edited: keep known tools once each, and a width that fits. */
export interface DockLayout {
  open: boolean
  navOpen: boolean
  width: number
  tools: DockTool[]
}

export function sanitizeDock(raw: unknown): DockLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const seen = new Set<string>()
  const tools = Array.isArray(r.tools)
    ? r.tools.flatMap((t: unknown): DockTool[] => {
        const item = t as Partial<DockTool> | null
        if (!item || !TOOL_IDS.includes(item.id as ToolId) || seen.has(item.id as string)) return []
        seen.add(item.id as string)
        return [{ id: item.id as ToolId, collapsed: item.collapsed === true }]
      })
    : DEFAULT_TOOLS
  const width = typeof r.width === "number" && Number.isFinite(r.width) ? Math.min(MAX_DOCK, Math.max(MIN_DOCK, Math.round(r.width))) : 320
  return { open: r.open !== false, navOpen: r.navOpen !== false, width, tools }
}

