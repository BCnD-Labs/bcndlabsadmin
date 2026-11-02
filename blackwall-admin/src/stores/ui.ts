import { create } from "zustand"
import type { ProviderId } from "@shared/connections"
import type { Course, Note, Project, RepoLink, Service, Task } from "@/lib/types"

export type SettingsSection = "general" | "appearance" | "home" | "sidebar" | "notifications" | "connections" | "data" | "server" | "shortcuts" | "about"

/** Which record form is open. One dialog host renders these app-wide. */
export type FormRequest =
  | { kind: "task"; id?: string; defaults?: Partial<Task> }
  | { kind: "note"; id?: string; defaults?: Partial<Note> }
  | { kind: "project"; id?: string; defaults?: Partial<Project> }
  | { kind: "repo"; id?: string; defaults?: Partial<RepoLink> }
  | { kind: "course"; id?: string; defaults?: Partial<Course> }
  | { kind: "service"; id?: string; defaults?: Partial<Service> }
  | { kind: "site"; id?: string; defaults?: undefined }
  | { kind: "sitePage"; id?: string; defaults?: undefined }
  | { kind: "siteForm"; id?: string; defaults?: undefined }

interface UiState {
  form: FormRequest | null
  searchOpen: boolean
  /** Small screens only; desktop uses the always-visible icon strip. */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  /** The settings modal: which section is showing, and a provider to start connecting. */
  settings: { section: SettingsSection; add?: ProviderId } | null
  openSettings: (section?: SettingsSection, add?: ProviderId) => void
  closeSettings: () => void
  /** Forget the `add` request once the Connections section has acted on it. */
  clearSettingsAdd: () => void
  openForm: (req: FormRequest) => void
  closeForm: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  form: null,
  searchOpen: false,
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  settings: null,
  openSettings: (section = "general", add) => set({ settings: { section, add }, mobileNavOpen: false }),
  closeSettings: () => set({ settings: null }),
  clearSettingsAdd: () => set((s) => (s.settings ? { settings: { section: s.settings.section } } : {})),
  openForm: (form) => set({ form }),
  closeForm: () => set({ form: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))
