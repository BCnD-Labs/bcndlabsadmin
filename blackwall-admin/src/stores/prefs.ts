import type { ProviderId } from "@shared/connections"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { DEFAULT_SLOTS, OLD_DEFAULT_SLOTS, type PanelType } from "@/lib/home-slots"
import { safeLocalStorage } from "./storage"
import { DEFAULT_LAYOUT, layoutFromSlots, sanitizeLayout, type LayoutItem } from "@/lib/home-layout"
import { normalizeCoursePanels, type CoursePanels } from "@/lib/course-panels"

export type Theme = "dim" | "dark"
export type UiFont = "sans" | "mono"
export const ACCENTS = ["red", "blue", "violet", "cyan", "orange", "green", "pink"] as const
export type Accent = (typeof ACCENTS)[number]
export type Density = "comfortable" | "compact"
export type LayoutMode = "responsive" | "mobile"
export type TimeFormat = "12h" | "24h"
export type MotionPref = "system" | "reduce" | "full"
/** Pages you can land on when Blackwall opens at its root. */
export const LANDING_PAGES = [
  { value: "/", label: "Home" },
  { value: "/productivity", label: "Planner" },
  { value: "/productivity/learning", label: "Learning" },
  { value: "/development", label: "GitHub activity" },
  { value: "/cms", label: "Website" },
  { value: "/social", label: "Social" },
] as const
export type LandingPage = (typeof LANDING_PAGES)[number]["value"]

/** Per-browser interface preferences (not workspace data). */
interface PrefsState {
  categoryColors: boolean
  /** Explicit read-only feed choices; publishing remains installation-wide. */
  feedConnections: Partial<Record<"github" | "analytics", string>>
  retroDetails: boolean
  /** Fill unconnected panels with sample data (clearly labelled) to preview layouts. */
  showSamples: boolean
  /** Used in the Home greeting and the rail's initials. */
  workspaceName: string
  /** Seconds the calendar and notification cards stay open after the pointer leaves. */
  autoHideSeconds: number
  /** Calendar and notification cards stay open until closed (ignores autoHideSeconds). */
  keepCardsOpen: boolean
  /** First day of the week in the calendar, Planner and Insights: 0 Sunday, 1 Monday. */
  weekStartsOn: 0 | 1
  timeFormat: TimeFormat
  /** Where "/" lands when the app opens (Home unless changed). */
  landingPage: LandingPage
  /** Animations: follow the system setting, always reduce, or always full. */
  motion: MotionPref
  /** Mikoshi launcher: compact rows (default) or an icon grid. */
  launcherView: "rows" | "grid"
  /** CMS: the site the Website section is showing. */
  cmsSiteId: string
  /** Social: the platform and brand filters (empty = all). */
  socialPlatforms: string[]
  socialBrands: string[]
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
  /** On phone-sized screens: the responsive layout (default) or the dedicated mobile view. */
  layoutMode: LayoutMode
  /** Learning: per course id, the item types whose extra focused card is on (all off by default). */
  coursePanels: CoursePanels
  set: (patch: Partial<Omit<PrefsState, "set" | "reset">>) => void
  /** Back to the defaults below (workspace data isn't touched). */
  reset: () => void
}

type Persisted = Omit<PrefsState, "set" | "reset">
/** Older stored shapes, read only by the migration. */
type Legacy = Partial<Persisted> & { homeSlots?: PanelType[]; showHomeProjects?: boolean; showHomeLog?: boolean }

export const PREFS_VERSION = 7

