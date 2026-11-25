import { FAB_EDGE, pillHeight } from "./layout.ts"
import type { IconName } from "../ui.tsx"

/**
 * Pure navigation metadata. Nothing here may import react-native or expo (tests load this file
 * in plain node); the icon type is a type-only import and is erased at runtime.
 */

/** Bottom padding lets the final row clear the floating pill and the Planner add button. */
export const NAV_CLEARANCE = FAB_EDGE + pillHeight(2) + 10

/** Screens the shell can show. */
export type ScreenKey = "home" | "planner" | "journal" | "learning" | "dev" | "notes" | "insights" | "website" | "social" | "mikoshi" | "files"
export type GroupName = "Daily" | "Build" | "Homelab"

export type Destination = {
  key: ScreenKey
  label: string
  icon: IconName
  activeIcon: IconName
  /** Launcher group. Required for every destination that is not on the mini bar. */
  group?: GroupName
  /** On the mini bar (at most four; the fifth slot is "All"). */
  primary?: boolean
}


/** Registered native destinations. */
export const DESTINATIONS: readonly Destination[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home", primary: true },
  { key: "planner", label: "Planner", icon: "calendar-outline", activeIcon: "calendar", primary: true },
  { key: "learning", label: "Learning", icon: "school-outline", activeIcon: "school", primary: true },
  { key: "journal", label: "Journal", icon: "book-outline", activeIcon: "book", primary: true },
  { key: "dev", label: "Projects", icon: "folder-outline", activeIcon: "folder", group: "Build" },
  { key: "notes", label: "Notes", icon: "document-text-outline", activeIcon: "document-text", group: "Daily" },
  { key: "insights", label: "Insights", icon: "stats-chart-outline", activeIcon: "stats-chart", group: "Daily" },
  { key: "website", label: "Website", icon: "globe-outline", activeIcon: "globe", group: "Build" },
  { key: "social", label: "Social", icon: "megaphone-outline", activeIcon: "megaphone", group: "Build" },
  { key: "mikoshi", label: "Mikoshi", icon: "server-outline", activeIcon: "server", group: "Homelab" },
  { key: "files", label: "Files", icon: "folder-open-outline", activeIcon: "folder-open", group: "Homelab" },
]

/** Screens that keep their state (open tools, scroll) while you visit another screen, once they have been opened. */
export const KEEP_ALIVE: readonly ScreenKey[] = ["mikoshi", "planner", "learning", "journal"]

/** The mini bar slots, in order. */
export const PRIMARY: readonly Destination[] = DESTINATIONS.filter((d) => d.primary)

/** Metadata for a key; falls back to the first destination so the bubble always has an icon. */
export function findDestination(key: ScreenKey): Destination {
  return DESTINATIONS.find((d) => d.key === key) ?? DESTINATIONS[0]
}


