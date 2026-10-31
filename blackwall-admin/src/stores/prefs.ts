import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeLocalStorage } from "./storage"

/** Per-browser interface preferences (not workspace data). */
interface PrefsState {
  retroDetails: boolean
  /** Fill unconnected panels with sample data (clearly labelled) to preview layouts. */
  showSamples: boolean
  /** Shown beside the Blackwall wordmark. */
  workspaceName: string
  /** Seconds the calendar and notification cards stay open after the pointer leaves. */
  autoHideSeconds: number
  set: (patch: Partial<Omit<PrefsState, "set">>) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      retroDetails: true,
      showSamples: false,
      workspaceName: "",
      autoHideSeconds: 5,
      set: (patch) => set(patch),
    }),
    {
      name: "blackwall.prefs",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ retroDetails, showSamples, workspaceName, autoHideSeconds }) => ({
        retroDetails,
        showSamples,
        workspaceName,
        autoHideSeconds,
      }),
    },
  ),
)
