import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeLocalStorage } from "@/stores/storage"
import { afterClose, withDoc, type OpenDoc } from "./docs-tabs"

export type { OpenDoc }

interface DocsState {
  /** Documents open in the Docs app, in the order they were opened. */
  docs: OpenDoc[]
  active: string | null
  /** Goes up each time something asks to see Docs, so the app shell can bring that window forward. */
  request: number
  open: (path: string) => void
  activate: (path: string) => void
  close: (path: string) => void
}

/** Which Nextcloud documents are open in the Docs app. They are remembered between launches (just the paths; the files stay in Nextcloud). */
export const useDocs = create<DocsState>()(
  persist(
    (set) => ({
      docs: [],
      active: null,
      request: 0,
      open: (path) => set((s) => ({ docs: withDoc(s.docs, path), active: path, request: s.request + 1 })),
      activate: (path) => set({ active: path }),
      close: (path) => set((s) => afterClose(s.docs, s.active, path)),
    }),
    { name: "blackwall-open-docs", storage: createJSONStorage(() => safeLocalStorage), partialize: (s) => ({ docs: s.docs, active: s.active }) },
  ),
)
