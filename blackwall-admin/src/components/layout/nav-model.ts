import { learningHref } from "../../lib/routes.ts"
import type { LearningKind } from "../../lib/types.ts"

/**
 * Pure navigation helpers (no React, no stores) so they can be unit tested with node --test:
 * the most specific active section, and Learning's sub-pages derived from your records.
 */

export interface NavChild {
  label: string
  to: string
}

/** The minimum a destination needs for matching. */
export interface NavMatch {
  id: string
  /** Route prefix that marks this destination active. */
  match: string
}

/** Does `pathname` sit under `match`? "/" only matches itself; prefixes stop at a segment boundary. */
export function matchesRoute(match: string, pathname: string): boolean {
  if (match === "/") return pathname === "/"
  return pathname === match || pathname.startsWith(match.endsWith("/") ? match : `${match}/`)
}

/**
 * The section you're in: the destination with the longest matching prefix, so
 * /productivity/learning/… is Learning, not Productivity at /productivity.
 */
export function activeDestination<T extends NavMatch>(nav: T[], pathname: string): T | undefined {
  let best: T | undefined
  for (const d of nav) if (matchesRoute(d.match, pathname) && (!best || d.match.length > best.match.length)) best = d
  return best
}

/** Where a kind filter lives: the Learning page with `?kind=`. */
export const learningKindHref = (kind: LearningKind) => `${learningHref}?kind=${kind}`

/**
 * Learning's sidebar children: "Courses" always; every other kind once at least one record of
 * it exists, labelled with the kind's plural and in the kinds' order. With two or more kinds
 * present, an "Overview" (the unfiltered page) comes first. Records without a kind are courses.
 */
export function learningChildren(records: { kind?: LearningKind }[], kinds: { value: LearningKind; plural: string }[]): NavChild[] {
  const present = new Set(records.map((r) => r.kind ?? "course"))
  const shown = kinds.filter((k) => k.value === "course" || present.has(k.value))
  const children = shown.map((k) => ({ label: k.plural, to: learningKindHref(k.value) }))
  return present.size >= 2 ? [{ label: "Overview", to: learningHref }, ...children] : children
}

/** A `?kind=` value from the address, or "all" when it's missing or not a kind. */
export function kindFromSearch(search: string, kinds: { value: LearningKind }[]): LearningKind | "all" {
  const value = new URLSearchParams(search).get("kind")
  return kinds.find((k) => k.value === value)?.value ?? "all"
}
