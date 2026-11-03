import type { SampleCoursework } from "../../sample.ts"
import { addDays } from "./dates.ts"

export type AgendaGroup = "overdue" | "thisWeek" | "later" | "done"
export type Agenda = Record<AgendaGroup, SampleCoursework[]>

export const AGENDA_ORDER: AgendaGroup[] = ["overdue", "thisWeek", "later", "done"]
export const GROUP_LABEL: Record<AgendaGroup, string> = { overdue: "Overdue", thisWeek: "This week", later: "Later", done: "Done" }

/**
 * Sorts coursework into the agenda groups for `today` (YYYY-MM-DD):
 * Overdue = not done and due before today; This week = not done and due from today through
 * seven days later; Later = not done and due after that; Done = done, whatever the date.
 */
export function groupAgenda(items: SampleCoursework[], today: string, isDone: (w: SampleCoursework) => boolean): Agenda {
  const weekEnd = addDays(today, 7)
  const out: Agenda = { overdue: [], thisWeek: [], later: [], done: [] }
  for (const w of items) {
    if (isDone(w)) out.done.push(w)
    else if (w.due < today) out.overdue.push(w)
    else if (w.due <= weekEnd) out.thisWeek.push(w)
    else out.later.push(w)
  }
  for (const group of AGENDA_ORDER) out[group].sort((a, b) => (a.due === b.due ? a.title.localeCompare(b.title) : a.due < b.due ? -1 : 1))
  return out
}
