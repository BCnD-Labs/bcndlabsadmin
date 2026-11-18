import type { ComponentType } from "react"
import { NativeShell } from "./NativeShell.tsx"

/**
 * Native Blackwall: screens read the shared workspace through ./data.
 * App.tsx renders NativeHome when the view mode is "native";
 * the web view remains available in Settings while the remaining features move over.
 */
export type NativeHomeProps = { address: string; onOpenSettings: () => void; /** Switches the app to Web view (used by the crash fallback). */ onUseWeb: () => void }

export const NativeHome: ComponentType<NativeHomeProps> | null = NativeShell
