import { format, isToday } from "date-fns"
import { parseKey } from "@/lib/dates"
import type { DateKey } from "@/lib/types"

/** Quick prompts in the log dialog; each inserts a `## label` section. */
export const LOG_PROMPTS = ["shipped", "learned", "blocked on", "tomorrow"] as const

/** Append a `## label\n- ` section on its own line. */
export function appendPrompt(text: string, label: string): string {
  return (text.trim() ? text.replace(/\s*$/, "") + "\n" : "") + `## ${label}\n- `
}

/** The prompt command for a day's log: `write --today` or `open --date MM-DD`. */
export function logCommand(date: DateKey): string {
  return isToday(parseKey(date)) ? "write --today" : `open --date ${format(parseKey(date), "MM-dd")}`
}

/** "Fri · Oct 30 · today" */
export function logTitle(date: DateKey): string {
  const d = parseKey(date)
  return `${format(d, "EEE · MMM d")}${isToday(d) ? " · today" : ""}`
}
