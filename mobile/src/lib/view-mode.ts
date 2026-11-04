/**
 * How the app shows Blackwall. New installs open the native Android workspace.
 * An explicitly saved web choice remains available during the migration.
 */
export type ViewMode = "web" | "native"

export const VIEW_MODES: readonly { mode: ViewMode; label: string; available: boolean; note?: string }[] = [
  { mode: "web", label: "Web view", available: true },
  { mode: "native", label: "Native", available: true, note: "Connected workspace" },
]

export function sanitizeViewMode(stored: string | null | undefined, nativeAvailable: boolean): ViewMode {
  if (!nativeAvailable) return "web"
  return stored === "web" ? "web" : "native"
}
