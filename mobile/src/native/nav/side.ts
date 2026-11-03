/** Where the floating navigation bubble sits along the bottom edge. Pure so node tests can load it. */
export type NavSide = "left" | "center" | "right"

/** Left to right, the order the picker shows them in. */
export const NAV_SIDES: readonly NavSide[] = ["left", "center", "right"]

export const DEFAULT_NAV_SIDE: NavSide = "right"

/** Anything that is not one of the three known sides becomes "right". */
export function sanitizeNavSide(value: unknown): NavSide {
  return value === "left" || value === "center" || value === "right" ? value : DEFAULT_NAV_SIDE
}
