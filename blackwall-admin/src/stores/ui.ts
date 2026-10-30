import { create } from "zustand"
import type { CalendarEvent, Note, Project, RepoLink, Task } from "@/lib/types"

/** Which record form is open. One dialog host renders these app-wide. */
export type FormRequest =
  | { kind: "task"; id?: string; defaults?: Partial<Task> }
  | { kind: "event"; id?: string; defaults?: Partial<CalendarEvent> }
  | { kind: "note"; id?: string; defaults?: Partial<Note> }
  | { kind: "project"; id?: string; defaults?: Partial<Project> }
  | { kind: "repo"; id?: string; defaults?: Partial<RepoLink> }

interface UiState {
  form: FormRequest | null
  searchOpen: boolean
  /** Desktop rail revealed (hover or menu button). Mobile uses `mobileNavOpen`. */
  railOpen: boolean
  railFocusRequest: number
  mobileNavOpen: boolean
  menuButton: HTMLButtonElement | null
  setRailOpen: (open: boolean) => void
  requestRailFocus: () => void
  setMobileNavOpen: (open: boolean) => void
  setMenuButton: (el: HTMLButtonElement | null) => void
  openForm: (req: FormRequest) => void
  closeForm: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  form: null,
  searchOpen: false,
  railOpen: false,
  railFocusRequest: 0,
  mobileNavOpen: false,
  menuButton: null,
  setRailOpen: (railOpen) => set({ railOpen }),
  requestRailFocus: () =>
    set((s) => ({ railOpen: true, railFocusRequest: s.railFocusRequest + 1 })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setMenuButton: (menuButton) => set({ menuButton }),
  openForm: (form) => set({ form }),
  closeForm: () => set({ form: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))
