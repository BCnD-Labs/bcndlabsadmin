/**
 * Pure numbers behind the native panels (no React, no clock). Every figure comes from saved records;
 * `today` is always passed in (the phone's local date, see data/sync-view.ts).
 */
import { addDaysToKey, weekdayOfKey } from "../../lib/shared.ts"

export interface Counted { done?: boolean; completedAt?: string; due?: string; kind?: string }

/** The phone's local calendar date for an ISO timestamp (not UTC); undefined when it is not a timestamp. */
export function localKey(timestamp: string | undefined): string | undefined {
  if (!timestamp) return undefined
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return undefined
  return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** `n` day keys ending on `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysToKey(today, i - (n - 1)) ?? today)
}

/** The Monday-to-Sunday keys of the week that contains `today`. */
export function weekDays(today: string): string[] {
  const monday = addDaysToKey(today, -((weekdayOfKey(today) + 6) % 7)) ?? today
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i) ?? monday)
}

function doneKeys(tasks: Counted[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.kind === "event" || !t.done) continue
    const key = localKey(t.completedAt)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** How many tasks were completed on each of `days` (events never count). */
export function doneCounts(tasks: Counted[], days: string[]): number[] {
  const counts = doneKeys(tasks)
  return days.map(day => counts.get(day) ?? 0)
}

/** Consecutive days with a completion, ending today (or yesterday while today has none yet). */
export function streak(tasks: Counted[], today: string): { length: number; last7: boolean[] } {
  const counts = doneKeys(tasks)
  let day = counts.has(today) ? today : addDaysToKey(today, -1) ?? today
  let length = 0
  while (counts.has(day)) { length++; day = addDaysToKey(day, -1) ?? ""; if (!day) break }
  return { length, last7: lastDays(today, 7).map(d => counts.has(d)) }
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4
export const heatLevel = (count: number): HeatLevel => count <= 0 ? 0 : count >= 4 ? 4 : count as HeatLevel
export interface HeatCell { key: string; count: number; level: HeatLevel; future: boolean; today: boolean }

/** `weeks` Monday-first weeks, the last one containing `today`; days after today are marked `future`. */
export function heatCells(tasks: Counted[], today: string, weeks = 5): HeatCell[] {
  const counts = doneKeys(tasks)
  const lastMonday = weekDays(today)[0]
  const first = addDaysToKey(lastMonday, -(weeks - 1) * 7) ?? lastMonday
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const key = addDaysToKey(first, i) ?? first
    const future = key > today
    const count = future ? 0 : counts.get(key) ?? 0
    return { key, count, level: heatLevel(count), future, today: key === today }
  })
}

/** Done / open / overdue split of ordinary tasks. Overdue tasks are not also counted as open. */
export function taskBalance(tasks: Counted[], today: string) {
  const own = tasks.filter(t => t.kind !== "event")
  const done = own.filter(t => t.done).length
  const overdue = own.filter(t => !t.done && !!t.due && t.due < today).length
  const open = own.length - done - overdue
  return { done, open, overdue, total: own.length, completePct: own.length ? Math.round(done / own.length * 100) : 0 }
}

/** Average per day over the days that have happened so far (never divides by zero). */
export const averagePerDay = (counts: number[], elapsed: number): number => elapsed > 0 ? Math.round(counts.slice(0, elapsed).reduce((n, x) => n + x, 0) / elapsed * 10) / 10 : 0

/** 0..1 clamped to a whole percent. */
export const percent = (value: number): number => Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100)

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
/** The month abbreviation and two-digit day of a date key, for a small date block. */
export function dateParts(key: string): { month: string; day: string } {
  const month = MONTHS[Number(key.slice(5, 7)) - 1]
  return { month: month ?? "", day: month ? key.slice(8, 10) : "" }
}
