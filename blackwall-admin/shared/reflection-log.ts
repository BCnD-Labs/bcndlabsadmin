import { REFLECTION_ITEMS, validDateKey, validPlannerFields } from "./planner.ts"
import { saveJournalItem, updateTask, type NewTask, type RecordOptions } from "./records.ts"
import type { Collections } from "./workspace.ts"

/** Explicit copy, one entry per task/day; retries preserve the original copy and completion state. */
export function reflectionToLog(data: Collections, taskId: string, day: string, patch: Partial<NewTask> = {}, opts: RecordOptions = {}): Collections {
  const task = data.tasks.find(row => row.id === taskId)
  if (!task || task.kind === "event" || !validDateKey(day)) throw Error("Choose an existing task and a valid log day.")
  const next = { ...task, ...patch }
  if (!validPlannerFields(next)) throw Error("Check the task's reflection and properties before saving.")
  const reflection = next.reflection
  if (!reflection || (!reflection.text.trim() && !Object.values(reflection.items).some(value => value?.trim()))) throw Error("Write a reflection before adding it to the daily log.")
  const id = `reflection_${taskId}`
  const journal = data.journal.find(row => row.id === day)
  const existing = journal?.entries?.some(row => row.id === id)
  const links = next.recordLinks ?? []
  const linked = links.some(link => link.kind === "log" && link.id === day)
  if (!linked && links.length >= 50) throw Error("Remove a linked record before linking this log.")
  const now = (opts.now ?? (() => new Date().toISOString()))()
  const labels = REFLECTION_ITEMS as Record<string, { label: string }>
  const text = [next.title, reflection.text.trim(), ...Object.entries(reflection.items).filter(([, value]) => value?.trim()).map(([key, value]) => `${labels[key]?.label ?? key}: ${value}`)].filter(Boolean).join("\n")
  const copied = existing ? data : saveJournalItem(data, day, { id, text, createdAt: now, updatedAt: now }, false, { ...opts, now: () => now })
  if (!existing && copied === data) throw Error("The daily log is full or couldn't accept this entry.")
  // A day link is persisted; the reverse task link is derived in the daily-log UI.
  return updateTask(copied, taskId, { ...patch, recordLinks: linked ? links : [...links, { kind: "log", id: day }] }, { ...opts, now: () => now })
}
