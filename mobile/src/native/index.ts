import type { ComponentType } from "react"

/**
 * Native Blackwall screens go here, page by page, later. While this is null the
 * "Native" view mode stays disabled in Settings and the app always shows the web view.
 * To add the first native screen: export it here as NativeHome; App.tsx renders it when
 * the view mode is "native", and the web view stays available as the fallback.
 */
export type NativeHomeProps = { address: string; onOpenSettings: () => void }

export const NativeHome: ComponentType<NativeHomeProps> | null = null
