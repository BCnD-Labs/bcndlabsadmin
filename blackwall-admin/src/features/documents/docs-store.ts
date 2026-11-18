import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeLocalStorage } from "@/stores/storage"
import { afterClose, withDoc, type OpenDoc } from "./docs-tabs"

export type { OpenDoc }

interface DocsState {
  /** Documents open in the Docs app, in the order they were opened. */
  docs: OpenDoc[]
  active: string | null
  /** Documents being edited right now (not remembered between launches: the editor asks Nextcloud for a fresh page each time). */
  editing: string[]
  /** Goes up each time editing stops, so the viewer reloads the file with what was just saved. */
  saved: number
  /** Goes up each time something asks to see Docs, so the app shell can bring that window forward. */
  request: number
  open: (path: string) => void
  activate: (path: string) => void
  close: (path: string) => void
  startEdit: (path: string) => void
  stopEdit: (path: string) => void
}

/** Which Nextcloud documents are open in the Docs app. They are remembered between launches (just the paths; the files stay in Nextcloud). */
export const useDocs = create<DocsState>()(
  persist(
    (set) => ({
      docs: [],
      active: null,
      editing: [],
      saved: 0,
      request: 0,
      open: (path) => set((s) => ({ docs: withDoc(s.docs, path), active: path, request: s.request + 1 })),
      activate: (path) => set({ active: path }),
      close: (path) => set((s) => ({ ...afterClose(s.docs, s.active, path), editing: s.editing.filter((p) => p !== path) })),
      startEdit: (path) => set((s) => ({ editing: s.editing.includes(path) ? s.editing : [...s.editing, path] })),
      stopEdit: (path) => set((s) => ({ editing: s.editing.filter((p) => p !== path), saved: s.saved + 1 })),
    }),
    { name: "blackwall-open-docs", storage: createJSONStorage(() => safeLocalStorage), partialize: (s) => ({ docs: s.docs, active: s.active }) },
  ),
)
