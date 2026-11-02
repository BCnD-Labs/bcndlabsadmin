import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { newId } from "@/lib/ids"
import type { JournalEntry, Note, Task } from "@/lib/types"
import { V1_EXAMPLE_IDS } from "./seed"
import { safeLocalStorage } from "./storage"

/** Versioned browser cache. services/workspace-sync reconciles every change with
 * the authenticated server; existing records migrate without changing their IDs.
 */
export const WORKSPACE_STORAGE_KEY = "blackwall.workspace"
export const WORKSPACE_VERSION = 4

export type { Collections } from "@shared/workspace"
import type { Collections } from "@shared/workspace"

type GenericKey = Exclude<keyof Collections, "journal">
export type Item<K extends GenericKey> = Collections[K][number]
export type NewItem<K extends GenericKey> = Omit<Item<K>, "id" | "createdAt" | "updatedAt">

const ID_PREFIX: Record<GenericKey, string> = {
  tasks: "tsk",
  notes: "nte",
  projects: "prj",
  repos: "rep",
  drafts: "drf",
  courses: "crs",
  services: "svc",
  sites: "sit",
  pages: "pag",
  forms: "frm",
}

interface WorkspaceState extends Collections {
  create: <K extends GenericKey>(key: K, input: NewItem<K>) => Item<K>
  update: <K extends GenericKey>(key: K, id: string, patch: Partial<NewItem<K>>) => void
  remove: (key: GenericKey, id: string) => void
  toggleTask: (id: string) => void
  toggleStar: (id: string) => void
  togglePin: (id: string) => void
  /** Upsert the log for a day; an empty text deletes it. */
  saveJournal: (date: string, text: string) => void
  /** Move a day's log to another date, appending if that day already has one. */
  moveJournal: (from: string, to: string) => void
  clearAll: () => void
}

const empty: Collections = { tasks: [], notes: [], journal: [], projects: [], repos: [], drafts: [], courses: [], services: [], sites: [], pages: [], forms: [] }
const now = () => new Date().toISOString()

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...empty,

      create: (key, input) => {
        const t = now()
        const item = { ...input, id: newId(ID_PREFIX[key]), createdAt: t, updatedAt: t } as Item<typeof key>
        set({ [key]: [item, ...get()[key]] } as Partial<Collections>)
        return item
      },

      update: (key, id, patch) => {
        const t = now()
        set({
          [key]: (get()[key] as Item<typeof key>[]).map((it) => (it.id === id ? { ...it, ...patch, updatedAt: t } : it)),
        } as Partial<Collections>)
      },

      remove: (key, id) => {
        const state = get()
        const next: Partial<Collections> = {
          [key]: (state[key] as { id: string }[]).filter((it) => it.id !== id),
        }
        // Deleting a project unlinks, rather than deletes, its repos and drafts.
        if (key === "projects") {
          next.repos = state.repos.map((r) => (r.projectId === id ? { ...r, projectId: undefined } : r))
          next.drafts = state.drafts.map((d) => (d.projectId === id ? { ...d, projectId: undefined } : d))
        }
        // Deleting a course deletes its coursework (it only means something with the course)
        // and unlinks, rather than deletes, its notes.
        if (key === "courses") {
          next.tasks = state.tasks.filter((t) => t.courseId !== id)
          next.notes = state.notes.map((n) => (n.courseId === id ? { ...n, courseId: undefined } : n))
        }
        // Deleting a site deletes its pages; its posts stay as unassigned drafts.
        if (key === "sites") {
          next.pages = state.pages.filter((p) => p.siteId !== id)
          next.drafts = state.drafts.map((d) => (d.siteId === id ? { ...d, siteId: undefined } : d))
        }
        set(next)
      },

      toggleTask: (id) => {
        const t = now()
        set({
          tasks: get().tasks.map((task) =>
            task.id === id
              ? { ...task, done: !task.done, completedAt: task.done ? undefined : t, updatedAt: t }
              : task,
          ),
        })
      },

      toggleStar: (id) =>
        set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, starred: !t.starred, updatedAt: now() } : t)) }),

      togglePin: (id) =>
        set({ notes: get().notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: now() } : n)) }),

      saveJournal: (date, text) => {
        const t = now()
        const existing = get().journal.find((j) => j.id === date)
        if (!text.trim()) {
          set({ journal: get().journal.filter((j) => j.id !== date) })
        } else if (existing) {
          set({ journal: get().journal.map((j) => (j.id === date ? { ...j, text, updatedAt: t } : j)) })
        } else {
          set({ journal: [...get().journal, { id: date, text, createdAt: t, updatedAt: t }] })
        }
      },

      moveJournal: (from, to) => {
        if (from === to) return
        const src = get().journal.find((j) => j.id === from)
        if (!src) return
        const dest = get().journal.find((j) => j.id === to)
        get().saveJournal(to, dest ? `${dest.text}\n\n${src.text}` : src.text)
        get().saveJournal(from, "")
      },

      clearAll: () => set(empty),
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      version: WORKSPACE_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): Collections => ({
        tasks: s.tasks,
        notes: s.notes,
        journal: s.journal,
        projects: s.projects,
        repos: s.repos,
        drafts: s.drafts,
        courses: s.courses,
        services: s.services,
        sites: s.sites,
        pages: s.pages,
        forms: s.forms,
      }),
      migrate: (persisted, version) => migrateWorkspace(persisted as Record<string, unknown[]>, version),
    },
  ),
)

