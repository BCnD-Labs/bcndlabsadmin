/** The answer to "is the site really showing what I published?". */
export interface LivePage { path: string; state: "current" | "old" | "missing" | "gone" | "still-there" }
export interface LiveReport {
  /** The address that was checked; empty when the site has no domain to check. */
  origin: string
  pages: LivePage[]
  removed: LivePage[]
}

export const liveConfirmed = (r: LiveReport) => !!r.origin && r.pages.every((p) => p.state === "current") && r.removed.every((p) => p.state === "gone")
