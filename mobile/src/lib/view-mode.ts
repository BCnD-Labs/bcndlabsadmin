/**
 * How the app shows Blackwall. "web" is the hosted web app in a WebView (working, default).
 * "native" shows the native skeleton screens (sample data, not connected yet); the web view
 * stays the default and the way back.
 */
export type ViewMode = "web" | "native"

export const VIEW_MODES: readonly { mode: ViewMode; label: string; available: boolean; note?: string }[] = [
  { mode: "web", label: "Web view", available: true },
  { mode: "native", label: "Native", available: true, note: "Skeleton: sample data, not connected" },
]

export function sanitizeViewMode(stored: string | null | undefined, nativeAvailable: boolean): ViewMode {
  return stored === "native" && nativeAvailable ? "native" : "web"
}