/* eslint-disable @typescript-eslint/no-explicit-any */
export function migrateWorkspace(raw: Record<string, any[]>, version: number): Collections {
  let d: Record<string, any[]> = { ...raw }

  if (version < 2) {
    // v1 → v2: drop the example records v1 seeded; keep everything you created.
    const keep = (list: any[] = []) =>
      list
        .filter((r) => !V1_EXAMPLE_IDS.has(r.id))
        .map((r) => (r.projectId && V1_EXAMPLE_IDS.has(r.projectId) ? { ...r, projectId: undefined } : r))
    d = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, keep(v)]))
  }

  if (version < 3) {
    // v2 → v3: simpler tasks, sticky notes, and a daily log instead of events.
    const tasks: Task[] = (d.tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      details: t.notes || undefined,
      due: t.due,
      starred: t.priority === "urgent" || t.priority === "high",
      done: t.status === "done",
      completedAt: t.status === "done" ? (t.completedAt ?? t.updatedAt) : undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
    const notes: Note[] = (d.notes ?? []).map((n) => ({
      id: n.id,
      text: [n.title, n.url, n.body].filter(Boolean).join("\n"),
      color: n.kind === "reference" ? "teal" : n.kind === "link" ? "blue" : "plain",
      pinned: !!n.pinned,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }))
    // Events become lines in that day's log so nothing is lost.
    const byDay = new Map<string, string[]>()
    for (const e of [...(d.events ?? [])].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))) {
      const line = `- ${e.start ? `${e.start} ` : ""}${e.title}${e.location ? ` (${e.location})` : ""}${e.notes ? `: ${e.notes}` : ""}`
      byDay.set(e.date, [...(byDay.get(e.date) ?? []), line])
    }
    const t = now()
    const journal: JournalEntry[] = [...byDay].map(([date, lines]) => ({ id: date, text: lines.join("\n"), createdAt: t, updatedAt: t }))
    d = { ...d, tasks, notes, journal }
    delete d.events
  }

  // v3 → v4: adds courses (Learning); tasks and notes gain optional course links. Nothing to convert.

  return { ...empty, ...(d as Partial<Collections>) }
}

export function useProjectMap() {
  const projects = useWorkspace((s) => s.projects)
  return new Map(projects.map((p) => [p.id, p]))
}

export function useCourseMap() {
  const courses = useWorkspace((s) => s.courses)
  return new Map(courses.map((c) => [c.id, c]))
}
