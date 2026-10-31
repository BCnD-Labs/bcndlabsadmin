import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { DEFAULT_SLOTS, assignSlot, sanitizeSlots, swapSlots, type PanelType } from "@/lib/home-slots"
import { safeLocalStorage } from "./storage"

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
  set: (patch: Partial<Omit<PrefsState, "set" | "setSlot" | "swapSlots">>) => void
  /** Show `type` in slot `i`; if it's already in another slot, the two swap. */
  setSlot: (i: number, type: PanelType) => void
  swapSlots: (i: number, j: number) => void
}

type Persisted = Pick<PrefsState, "retroDetails" | "showSamples" | "workspaceName" | "autoHideSeconds" | "homeSlots">

export const PREFS_VERSION = 2

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      retroDetails: true,
      showSamples: false,
      workspaceName: "",
      autoHideSeconds: 5,
      homeSlots: [...DEFAULT_SLOTS],
      set: (patch) => set(patch),
      setSlot: (i, type) => set({ homeSlots: assignSlot(get().homeSlots, i, type) }),
      swapSlots: (i, j) => set({ homeSlots: swapSlots(get().homeSlots, i, j) }),
    }),
    {
      name: "blackwall.prefs",
      version: PREFS_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ retroDetails, showSamples, workspaceName, autoHideSeconds, homeSlots }): Persisted => ({
        retroDetails,
        showSamples,
        workspaceName,
        autoHideSeconds,
        homeSlots,
      }),
      // v1 → v2: adds autoHideSeconds and the Home slot layout.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Persisted>
        // (autoHideSeconds may already be there: it was saved under v1 before the bump.)
        if (version < 2) return { ...p, autoHideSeconds: p.autoHideSeconds ?? 5, homeSlots: p.homeSlots ?? [...DEFAULT_SLOTS] }
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
        }
      },
    },
  ),
)
