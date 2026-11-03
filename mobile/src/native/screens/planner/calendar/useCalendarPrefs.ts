import { useCallback, useEffect, useState } from "react"
import { DEFAULT_CALENDAR_PREFS, type CalendarPrefs } from "./prefs.ts"
import { loadCalendarPrefs, saveCalendarPrefs } from "./prefs-store.ts"

/** The calendar's week start and clock, loaded from this phone (defaults until then) and saved on every change. */
export function useCalendarPrefs(): [CalendarPrefs, (change: Partial<CalendarPrefs>) => void] {
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS)
  useEffect(() => {
    let live = true
    void loadCalendarPrefs().then((p) => live && setPrefs(p))
    return () => {
      live = false
    }
  }, [])
  const update = useCallback((change: Partial<CalendarPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change }
      void saveCalendarPrefs(next)
      return next
    })
  }, [])
  return [prefs, update]
}
