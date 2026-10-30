import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeLocalStorage } from "./storage"

/** Per-browser interface preferences (not workspace data). */
interface PrefsState {
  railPinned: boolean
  edgeReveal: boolean
  retroDetails: boolean
  set: (patch: Partial<Omit<PrefsState, "set">>) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      railPinned: false,
      edgeReveal: true,
      retroDetails: true,
      set: (patch) => set(patch),
    }),
    {
      name: "blackwall.prefs",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ railPinned, edgeReveal, retroDetails }) => ({
        railPinned,
        edgeReveal,
        retroDetails,
      }),
    },
  ),
)
