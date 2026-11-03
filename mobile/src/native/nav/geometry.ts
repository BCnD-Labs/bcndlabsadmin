import type { NavSide } from "./side.ts"

export type BarGeometry = {
  /** scaleX of the bar at the collapsed state (the bar is bubble-sized); it is 1 when open. */
  collapsedScale: number
  /** translateX of the bar at the collapsed state, so its pill sits exactly on the bubble; 0 when open. */
  shift: number
  /** Left offset of the bubble inside the bar-wide anchor. */
  bubbleLeft: number
}

/**
 * The bar is scaled around its centre, so to open "from the bubble" its collapsed pill is shifted
 * toward the bubble: right-anchored grows leftward, left-anchored grows rightward, centered grows
 * equally both ways. Pure so node tests can load it (no react-native import).
 */
export function barShift(side: NavSide, barWidth: number, bubbleSize: number): BarGeometry {
  const s0 = bubbleSize / barWidth
  const half = (barWidth * (1 - s0)) / 2
  if (side === "left") return { collapsedScale: s0, shift: -half, bubbleLeft: 0 }
  if (side === "center") return { collapsedScale: s0, shift: 0, bubbleLeft: (barWidth - bubbleSize) / 2 }
  return { collapsedScale: s0, shift: half, bubbleLeft: barWidth - bubbleSize }
}

/** Left edge of the bar-wide anchor for a side, given the window width and the edge gap. */
export function anchorLeft(side: NavSide, windowWidth: number, barWidth: number, edge: number): number {
  if (side === "left") return edge
  if (side === "center") return (windowWidth - barWidth) / 2
  return windowWidth - edge - barWidth
}
