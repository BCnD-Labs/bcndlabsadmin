import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns"
import { useMemo } from "react"
import { toDateKey, todayKey } from "@/lib/dates"
import { useWorkspace } from "@/stores/workspace"

export interface DayCount {
  date: string
  count: number
}

const lastDays = (n: number) => Array.from({ length: n }, (_, i) => toDateKey(addDays(new Date(), i - n + 1)))

/** Consecutive days up to today (or up to yesterday, if today has nothing yet). */
function streak(days: Set<string>): number {
  let d = days.has(todayKey()) ? new Date() : addDays(new Date(), -1)
  let n = 0
  while (days.has(toDateKey(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** Everything here is computed from your own tasks and logs. */
export function usePersonalStats(days = 30) {
  const tasks = useWorkspace((s) => s.tasks)
  const journal = useWorkspace((s) => s.journal)

  return useMemo(() => {
    const doneByDay = new Map<string, number>()
    for (const t of tasks) {
      if (!t.done || !t.completedAt) continue
      const k = toDateKey(new Date(t.completedAt))
      doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1)
    }
    const completed: DayCount[] = lastDays(days).map((date) => ({ date, count: doneByDay.get(date) ?? 0 }))

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const thisWeek = [...doneByDay].filter(([d]) => differenceInCalendarDays(new Date(`${d}T00:00`), weekStart) >= 0).reduce((a, [, n]) => a + n, 0)
    const lastWeek = [...doneByDay]
      .filter(([d]) => {
        const diff = differenceInCalendarDays(new Date(`${d}T00:00`), weekStart)
        return diff < 0 && diff >= -7
      })
      .reduce((a, [, n]) => a + n, 0)

    const logWords = new Map(journal.map((j) => [j.id, words(j.text)]))
    const open = tasks.filter((t) => !t.done)

    return {
      completed,
      thisWeek,
      lastWeek,
      doneStreak: streak(new Set(doneByDay.keys())),
      logStreak: streak(new Set(journal.map((j) => j.id))),
      logWords,
      logsLast30: lastDays(30).filter((d) => logWords.has(d)).length,
      open: open.length,
      overdue: open.filter((t) => t.due && t.due < todayKey()).length,
      noDate: open.filter((t) => !t.due).length,
    }
  }, [tasks, journal, days])
}
