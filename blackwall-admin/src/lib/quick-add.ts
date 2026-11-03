import { parseQuickAdd as parse } from "@shared/task-rules"
import { todayKey } from "./dates"

/**
 * Pull a trailing date word off a quick-add title: "today", "tomorrow"/"tmrw", or a weekday
 * ("fri", "thurs", "friday" = the next one, or today if it matches). Anything else ("Replace monitor")
 * is left alone. The rules are shared with the native apps; this passes today's date.
 */
export const parseQuickAdd = (input: string): { title: string; due?: string } => parse(input, todayKey())
