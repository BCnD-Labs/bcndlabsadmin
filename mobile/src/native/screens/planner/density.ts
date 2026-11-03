/** How tightly task rows are packed (a per-device preference; pure so node tests can load it). */
export type Density = "compact" | "comfortable"

export const DENSITIES: readonly Density[] = ["compact", "comfortable"]
export const DEFAULT_DENSITY: Density = "comfortable"

/** Anything that is not one of the two known densities becomes "comfortable". */
export function sanitizeDensity(value: unknown): Density {
  return value === "compact" || value === "comfortable" ? value : DEFAULT_DENSITY
}

export const otherDensity = (d: Density): Density => (d === "compact" ? "comfortable" : "compact")

export interface RowMetrics { minHeight: number; vertical: number; titleLines: number; showDetails: boolean }

/** Row sizes. Both keep a 44dp touch target; compact trims padding, wraps nothing and drops the details line. */
export const rowMetrics = (d: Density): RowMetrics =>
  d === "compact" ? { minHeight: 44, vertical: 2, titleLines: 1, showDetails: false } : { minHeight: 56, vertical: 8, titleLines: 2, showDetails: true }
