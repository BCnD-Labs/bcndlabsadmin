export const SECTIONS = ["agenda", "log", "notes"] as const
export type Section = typeof SECTIONS[number]
export type WorkspacePrefs = { fraction: number; order: Section[]; hidden: Section[]; showTimes: boolean; showCourses: boolean; showCompleted: boolean }
export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = { fraction: 0.55, order: [...SECTIONS], hidden: [], showTimes: true, showCourses: true, showCompleted: true }
export function sanitizeWorkspacePrefs(value: unknown): WorkspacePrefs {
  const p = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const section = (v: unknown): v is Section => SECTIONS.includes(v as Section)
  const order = Array.isArray(p.order) ? [...new Set(p.order.filter(section))] : []
  return {
    fraction: typeof p.fraction === "number" && Number.isFinite(p.fraction) ? Math.max(0.25, Math.min(0.8, p.fraction)) : 0.55,
    order: [...order, ...SECTIONS.filter(s => !order.includes(s))],
    hidden: Array.isArray(p.hidden) ? [...new Set(p.hidden.filter(section))] : [],
    showTimes: p.showTimes !== false, showCourses: p.showCourses !== false, showCompleted: p.showCompleted !== false,
  }
}
export function moveSection(order: Section[], item: Section, direction: -1 | 1): Section[] {
  const next = [...order], from = next.indexOf(item), to = from + direction
  if (from >= 0 && to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]]
  return next
}
/** Bounds always leave room for the lower pane, including on short screens. */
export function calendarHeight(available: number, fraction: number, floor?: number): number {
  const max = Math.max(0, available - Math.min(144, available / 2) - 24)
  // `floor` raises the smallest size (the month view keeps its week rows readable); it never beats the largest.
  const least = Math.min(max, Math.max(floor ?? 0, Math.min(220, max)))
  return Math.min(max, Math.max(least, available * Math.max(0.25, Math.min(0.8, Number.isFinite(fraction) ? fraction : 0.55))))
}