const DEFAULT_PREFS = (): Persisted => ({
  categoryColors: true,
  feedConnections: {},
  retroDetails: true,
  showSamples: false,
  workspaceName: "",
  autoHideSeconds: 5,
  keepCardsOpen: false,
  weekStartsOn: 0,
  timeFormat: "12h",
  landingPage: "/",
  motion: "system",
  launcherView: "rows",
  cmsSiteId: "",
  socialPlatforms: [],
  socialBrands: [],
  navExpanded: false,
  theme: "dim",
  uiFont: "sans",
  homeLayout: DEFAULT_LAYOUT.map((b) => ({ ...b })),
  accent: "red",
  density: "comfortable",
  navLabels: {},
  navHidden: [],
  layoutMode: "responsive",
  coursePanels: {},
})

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS(),
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_PREFS()),
    }),
    {
      name: "blackwall.prefs",
      version: PREFS_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ set: _set, reset: _reset, ...rest }): Persisted => rest,
      // v1 → v2: adds autoHideSeconds and the Home slot layout.
      // v2 → v3: new panel types; a Home still on the old default (one panel, three empty) gets the new default.
      migrate: (persisted, version) => {
        let p = (persisted ?? {}) as Legacy
        // (autoHideSeconds may already be there: it was saved under v1 before the bump.)
        if (version < 2) p = { ...p, autoHideSeconds: p.autoHideSeconds ?? 5, homeSlots: p.homeSlots ?? [...OLD_DEFAULT_SLOTS] }
        if (version < 3 && JSON.stringify(p.homeSlots) === JSON.stringify(OLD_DEFAULT_SLOTS)) p = { ...p, homeSlots: [...DEFAULT_SLOTS] }
        // v4 → v5: the four slots become the full Home layout, keeping your chosen panels and their order.
        if (version < 5) p = { ...p, homeLayout: layoutFromSlots(p.homeSlots, p.showHomeProjects !== false, p.showHomeLog !== false) }
        // v5 → v6: the four-slot fields are gone (Home layout replaced them); new options take their defaults.
        const { homeSlots: _a, showHomeProjects: _b, showHomeLog: _c, ...rest } = p as Legacy & { homeSizing?: unknown }
        delete (rest as Record<string, unknown>).homeSizing
        // v6 → v7: Learning becomes its own sidebar section ("learning"), visible by default. No saved
        // name or hidden flag could exist for it yet; clear any so it starts as Learning, shown.
        if (version < 7) {
          if (Array.isArray(rest.navHidden)) rest.navHidden = rest.navHidden.filter((id) => id !== "learning")
          if (rest.navLabels && typeof rest.navLabels === "object") {
            const { learning: _l, ...labels } = rest.navLabels as Record<string, string>
            rest.navLabels = labels
          }
        }
        return rest
      },
      // Never trust stored values blindly: unknown panel types or bad numbers fall back to defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Persisted>
        const secs = Number(p.autoHideSeconds)
        return {
          ...current,
          ...p,
          autoHideSeconds: Number.isFinite(secs) ? Math.min(15, Math.max(2, Math.round(secs))) : current.autoHideSeconds,
          categoryColors: p.categoryColors !== false,
          keepCardsOpen: p.keepCardsOpen === true,
          weekStartsOn: p.weekStartsOn === 1 ? 1 : 0,
          timeFormat: p.timeFormat === "24h" ? "24h" : "12h",
          landingPage: LANDING_PAGES.some((l) => l.value === p.landingPage) ? (p.landingPage as LandingPage) : "/",
          motion: p.motion === "reduce" || p.motion === "full" ? p.motion : "system",
          launcherView: p.launcherView === "grid" ? "grid" : "rows",
          cmsSiteId: typeof p.cmsSiteId === "string" ? p.cmsSiteId.slice(0, 40) : "",
          socialPlatforms: strList(p.socialPlatforms),
          socialBrands: strList(p.socialBrands),
          feedConnections: sanitizeFeedConnections(p.feedConnections),
          navExpanded: p.navExpanded === true,
          theme: p.theme === "dark" ? "dark" : "dim",
          uiFont: p.uiFont === "mono" ? "mono" : "sans",
          homeLayout: sanitizeLayout(p.homeLayout),
          accent: (ACCENTS as readonly unknown[]).includes(p.accent) ? (p.accent as Accent) : "red",
          density: p.density === "compact" ? "compact" : "comfortable",
          layoutMode: p.layoutMode === "mobile" ? "mobile" : "responsive",
          coursePanels: normalizeCoursePanels(p.coursePanels),
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
function applyLook({ theme, uiFont, categoryColors, accent, density, motion }: Pick<PrefsState, "theme" | "uiFont" | "categoryColors" | "accent" | "density" | "motion">) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.motion = motion
  document.documentElement.dataset.accent = accent
  document.documentElement.dataset.density = density
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.font = uiFont
  document.documentElement.dataset.categoryColors = categoryColors ? "on" : "off"
}
applyLook(usePrefs.getState())
usePrefs.subscribe(applyLook)

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, 30) : []
}
