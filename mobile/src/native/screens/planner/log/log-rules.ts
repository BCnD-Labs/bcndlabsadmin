/**
 * Pure rules for the Planner's daily log (no React, no clock: `today` and the time zone offset are
 * passed in). Mirrors the web's log (features/journal/log-helpers.ts and DailyLog in planner-page.tsx):
 * one entry per day keyed by its date, quick prompts that append a `## label` section, and the tasks
 * completed on the day. Drafts are what the person has typed but the workspace does not hold yet.
 */
import { compareTasks, type Collections } from "../../../../lib/shared.ts"
import { WEEKDAY_SHORT, addDays, formatDay, weekDays } from "../dates.ts"

type Task = Collections["tasks"][number]
type Journal = Collections["journal"]

/** The web's quick prompts; each inserts a `## label` section. */
export const LOG_PROMPTS = ["shipped", "learned", "blocked on", "tomorrow"] as const

/** Append a `## label\n- ` section on its own line (same text as the web). */
export function appendPrompt(text: string, label: string): string {
  return (text.trim() ? text.replace(/\s*$/, "") + "\n" : "") + `## ${label}\n- `
}

/** "Wed, Nov 4" plus " · today" on today. */
export function dayTitle(day: string, today: string): string {
  return `${formatDay(day)}${day === today ? " · today" : ""}`
}

/** The day before (-1) or after (+1) a day. */
export const shiftDay = (day: string, n: number): string => addDays(day, n)

/** The saved text for a day, "" when there is no entry. */
export function entryText(journal: Journal, day: string): string {
  return journal.find((e) => e.id === day)?.text ?? ""
}

/**
 * The calendar day (YYYY-MM-DD) of an ISO timestamp in the phone's time zone, like the web's
 * `toDateKey(new Date(completedAt))`. `offsetMinutes` is `Date#getTimezoneOffset()` (UTC minus local);
 * tests pass it explicitly, the app lets it default to the phone's.
 */
export function timestampKey(iso: string, offsetMinutes?: number): string | undefined {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return undefined
  const offset = offsetMinutes ?? new Date(ms).getTimezoneOffset()
  return new Date(ms - offset * 60_000).toISOString().slice(0, 10)
}

/** Tasks ticked off on a day, earliest first. Only done tasks with a completion time count. */
export function completedOn(tasks: readonly Task[], day: string, offsetMinutes?: number): Task[] {
  return tasks.filter((t) => t.done && !!t.completedAt && timestampKey(t.completedAt, offsetMinutes) === day).sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))
}

/** Tasks due on a day (what the web's log dialog lists), in the Planner's usual order. */
export function dueOn(tasks: readonly Task[], day: string): Task[] {
  return tasks.filter((t) => t.due === day).sort(compareTasks)
}

export type Drafts = Record<string, string>

/** Drop the drafts the workspace has caught up with, so the entry shows the saved text again. Same object when nothing changed. */
export function reconcileDrafts(drafts: Drafts, journal: Journal): Drafts {
  const next: Drafts = { ...drafts }
  for (const [day, text] of Object.entries(drafts)) {
    const saved = entryText(journal, day)
    // Text that is blank after trimming is saved as "no entry", so it counts as caught up.
    if (text === saved || (!text.trim() && !saved)) delete next[day]
  }
  return Object.keys(next).length === Object.keys(drafts).length ? drafts : next
}

/** What the editor shows for a day: the draft while there is one, else the saved text. */
export const shownText = (drafts: Drafts, journal: Journal, day: string): string => drafts[day] ?? entryText(journal, day)

export type SaveState = "idle" | "saved" | "unsaved" | "saving" | "failed"
export const SAVE_LABEL: Record<SaveState, string> = {
  idle: "No entry yet",
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  failed: "Not saved. Your text is kept here.",
}

export function saveState(day: string, journal: Journal, drafts: Drafts, saving: Record<string, true>, failed: Record<string, true>): SaveState {
  if (failed[day]) return "failed"
  if (saving[day]) return "saving"
  if (day in drafts) return "unsaved"
  return journal.some((e) => e.id === day && e.text.trim()) ? "saved" : "idle"
}

export interface StripDay { key: string; weekday: string; num: number; has: boolean; today: boolean; selected: boolean }

/** The Monday to Sunday week around `day`, marking the days that have an entry (or typed text). */
export function weekStrip(day: string, today: string, journal: Journal, drafts: Drafts): StripDay[] {
  return weekDays(day).map((key, i) => ({
    key,
    weekday: WEEKDAY_SHORT[i],
    num: Number(key.slice(8)),
    has: !!shownText(drafts, journal, key).trim(),
    today: key === today,
    selected: key === day,
  }))
}

export interface RecentEntry { day: string; preview: string }

/** The first line that has words, without markdown markers. */
export function previewLine(text: string): string {
  const line = text.split("\n").map((l) => l.replace(/^\s*(#+\s*|[-*]\s+)/, "").trim()).find(Boolean)
  return (line ?? "").slice(0, 90)
}

/** The latest days that have an entry, newest first (typed-but-unsaved text counts). */
export function recentEntries(journal: Journal, drafts: Drafts, limit = 8): RecentEntry[] {
  const days = new Set([...journal.map((e) => e.id), ...Object.keys(drafts)])
  return [...days]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({ day, preview: previewLine(shownText(drafts, journal, day)) }))
    .filter((e) => e.preview)
    .slice(0, limit)
}
