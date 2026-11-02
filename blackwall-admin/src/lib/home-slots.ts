/** Home grid slots: which panel type each of the four squares shows. */

export const PANEL_TYPES = ["productivity", "coursework", "calendar", "development", "website", "analytics", "empty"] as const
export type PanelType = (typeof PANEL_TYPES)[number]

export const SLOT_COUNT = 4
export const DEFAULT_SLOTS: PanelType[] = ["productivity", "coursework", "development", "website"]
/** The default before the Calendar, Development and Website panels existed (prefs v2). */
export const OLD_DEFAULT_SLOTS: PanelType[] = ["productivity", "empty", "empty", "empty"]

const isPanelType = (v: unknown): v is PanelType => (PANEL_TYPES as readonly unknown[]).includes(v)

/** Four known types, each non-empty type at most once; anything else becomes empty. */
export function sanitizeSlots(raw: unknown): PanelType[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SLOTS]
  const seen = new Set<PanelType>()
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const t = raw[i]
    if (!isPanelType(t) || (t !== "empty" && seen.has(t))) return "empty"
    seen.add(t)
    return t
  })
}

/** Put `type` in slot `i`. If another slot already shows it, the two slots swap. */
export function assignSlot(slots: PanelType[], i: number, type: PanelType): PanelType[] {
  const next = [...slots]
  const j = type === "empty" ? -1 : next.indexOf(type)
  if (j >= 0 && j !== i) next[j] = next[i]
  next[i] = type
  return next
}

export function swapSlots(slots: PanelType[], i: number, j: number): PanelType[] {
  const next = [...slots]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
