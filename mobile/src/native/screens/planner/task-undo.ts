/**
 * Undo for the two changes that swipe, long-press and the checkbox make without asking: deleting a
 * task and completing/reopening one (pure). Undo is itself an ordinary save through the shared
 * rules, and it is honest: if the task changed on another device in the meantime it says so
 * instead of overwriting that change.
 *  - delete: the task comes back with its own id, createdAt and every field (createTask with the
 *    old id and createdAt), so links from other tasks still point at it.
 *  - toggle: done and completedAt are put back exactly as they were (updateTask).
 */
import { createTask, updateTask, type Collections, type NewTask } from "../../../lib/shared.ts"

type Task = Collections["tasks"][number]

export type UndoAction =
  | { kind: "delete"; task: Task }
  | { kind: "toggle"; id: string; title: string; before: { done: boolean; completedAt?: string }; after: boolean }

export type UndoPlan = { ok: true; change: (d: Collections) => Collections; done: string } | { ok: false; reason: string }

export const undoDelete = (task: Task): UndoAction => ({ kind: "delete", task })
/** `task` is the record as it was before the toggle. */
export const undoToggle = (task: Task): UndoAction => ({ kind: "toggle", id: task.id, title: task.title, before: { done: task.done, completedAt: task.completedAt }, after: !task.done })

const clip = (title: string) => (title.length > 40 ? `${title.slice(0, 37)}…` : title)

/** What the snackbar says right after the change. */
export function snackText(a: UndoAction): string {
  if (a.kind === "delete") return `Deleted "${clip(a.task.title)}"`
  return `${a.after ? "Completed" : "Reopened"} "${clip(a.title)}"`
}

/** How to take the change back against the workspace as it is now, or why that is no longer safe. */
export function planUndo(a: UndoAction, data: Collections, now: string): UndoPlan {
  if (a.kind === "delete") {
    const { task } = a
    if (data.tasks.some((t) => t.id === task.id)) return { ok: false, reason: "That task is already back." }
    const { id, createdAt, updatedAt: _old, ...rest } = task
    return {
      ok: true,
      done: "Task restored",
      change: (d) => {
        const made = createTask(d, rest as NewTask, { makeId: () => id, now: () => createdAt }).data
        return updateTask(made, id, {}, { now: () => now })
      },
    }
  }
  const current = data.tasks.find((t) => t.id === a.id)
  if (!current) return { ok: false, reason: "That task no longer exists." }
  if (current.done !== a.after) return { ok: false, reason: "That task was changed on another device, so it was left alone." }
  return { ok: true, done: a.after ? "Reopened" : "Marked done again", change: (d) => updateTask(d, a.id, { done: a.before.done, completedAt: a.before.completedAt }, { now: () => now }) }
}
