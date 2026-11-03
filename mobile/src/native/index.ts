import type { ComponentType } from "react"
import { NativeShell } from "./NativeShell.tsx"

/**
 * Native Blackwall: screens read the shared workspace through ./data.
 * App.tsx renders NativeHome when the view mode is "native";
 * the web view stays one switch away in Settings and is still the default.
 */
export type NativeHomeProps = { address: string; onOpenSettings: () => void }

export const NativeHome: ComponentType<NativeHomeProps> | null = NativeShell
