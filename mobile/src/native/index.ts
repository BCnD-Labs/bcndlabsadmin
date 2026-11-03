import type { ComponentType } from "react"
import { NativeShell } from "./NativeShell.tsx"

/**
 * Native Blackwall: screens on the workspace (the Planner is connected, see ./data) or on sample
 * data with a badge (see ./sample.ts) until their turn. App.tsx renders NativeHome when the view mode is "native";
 * the web view stays one switch away in Settings and is still the default.
 */
export type NativeHomeProps = { address: string; onOpenSettings: () => void }

export const NativeHome: ComponentType<NativeHomeProps> | null = NativeShell
