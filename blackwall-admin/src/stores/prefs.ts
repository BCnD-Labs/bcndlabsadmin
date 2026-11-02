import type { ProviderId } from "@shared/connections"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { DEFAULT_SLOTS, OLD_DEFAULT_SLOTS, assignSlot, sanitizeSlots, swapSlots, type PanelType } from "@/lib/home-slots"
import { safeLocalStorage } from "./storage"
import { DEFAULT_LAYOUT, layoutFromSlots, sanitizeLayout, type LayoutItem } from "@/lib/home-layout"

export type Theme = "dim" | "dark"
export type UiFont = "sans" | "mono"
export const ACCENTS = ["red", "blue", "violet", "cyan", "orange", "green", "pink"] as const
export type Accent = (typeof ACCENTS)[number]
export type Density = "comfortable" | "compact"

/** Per-browser interface preferences (not workspace data). */
interface PrefsState {
  categoryColors: boolean
  homeSizing: "fit" | "uniform"
  showHomeProjects: boolean
  showHomeLog: boolean
  /** Explicit read-only feed choices; publishing remains installation-wide. */
  feedConnections: Partial<Record<"github" | "analytics", string>>
  retroDetails: boolean
  /** Fill unconnected panels with sample data (clearly labelled) to preview layouts. */
  showSamples: boolean
  /** Used in the Home greeting and the rail's initials. */
  workspaceName: string
  /** Seconds the calendar and notification cards stay open after the pointer leaves. */
  autoHideSeconds: number
  /** What each of the four Home squares shows. */
  homeSlots: PanelType[]
  /** Desktop sidebar: the full tree (true) or the icon strip with hover flyouts (false). */
  navExpanded: boolean
  /** Colour theme: Dim (mid-tone slate, default) or Dark (the original near-black). */
  theme: Theme
  /** Interface text: the system sans (default) or JetBrains Mono everywhere. */
  uiFont: UiFont
  /** Home: every block in order, with visibility and width (replaces homeSlots from v5). */
  homeLayout: LayoutItem[]
  /** Brand/action color for buttons, the logo and active markers. */
  accent: Accent
  /** Spacing between and inside panels. */
  density: Density
  /** Sidebar: your own names for sections (by destination id) and which ones are hidden. */
  navLabels: Record<string, string>
  navHidden: string[]
  set: (patch: Partial<Omit<PrefsState, "set" | "setSlot" | "swapSlots" | "reset">>) => void
  /** Show `type` in slot `i`; if it's already in another slot, the two swap. */
  setSlot: (i: number, type: PanelType) => void
  swapSlots: (i: number, j: number) => void
  /** Back to the defaults below (workspace data isn't touched). */
  reset: () => void
}

type Persisted = Pick<PrefsState, "categoryColors" | "homeSizing" | "showHomeProjects" | "showHomeLog" | "feedConnections" | "retroDetails" | "showSamples" | "workspaceName" | "autoHideSeconds" | "homeSlots" | "navExpanded" | "theme" | "uiFont" | "homeLayout" | "accent" | "density" | "navLabels" | "navHidden">

export const PREFS_VERSION = 5

