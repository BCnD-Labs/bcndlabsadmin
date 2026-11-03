/**
 * Pure helpers for the native data layer (no React, no Expo): the phone's local "today", how often
 * to poll, what the sync chip says, and how a conflict is described. Wording is honest: every label
 * says what the app actually knows.
 */
import type { Collections } from "../../lib/shared.ts"

export type SyncStatus = "loading" | "ok" | "offline" | "signed-out" | "error" | "conflict"

export const POLL_MS = 20_000
/** While signed out the person is probably about to sign in (Settings), so look again sooner. */
export const SIGNED_OUT_POLL_MS = 5_000

export function pollDelay(status: SyncStatus): number {
  return status === "signed-out" ? SIGNED_OUT_POLL_MS : POLL_MS
}

/** The phone's own calendar date as YYYY-MM-DD (local time zone, not UTC). */
export function todayKey(now: Date = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** What a tap on the chip does. */
export type ChipTarget = "settings" | "conflict" | "refresh" | null
export interface Chip { label: string; tint: "green" | "amber" | "red" | "grey"; target: ChipTarget }

const changes = (n: number) => `${n} change${n === 1 ? "" : "s"}`

/** The status chip in the Planner title row. `count` = records with unsent edits (only read when `pending`). */
export function syncChip(status: SyncStatus, pending: boolean, count: number): Chip {
  const waiting = Math.max(count, 1)
  switch (status) {
    case "loading":
      return { label: "Loading…", tint: "grey", target: null }
    case "ok":
      return pending ? { label: "Saving…", tint: "amber", target: null } : { label: "Synced", tint: "green", target: null }
    case "offline":
      return { label: pending ? `Offline, ${changes(waiting)} waiting` : "Offline", tint: "amber", target: "refresh" }
    case "signed-out":
      return { label: pending ? `Signed out, ${changes(waiting)} waiting` : "Signed out", tint: "red", target: "settings" }
    case "error":
      return { label: pending ? `Not saved, ${changes(waiting)} waiting` : "Sync problem", tint: "red", target: "refresh" }
    case "conflict":
      return { label: "Conflict", tint: "red", target: "conflict" }
  }
}

export interface ConflictRow { key: string; id: string; label: string }

const COLLECTION_NAME: Partial<Record<keyof Collections, string>> = { tasks: "Task", notes: "Note", journal: "Log entry", courses: "Course", projects: "Project" }

/**
 * Turns the client's `"tasks: tsk_1"` strings into rows with a readable label. Titles come from the
 * phone's copy first, then the server's; anything unknown is described by its kind, never invented.
 */
export function conflictRows(conflicts: readonly string[], mine: Collections, theirs: Collections): ConflictRow[] {
  return conflicts.map((entry) => {
    const at = entry.indexOf(": ")
    const key = at < 0 ? "" : entry.slice(0, at)
    const id = at < 0 ? entry : entry.slice(at + 2)
    const kind = COLLECTION_NAME[key as keyof Collections] ?? "Record"
    const rows = ((mine as unknown as Record<string, { id: string }[] | undefined>)[key] ?? []).concat((theirs as unknown as Record<string, { id: string }[] | undefined>)[key] ?? [])
    const row = rows.find((r) => r.id === id) as ({ id: string; title?: string; text?: string; name?: string } | undefined)
    const name = (row?.title ?? row?.name ?? row?.text?.split("\n")[0] ?? "").trim()
    return { key: entry, id, label: name ? `${kind}: ${name.length > 80 ? `${name.slice(0, 77)}…` : name}` : `${kind} (no title)` }
  })
}
