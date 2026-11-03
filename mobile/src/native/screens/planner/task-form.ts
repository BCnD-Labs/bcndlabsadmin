/**
 * Pure rules for the Planner's task editor and quick add (no React, no clock: `now` and `today`
 * are passed in). Fields are exactly the ones the web's plain-task form has (title, details, due,
 * time, starred, done). Editing builds a patch of only those fields, so everything else on a
 * task (course, links, schedule, reflection, anything a newer version added) is left alone.
 */
import { parseQuickAdd, validDateKey, type Collections, type NewTask } from "../../../lib/shared.ts"
import type { SyncStatus } from "../../data/sync-view.ts"

type Task = Collections["tasks"][number]

export interface TaskDraft { title: string; details: string; due: string; time: string; starred: boolean; done: boolean }
export interface DraftErrors { title?: string; due?: string; time?: string }

export const emptyDraft = (due = ""): TaskDraft => ({ title: "", details: "", due, time: "", starred: false, done: false })

export function draftFromTask(t: Task): TaskDraft {
  return { title: t.title, details: t.details ?? "", due: t.due ?? "", time: t.time ?? "", starred: t.starred, done: t.done }
}

/** "9:30" or "09:30" -> "09:30"; undefined when empty or not a 24-hour time. */
export function normalizeTime(text: string): string | undefined {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

/** Why a draft can't be saved yet. The time only counts when there is a due date (as on the web). */
export function draftErrors(d: TaskDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!d.title.trim()) errors.title = "Give the task a title."
  if (d.due && !validDateKey(d.due)) errors.due = "Pick a valid date."
  if (d.due && d.time.trim() && !normalizeTime(d.time)) errors.time = "Use 24-hour time, like 09:30."
  return errors
}

/** Empty details, time and date become undefined; the time is dropped without a due date. */
function fields(d: TaskDraft) {
  return { title: d.title.trim(), details: d.details.trim() || undefined, due: d.due || undefined, time: d.due ? normalizeTime(d.time) : undefined, starred: d.starred, done: d.done }
}

/** A new task: undefined fields are left out entirely. */
export function buildNewTask(d: TaskDraft, now: string): NewTask {
  const f = fields(d)
  return { title: f.title, starred: f.starred, done: f.done, ...(f.details && { details: f.details }), ...(f.due && { due: f.due }), ...(f.time && { time: f.time }), ...(f.done && { completedAt: now }) }
}

/** The patch for an edit: cleared fields are explicit undefined so they really clear. Completing keeps an earlier completedAt. */
export function buildPatch(d: TaskDraft, existing: Task, now: string): Partial<NewTask> {
  return { ...fields(d), completedAt: d.done ? (existing.completedAt ?? now) : undefined }
}

export interface QuickAddPreview { title: string; due?: string }

/** What quick add will create for this text; null for empty text. `defaultDue` is used when no date word was typed. */
export function previewQuickAdd(input: string, today: string, defaultDue?: string): QuickAddPreview | null {
  const parsed = parseQuickAdd(input, today)
  return parsed.title ? { title: parsed.title, due: parsed.due ?? defaultDue } : null
}

export function buildQuickAdd(input: string, today: string, defaultDue?: string): NewTask | null {
  const p = previewQuickAdd(input, today, defaultDue)
  return p ? { title: p.title, starred: false, done: false, ...(p.due && { due: p.due }) } : null
}

/** Whether adding and editing are possible right now. Offline and signed-out edits are queued on the phone, so only these two block. */
export function editAccess(status: SyncStatus, hasData: boolean): { ok: boolean; reason?: string } {
  if (!hasData) return { ok: false, reason: status === "signed-out" ? "Sign in to add tasks." : "Your tasks haven't loaded yet." }
  if (status === "conflict") return { ok: false, reason: "Choose which edits to keep first (tap the sync chip)." }
  return { ok: true }
}

/** Waits for `p`, but gives `fallback` after `ms`. Saving waits for the server, which can take 15 seconds offline. */
export function resolveWithin<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error)),
    )
  })
}
