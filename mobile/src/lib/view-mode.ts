/**
 * How the app shows Blackwall. "web" is the hosted web app in a WebView (working, default).
 * "native" shows the connected Android workspace; the web view remains available.
 */
export type ViewMode = "web" | "native"

export const VIEW_MODES: readonly { mode: ViewMode; label: string; available: boolean; note?: string }[] = [
  { mode: "web", label: "Web view", available: true },
  { mode: "native", label: "Native", available: true, note: "Connected workspace" },
]

export function sanitizeViewMode(stored: string | null | undefined, nativeAvailable: boolean): ViewMode {
  return stored === "native" && nativeAvailable ? "native" : "web"
}
