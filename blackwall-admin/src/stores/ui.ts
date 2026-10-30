import { create } from "zustand"
import type { Note, Project, RepoLink, Task } from "@/lib/types"

/** Which record form is open. One dialog host renders these app-wide. */
export type FormRequest =
  | { kind: "task"; id?: string; defaults?: Partial<Task> }
  | { kind: "note"; id?: string; defaults?: Partial<Note> }
  | { kind: "project"; id?: string; defaults?: Partial<Project> }
  | { kind: "repo"; id?: string; defaults?: Partial<RepoLink> }

interface UiState {
  form: FormRequest | null
  searchOpen: boolean
  /** Small screens only; desktop uses the always-visible icon strip. */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  openForm: (req: FormRequest) => void
  closeForm: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  form: null,
  searchOpen: false,
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  openForm: (form) => set({ form }),
  closeForm: () => set({ form: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))
