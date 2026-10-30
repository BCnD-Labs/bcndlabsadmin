import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { newId } from "@/lib/ids"
import type {
  CalendarEvent,
  Draft,
  Note,
  Project,
  RepoLink,
  Task,
} from "@/lib/types"
import { createSeed } from "./seed"
import { safeLocalStorage } from "./storage"

/**
 * Local workspace records, persisted to localStorage under
 * `blackwall.workspace` with a schema version. When the schema changes, bump
 * WORKSPACE_VERSION and add a step to `migrate`.
 *
 * This store is the seam a future backend (e.g. the Soulkiller SQL service)
 * would replace: components only use the actions below, never localStorage.
 */
export const WORKSPACE_STORAGE_KEY = "blackwall.workspace"
export const WORKSPACE_VERSION = 1

export interface Collections {
  tasks: Task[]
  events: CalendarEvent[]
  notes: Note[]
  projects: Project[]
  repos: RepoLink[]
  drafts: Draft[]
}

export type CollectionKey = keyof Collections
export type Item<K extends CollectionKey> = Collections[K][number]
export type NewItem<K extends CollectionKey> = Omit<
  Item<K>,
  "id" | "createdAt" | "updatedAt"
>

const ID_PREFIX: Record<CollectionKey, string> = {
  tasks: "tsk",
  events: "evt",
  notes: "nte",
  projects: "prj",
  repos: "rep",
  drafts: "drf",
}

interface WorkspaceState extends Collections {
  create: <K extends CollectionKey>(key: K, input: NewItem<K>) => Item<K>
  update: <K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<NewItem<K>>,
  ) => void
  remove: (key: CollectionKey, id: string) => void
  toggleTask: (id: string) => void
  togglePin: (id: string) => void
  resetToSeed: () => void
  clearAll: () => void
}

const empty: Collections = {
  tasks: [],
  events: [],
  notes: [],
  projects: [],
  repos: [],
  drafts: [],
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...createSeed(),

      create: (key, input) => {
        const now = new Date().toISOString()
        const item = {
          ...input,
          id: newId(ID_PREFIX[key]),
          createdAt: now,
          updatedAt: now,
        } as Item<typeof key>
        set({ [key]: [item, ...get()[key]] } as Partial<Collections>)
        return item
      },

      update: (key, id, patch) => {
        const now = new Date().toISOString()
        set({
          [key]: (get()[key] as Item<typeof key>[]).map((it) =>
            it.id === id ? { ...it, ...patch, updatedAt: now } : it,
          ),
        } as Partial<Collections>)
      },

      remove: (key, id) => {
        const state = get()
        const next: Partial<Collections> = {
          [key]: (state[key] as { id: string }[]).filter((it) => it.id !== id),
        }
        // Deleting a project unlinks, rather than deletes, its records.
        if (key === "projects") {
          for (const k of ["tasks", "events", "notes", "repos", "drafts"] as const) {
            next[k] = (state[k] as { projectId?: string }[]).map((it) =>
              it.projectId === id ? { ...it, projectId: undefined } : it,
            ) as never
          }
        }
        set(next)
      },

      toggleTask: (id) => {
        const now = new Date().toISOString()
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? t.status === "done"
                ? { ...t, status: "todo", completedAt: undefined, updatedAt: now }
                : { ...t, status: "done", completedAt: now, updatedAt: now }
              : t,
          ),
        })
      },

      togglePin: (id) => {
        const now = new Date().toISOString()
        set({
          notes: get().notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned, updatedAt: now } : n,
          ),
        })
      },

      resetToSeed: () => set(createSeed()),
      clearAll: () => set(empty),
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      version: WORKSPACE_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): Collections => ({
        tasks: s.tasks,
        events: s.events,
        notes: s.notes,
        projects: s.projects,
        repos: s.repos,
        drafts: s.drafts,
      }),
      migrate: (persisted, version) => {
        // v0 → v1: no structural changes; future migrations go here.
        if (version < 1) return { ...empty, ...(persisted as Partial<Collections>) }
        return persisted as Collections
      },
    },
  ),
)

export function useProjectMap() {
  const projects = useWorkspace((s) => s.projects)
  return new Map(projects.map((p) => [p.id, p]))
}
