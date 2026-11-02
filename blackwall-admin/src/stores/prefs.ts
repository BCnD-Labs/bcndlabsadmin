import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { DEFAULT_SLOTS, OLD_DEFAULT_SLOTS, assignSlot, sanitizeSlots, swapSlots, type PanelType } from "@/lib/home-slots"
import { safeLocalStorage } from "./storage"

export type Theme = "dim" | "dark"
export type UiFont = "sans" | "mono"

/** Per-browser interface preferences (not workspace data). */
interface PrefsState {
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
  set: (patch: Partial<Omit<PrefsState, "set" | "setSlot" | "swapSlots" | "reset">>) => void
  /** Show `type` in slot `i`; if it's already in another slot, the two swap. */
  setSlot: (i: number, type: PanelType) => void
  swapSlots: (i: number, j: number) => void
  /** Back to the defaults below (workspace data isn't touched). */
  reset: () => void
}

type Persisted = Pick<PrefsState, "retroDetails" | "showSamples" | "workspaceName" | "autoHideSeconds" | "homeSlots" | "navExpanded" | "theme" | "uiFont">

export const PREFS_VERSION = 3

const DEFAULT_PREFS = (): Persisted => ({
  retroDetails: true,
  showSamples: false,
  workspaceName: "",
  autoHideSeconds: 5,
  homeSlots: [...DEFAULT_SLOTS],
  navExpanded: false,
  theme: "dim",
  uiFont: "sans",
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
      partialize: ({ retroDetails, showSamples, workspaceName, autoHideSeconds, homeSlots, navExpanded, theme, uiFont }): Persisted => ({
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
          navExpanded: p.navExpanded === true,
          theme: p.theme === "dark" ? "dark" : "dim",
          uiFont: p.uiFont === "mono" ? "mono" : "sans",
        }
      },
    },
  ),
)

/** Theme and font live on <html> so every screen (sign-in included) follows them. */
function applyLook({ theme, uiFont }: Pick<PrefsState, "theme" | "uiFont">) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.font = uiFont
}
applyLook(usePrefs.getState())
usePrefs.subscribe(applyLook)
