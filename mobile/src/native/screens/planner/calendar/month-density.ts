/** Month view sizing and the drag "give" at the calendar's limits (pure: no React Native). */

/** The weekday-letters row and the card's padding, which every month height has to include. */
export const WEEKDAY_ROW = 28
export const CARD_PAD = 8
/** A week row is never shorter than this, which sets the month view's smallest calendar height. */
export const MONTH_ROW_MIN = 40

/** The smallest calendar height that keeps every week row at least MONTH_ROW_MIN tall. */
export function monthMinHeight(headerHeight: number, rows: number): number {
  return Math.round(headerHeight + WEEKDAY_ROW + CARD_PAD + rows * MONTH_ROW_MIN)
}

/** How many event titles a day cell can show instead of dots: more room, more titles (0 means dots only). */
export function monthChips(cellHeight: number): 0 | 1 | 2 | 3 {
  return cellHeight >= 92 ? 3 : cellHeight >= 74 ? 2 : cellHeight >= 56 ? 1 : 0
}

/** The most a drag can stretch past the smallest or largest size before springing back. */
export const RUBBER_GIVE = 28

const stretch = (over: number, give: number) => give * (1 - Math.exp(-over / give))

/**
 * The height to show while dragging: exactly the finger between `min` and `max`, and past either end a
 * resisted stretch that never exceeds `give`. Letting go springs back to the limit; nothing is saved past it.
 */
export function rubberBand(raw: number, min: number, max: number, give = RUBBER_GIVE): number {
  if (raw > max) return max + stretch(raw - max, give)
  if (raw < min) return min - stretch(min - raw, give)
  return raw
}
