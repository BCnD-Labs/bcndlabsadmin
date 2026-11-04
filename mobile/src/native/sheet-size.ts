/** How much taller the large editor is than the small one, and how much of the screen it may use at most. */
export const GROW_FACTOR = 2.5
export const GROW_SCREEN_SHARE = 0.88
/** A tiny small editor still grows by at least this much, so expanding is always visible. */
export const GROW_MIN_EXTRA = 120

/** The height (dp) the large editor grows to: about 2.5x the small one, never more than most of the screen. */
export function growTarget(compact: number, screen: number): number {
  const cap = Math.floor(screen * GROW_SCREEN_SHARE)
  if (!(compact > 0)) return cap
  if (compact >= cap) return compact
  return Math.min(Math.max(Math.round(compact * GROW_FACTOR), compact + GROW_MIN_EXTRA), cap)
}
