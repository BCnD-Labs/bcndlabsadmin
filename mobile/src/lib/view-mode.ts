/**
 * How the app shows Blackwall. "web" is the hosted web app in a WebView (working, default).
 * "native" will show native screens once they exist; until then it can't be chosen and a
 * stored "native" falls back to "web".
 */
export type ViewMode = "web" | "native"

export const VIEW_MODES: readonly { mode: ViewMode; label: string; available: boolean; note?: string }[] = [
  { mode: "web", label: "Web view", available: true },
  { mode: "native", label: "Native", available: false, note: "Not built yet" },
]

export function sanitizeViewMode(stored: string | null | undefined, nativeAvailable: boolean): ViewMode {
  return stored === "native" && nativeAvailable ? "native" : "web"
}
