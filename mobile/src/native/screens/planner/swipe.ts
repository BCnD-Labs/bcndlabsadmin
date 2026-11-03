/**
 * The numbers behind a task row's swipe (pure). Swipe right past COMPLETE_AT completes (or
 * reopens) the task; swipe left reveals a two-button strip (Star, Delete) that stays open until
 * you tap a button or swipe back. The actions are buttons, so deleting is never a flick.
 */
export const REVEAL = 144
export const COMPLETE_AT = 88
export const MAX_RIGHT = 120
export type Settle = "complete" | "open" | "closed"

/** Where the row sits for a drag of `dx` that started `open` or closed. */
export const positionFor = (dx: number, open: boolean): number => Math.max(-REVEAL, Math.min(MAX_RIGHT, (open ? -REVEAL : 0) + dx))

/** What a released drag does, from the row's position and its horizontal velocity (dp per ms). */
export function settle(position: number, vx = 0): Settle {
  if (position >= COMPLETE_AT) return "complete"
  if (position <= -REVEAL / 2) return vx > 0.6 ? "closed" : "open"
  if (position < -12 && vx < -0.6) return "open"
  return "closed"
}

/** A mostly-horizontal drag belongs to the row; anything else is the list scrolling. */
export const claimsDrag = (dx: number, dy: number): boolean => Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5
