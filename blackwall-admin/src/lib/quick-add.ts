import { addDays, getDay } from "date-fns"
import { toDateKey } from "./dates"

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

/**
 * Pull a trailing date word off a quick-add title: "today", "tomorrow"/"tmrw",
 * or a weekday ("fri", "thurs", "friday" = the next one, or today if it matches).
 * Anything else ("Replace monitor") is left alone.
 */
export function parseQuickAdd(input: string): { title: string; due?: string } {
  const text = input.trim()
  const m = text.match(/\s+([a-z]+)$/i)
  if (!m) return { title: text }
  const title = text.slice(0, m.index).trim()
  const word = m[1].toLowerCase().replace(/^weds$/, "wed")
  if (!title) return { title: text }
  if (word === "today") return { title, due: toDateKey(new Date()) }
  if (["tomorrow", "tmrw", "tmr"].includes(word)) return { title, due: toDateKey(addDays(new Date(), 1)) }
  const idx = word.length >= 3 ? WEEKDAYS.findIndex((d) => d.startsWith(word)) : -1
  if (idx < 0) return { title: text }
  return { title, due: toDateKey(addDays(new Date(), (idx - getDay(new Date()) + 7) % 7)) }
}
