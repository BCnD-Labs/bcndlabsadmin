/**
 * How the app shows Blackwall. New installs open the native Android workspace.
 * An explicitly saved web choice remains available during the migration.
 */
export type ViewMode = "web" | "native"

export const VIEW_MODES: readonly { mode: ViewMode; label: string; available: boolean; note?: string }[] = [
  { mode: "web", label: "Web view", available: true },
  { mode: "native", label: "Native", available: true, note: "Connected workspace" },
]

/**
 * Where Web view starts: the server address, plus a page path when a native screen sent you to a specific page
 * (`/cms/pages`, `/social`). Only plain same-site paths are used; anything else starts at the home page.
 */
export function webStart(address: string, path?: unknown): string {
  const base = address.replace(/\/+$/, "")
  return typeof path === "string" && /^\/(?![/\\])[^\s]*$/.test(path) ? `${base}${path}` : base
}

export function sanitizeViewMode(stored: string | null | undefined, nativeAvailable: boolean): ViewMode {
  if (!nativeAvailable) return "web"
  return stored === "web" ? "web" : "native"
}
