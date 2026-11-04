/** Swipe-to-change-period rules for the calendar (pure). Month view swipes up and down; the other views swipe sideways. */

/** How far a finger must move, mostly along the axis, before the calendar takes over the gesture. */
export const SWIPE_CLAIM = 12
/** Distance, or a quick flick over a shorter distance, that counts as a swipe. */
export const SWIPE_COMMIT = 48
export const SWIPE_FLICK = 0.5

/** True once a move is clearly along the swiping axis (so taps and the hour list's own scrolling are left alone). */
export function claimsSwipe(dx: number, dy: number, vertical: boolean): boolean {
  const along = Math.abs(vertical ? dy : dx), across = Math.abs(vertical ? dx : dy)
  return along > SWIPE_CLAIM && along > across * 1.6
}

/** +1 for the next period (finger moved left or up), -1 for the previous one, 0 when it was not a swipe. */
export function swipeStep(delta: number, velocity: number): -1 | 0 | 1 {
  const far = Math.abs(delta) >= SWIPE_COMMIT || (Math.abs(velocity) >= SWIPE_FLICK && Math.abs(delta) >= 16)
  return !far ? 0 : delta < 0 ? 1 : -1
}
