import type { ComponentType } from "react"
import { NativeShell } from "./NativeShell.tsx"

/**
 * Native Blackwall: a skeleton of screens on sample data (see ./sample.ts); nothing is
 * connected to the server yet. App.tsx renders NativeHome when the view mode is "native";
 * the web view stays one switch away in Settings and is still the default.
 */
export type NativeHomeProps = { address: string; onOpenSettings: () => void }

export const NativeHome: ComponentType<NativeHomeProps> | null = NativeShell
