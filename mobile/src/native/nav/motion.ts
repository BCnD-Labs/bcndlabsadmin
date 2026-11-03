/** Animation timings for the floating navigation, in milliseconds. Pure so node tests can load it. */
export const OPEN_MS = 220
export const CLOSE_MS = 160
export const SHEET_MS = 240
/** How long the bar stays open after a slot is chosen before it collapses. */
export const CHOOSE_COLLAPSE_MS = 120

/** Duration to use for an animation: zero when the system "reduce motion" setting is on. */
export function navDuration(reduceMotion: boolean, ms: number): number {
  return reduceMotion ? 0 : Math.max(0, ms)
}
