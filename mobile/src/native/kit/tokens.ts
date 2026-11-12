import { plannerColor as c } from "../planner-theme.ts"

/**
 * Shared colours for the native panels. The base surfaces stay in planner-theme.ts; this adds the
 * title-bar shade, the category hues and the property-chip tones so every screen reads the same.
 */
export const kit = {
  titlebar: "#242527",
  /** Category hues for native panels and selected content. */
  hue: { productivity: c.accent, journal: "#ffb74d", learning: "#b39ddb", projects: "#f2649f", website: "#ff8a4d", github: "#1fc8e0", neutral: "#b4b8c0" },
  good: "#66bb6a",
  open: "#2196f3",
  bad: "#ef5350",
  mutedInk: "#aab0ba",
} as const

/** Property kinds: amber = date, red = overdue, violet = learning, blue = tag, pink = project, green = status. */
export type ChipKind = "date" | "overdue" | "course" | "tag" | "project" | "status" | "neutral"

export const chipTone: Record<ChipKind, { fill: string; ink: string }> = {
  date: { fill: "#3b3220", ink: "#ffcc80" },
  overdue: { fill: "#4a2727", ink: "#ffadad" },
  course: { fill: "#2d2845", ink: "#cdbdf5" },
  tag: { fill: "#1e3a55", ink: "#8ec9ff" },
  project: { fill: "#44283a", ink: "#f5a3c7" },
  status: { fill: "#1f3a28", ink: "#8fdc98" },
  neutral: { fill: "#3a3b3e", ink: "#d9dce1" },
}

/** A project's status as a chip kind: active green, planned blue, paused amber, done grey. */
export const statusKind = (status: "active" | "planned" | "paused" | "done"): ChipKind => status === "active" ? "status" : status === "planned" ? "tag" : status === "paused" ? "date" : "neutral"

/** Heat-grid fills, quiet to bright. */
export const heatFill = ["#26272a", "#24452d", "#2f6b3f", "#4a9a5a", "#66bb6a"] as const
