/**
 * The long-press menu on a task row (pure). Each action is a change made with the shared record
 * rules (toggleTask, toggleStar, updateTask, removeTask), so it saves exactly like the editor does.
 * "edit" is not a change: the screen opens the editor for it.
 */
import { addDaysToKey, removeTask, toggleStar, toggleTask, updateTask, type Collections } from "../../../lib/shared.ts"

type Task = Collections["tasks"][number]
export type QuickKey = "complete" | "star" | "today" | "tomorrow" | "focus" | "edit" | "delete"
export interface QuickAction { key: QuickKey; label: string; destructive?: boolean }

export function quickActions(t: Task, today: string): QuickAction[] {
  const tomorrow = addDaysToKey(today, 1)
  const open = !t.done
  const list: (QuickAction | false)[] = [
    { key: "complete", label: t.done ? "Reopen" : "Complete" },
    { key: "star", label: t.starred ? "Remove star" : "Star" },
    open && t.due !== today && { key: "today", label: "Due today" },
    open && t.due !== tomorrow && { key: "tomorrow", label: "Due tomorrow" },
    open && { key: "focus", label: t.focusDate === today ? "Remove from today's focus" : "Focus today" },
    { key: "edit", label: "Edit details" },
    { key: "delete", label: "Delete", destructive: true },
  ]
  return list.filter((a): a is QuickAction => !!a)
}

/** The workspace after a quick action; unchanged for "edit" or an unknown task. */
export function applyQuickAction(data: Collections, id: string, key: QuickKey, today: string): Collections {
  const t = data.tasks.find((x) => x.id === id)
  if (!t) return data
  switch (key) {
    case "complete":
      return toggleTask(data, id)
    case "star":
      return toggleStar(data, id)
    case "today":
      return updateTask(data, id, { due: today })
    case "tomorrow":
      return updateTask(data, id, { due: addDaysToKey(today, 1) })
    case "focus":
      return updateTask(data, id, { focusDate: t.focusDate === today ? undefined : today })
    case "delete":
      return removeTask(data, id)
    case "edit":
      return data
  }
}
