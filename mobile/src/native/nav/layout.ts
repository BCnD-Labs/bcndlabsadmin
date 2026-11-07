/** Bottom-edge layout for the pill nav and the quick-add button. Pure so node tests can load it. */
/** Same height as the nav pill, so the two sit as a pair on the bottom edge. */
export const FAB = 42
export const FAB_EDGE = 12
const GAP = 8
const NAV_MAX = 300

/**
 * The pill sits to the left of the quick-add button instead of centred, so the two never overlap.
 * On a wide phone the pill keeps a little air on both sides of itself; on a narrow one it takes all the room left.
 */
export function navLayout(windowWidth: number): { barWidth: number; barLeft: number } {
  const room = Math.max(0, windowWidth - FAB_EDGE * 2 - FAB - GAP)
  const barWidth = Math.min(room, NAV_MAX)
  return { barWidth, barLeft: FAB_EDGE + (room - barWidth) / 2 }
}
