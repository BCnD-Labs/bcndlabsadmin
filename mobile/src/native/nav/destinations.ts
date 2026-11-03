import type { IconName } from "../ui.tsx"

/**
 * Pure navigation metadata. Nothing here may import react-native or expo (tests load this file
 * in plain node); the icon type is a type-only import and is erased at runtime.
 */

/** Bottom padding lets the final row clear the floating pill and the Planner add button. */
export const NAV_CLEARANCE = 140

/** Screens the shell can show. "settings" is an action (opens native Settings), not a screen. */
export type ScreenKey = "home" | "planner" | "learning" | "dev" | "notes" | "insights" | "website"
export type DestinationKey = ScreenKey | "settings"
export type GroupName = "Daily" | "Build" | "Homelab" | "App"

export type Destination = {
  key: DestinationKey
  label: string
  icon: IconName
  activeIcon: IconName
  /** Launcher group. Required for every destination that is not on the mini bar. */
  group?: GroupName
  /** On the mini bar (at most four; the fifth slot is "All"). */
  primary?: boolean
}

export const GROUP_ORDER: readonly GroupName[] = ["Daily", "Build", "Homelab", "App"]

/** Destinations from later steps (Journal, Social, Mikoshi) are added here when they are built. */
export const DESTINATIONS: readonly Destination[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home", primary: true },
  { key: "planner", label: "Planner", icon: "calendar-outline", activeIcon: "calendar", primary: true },
  { key: "learning", label: "Learning", icon: "school-outline", activeIcon: "school", primary: true },
  { key: "dev", label: "Projects", icon: "folder-outline", activeIcon: "folder", primary: true },
  { key: "notes", label: "Notes", icon: "document-text-outline", activeIcon: "document-text", group: "Daily" },
  { key: "insights", label: "Insights", icon: "stats-chart-outline", activeIcon: "stats-chart", group: "Daily" },
  { key: "website", label: "Website", icon: "globe-outline", activeIcon: "globe", group: "Build" },
  { key: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings", group: "App" },
]

/** The mini bar slots, in order. */
export const PRIMARY: readonly Destination[] = DESTINATIONS.filter((d) => d.primary)

export type LauncherGroup = { group: GroupName; items: Destination[] }

/** Non-primary destinations grouped for the "All" sheet, in GROUP_ORDER; empty groups are skipped. */
export function launcherGroups(): LauncherGroup[] {
  return GROUP_ORDER.map((group) => ({ group, items: DESTINATIONS.filter((d) => !d.primary && d.group === group) })).filter((g) => g.items.length > 0)
}

/** Metadata for a key; falls back to the first destination so the bubble always has an icon. */
export function findDestination(key: DestinationKey): Destination {
  return DESTINATIONS.find((d) => d.key === key) ?? DESTINATIONS[0]
}
