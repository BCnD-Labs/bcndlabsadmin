import type { ScreenKey } from "./destinations.ts"
import type { Slot } from "../screens/journal-review.ts"

/** Optional item to open; ordinary navigation clears a previous shortcut. */
export type NavigationTarget = { screen: "journal"; day: string; slot: Slot } | { screen: "dev"; projectId: string }
export function targetFor(screen: ScreenKey, target?: NavigationTarget): NavigationTarget | undefined {
  return target?.screen === screen ? target : undefined
}