const DEFAULT_PREFS = (): Persisted => ({
  categoryColors: true,
  homeSizing: "fit",
  showHomeProjects: true,
  showHomeLog: true,
  feedConnections: {},
  retroDetails: true,
  showSamples: false,
  workspaceName: "",
  autoHideSeconds: 5,
  homeSlots: [...DEFAULT_SLOTS],
  navExpanded: false,
  theme: "dim",
  uiFont: "sans",
  homeLayout: DEFAULT_LAYOUT.map((b) => ({ ...b })),
  accent: "red",
  density: "comfortable",
  navLabels: {},
  navHidden: [],
})

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFS(),
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_PREFS()),
      setSlot: (i, type) => set({ homeSlots: assignSlot(get().homeSlots, i, type) }),
      swapSlots: (i, j) => set({ homeSlots: swapSlots(get().homeSlots, i, j) }),
    }),
    {
      name: "blackwall.prefs",
      version: PREFS_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ categoryColors, homeSizing, showHomeProjects, showHomeLog, feedConnections, retroDetails, showSamples, workspaceName, autoHideSeconds, homeSlots, navExpanded, theme, uiFont, homeLayout, accent, density, navLabels, navHidden }): Persisted => ({
        homeLayout, accent, density, navLabels, navHidden,
        categoryColors, homeSizing, showHomeProjects, showHomeLog, feedConnections,
        retroDetails,
        showSamples,
        workspaceName,
        autoHideSeconds,
        homeSlots,
        navExpanded,
        theme,
        uiFont,
      }),
      // v1 → v2: adds autoHideSeconds and the Home slot layout.
      // v2 → v3: new panel types; a Home still on the old default (one panel, three empty) gets the new default.
      migrate: (persisted, version) => {
        let p = (persisted ?? {}) as Partial<Persisted>
        // (autoHideSeconds may already be there: it was saved under v1 before the bump.)
        if (version < 2) p = { ...p, autoHideSeconds: p.autoHideSeconds ?? 5, homeSlots: p.homeSlots ?? [...OLD_DEFAULT_SLOTS] }
        if (version < 3 && JSON.stringify(p.homeSlots) === JSON.stringify(OLD_DEFAULT_SLOTS)) p = { ...p, homeSlots: [...DEFAULT_SLOTS] }
        // v4 → v5: the four slots become the full Home layout, keeping your chosen panels and their order.
        if (version < 5) p = { ...p, homeLayout: layoutFromSlots(p.homeSlots, p.showHomeProjects !== false, p.showHomeLog !== false) }
        return p
      },
      // Never trust stored values blindly: unknown panel types or bad numbers fall back to defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Persisted>
        const secs = Number(p.autoHideSeconds)
        return {
          ...current,
          ...p,
          autoHideSeconds: Number.isFinite(secs) ? Math.min(15, Math.max(2, Math.round(secs))) : current.autoHideSeconds,
          homeSlots: sanitizeSlots(p.homeSlots),
          categoryColors: p.categoryColors !== false,
          homeSizing: p.homeSizing === "uniform" ? "uniform" : "fit",
          showHomeProjects: p.showHomeProjects !== false,
          showHomeLog: p.showHomeLog !== false,
          feedConnections: sanitizeFeedConnections(p.feedConnections),
          navExpanded: p.navExpanded === true,
          theme: p.theme === "dark" ? "dark" : "dim",
          uiFont: p.uiFont === "mono" ? "mono" : "sans",
          homeLayout: sanitizeLayout(p.homeLayout),
          accent: (ACCENTS as readonly unknown[]).includes(p.accent) ? (p.accent as Accent) : "red",
          density: p.density === "compact" ? "compact" : "comfortable",
          navLabels: sanitizeLabels(p.navLabels),
          navHidden: Array.isArray(p.navHidden) ? p.navHidden.filter((v): v is string => typeof v === "string" && v !== "home").slice(0, 20) : [],
        }
      },
    },
  ),
)

function sanitizeLabels(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {}
  return Object.fromEntries(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" && v.trim() && k.length <= 40 ? [[k, v.trim().slice(0, 32)]] : [])))
}

function sanitizeFeedConnections(raw: unknown): Persisted["feedConnections"] {
  if (!raw || typeof raw !== "object") return {}
  const input = raw as Partial<Record<ProviderId, unknown>>
  return Object.fromEntries((["github", "analytics"] as const).flatMap((key) => typeof input[key] === "string" && input[key].length <= 80 ? [[key, input[key]]] : []))
}

/** Theme and font live on <html> so every screen (sign-in included) follows them. */
function applyLook({ theme, uiFont, categoryColors, accent, density }: Pick<PrefsState, "theme" | "uiFont" | "categoryColors" | "accent" | "density">) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.accent = accent
  document.documentElement.dataset.density = density
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.font = uiFont
  document.documentElement.dataset.categoryColors = categoryColors ? "on" : "off"
}
applyLook(usePrefs.getState())
usePrefs.subscribe(applyLook)
