import type { Collections } from "../../lib/shared.ts"

/** What the quick-add menu can start. Each one opens the same editor its own screen uses. */
export type QuickKind = "task" | "event" | "note" | "learning" | "reflection" | "reflect-on" | "project" | "draft" | "site" | "tool"
export type QuickGroup = "Create" | "Reflect" | "Build"
export interface QuickAction { kind: QuickKind; label: string; hint: string; icon: "checkbox-outline" | "calendar-outline" | "document-text-outline" | "school-outline" | "create-outline" | "search-outline" | "folder-outline" | "globe-outline" | "server-outline"; group: QuickGroup }

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { kind: "task", label: "Task", hint: "Something to do", icon: "checkbox-outline", group: "Create" },
  { kind: "event", label: "Event", hint: "Something on the calendar", icon: "calendar-outline", group: "Create" },
  { kind: "note", label: "Note", hint: "A quick note", icon: "document-text-outline", group: "Create" },
  { kind: "learning", label: "Learning item", hint: "Course, book, skill or certification", icon: "school-outline", group: "Create" },
  { kind: "reflection", label: "Add reflection", hint: "Write one now", icon: "create-outline", group: "Reflect" },
  { kind: "reflect-on", label: "Reflect on…", hint: "Pick a task, event or learning item", icon: "search-outline", group: "Reflect" },
  { kind: "project", label: "Project", hint: "Track a build", icon: "folder-outline", group: "Build" },
  { kind: "draft", label: "Website draft", hint: "A page in progress", icon: "globe-outline", group: "Build" },
  { kind: "site", label: "Site", hint: "A website you run", icon: "globe-outline", group: "Build" },
  { kind: "tool", label: "Tool", hint: "A homelab service link", icon: "server-outline", group: "Build" },
]

export const QUICK_GROUPS: readonly QuickGroup[] = ["Create", "Reflect", "Build"]

export interface ReflectTarget { key: string; kind: "task" | "event" | "course"; title: string; sub: string; courseId?: string; taskId?: string }
type Source = Pick<Collections, "tasks" | "courses">

/**
 * Things a reflection can be about: open tasks, then upcoming events, then learning items, then finished tasks (newest first).
 * A search matches the title or the learning item's name. Nothing is invented: every row is a saved record.
 */
export function reflectTargets(data: Source, query: string, limit = 40): ReflectTarget[] {
  const q = query.trim().toLowerCase()
  const courseOf = (id?: string) => data.courses.find(c => c.id === id)
  const own = data.tasks.map(t => ({ t, course: courseOf(t.courseId) }))
  const match = (title: string, course?: string) => !q || `${title} ${course ?? ""}`.toLowerCase().includes(q)
  const row = (t: Source["tasks"][number], course: Source["courses"][number] | undefined, kind: "task" | "event"): ReflectTarget => {
    const when = kind === "event" ? t.scheduledDate ?? t.due : t.due
    return { key: `${kind}-${t.id}`, kind, title: t.title, sub: [course?.title, when ? `${kind === "event" ? "" : "Due "}${when}` : "", t.done ? "Done" : ""].filter(Boolean).join(" · "), courseId: t.courseId, taskId: t.id }
  }
  const byDate = (a?: string, b?: string) => (a ?? "9999").localeCompare(b ?? "9999")
  const tasks = own.filter(x => x.t.kind !== "event" && !x.t.done && match(x.t.title, x.course?.title)).sort((a, b) => byDate(a.t.due, b.t.due) || a.t.title.localeCompare(b.t.title)).map(x => row(x.t, x.course, "task"))
  const events = own.filter(x => x.t.kind === "event" && !x.t.done && match(x.t.title, x.course?.title)).sort((a, b) => byDate(a.t.scheduledDate ?? a.t.due, b.t.scheduledDate ?? b.t.due)).map(x => row(x.t, x.course, "event"))
  const courses = data.courses.filter(c => match(c.title)).map((c): ReflectTarget => ({ key: `course-${c.id}`, kind: "course", title: c.title, sub: c.kind ?? "course", courseId: c.id }))
  const finished = own.filter(x => x.t.done && match(x.t.title, x.course?.title)).sort((a, b) => (b.t.completedAt ?? "").localeCompare(a.t.completedAt ?? "")).map(x => row(x.t, x.course, x.t.kind === "event" ? "event" : "task"))
  return [...tasks, ...events, ...courses, ...finished].slice(0, limit)
}
