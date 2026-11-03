import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { toggleTask, type Collections } from "../../../lib/shared.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { CalendarHeader } from "./calendar/CalendarHeader.tsx"
import { DayAgenda } from "./calendar/DayAgenda.tsx"
import { titleFor } from "./calendar/format.ts"
import { columnsFor, monthGrid, stepBy, type CalendarView as View_ } from "./calendar/grid.ts"
import { MonthGrid } from "./calendar/MonthGrid.tsx"
import { agendaItems, dayMeta, tasksByDay } from "./calendar/schedule.ts"
import { TimeGrid } from "./calendar/TimeGrid.tsx"
import { useCalendarPrefs } from "./calendar/useCalendarPrefs.ts"

/**
 * The Planner calendar on the real workspace: Day, Week and Month views of its tasks. A task sits on
 * its scheduled day, or its due day, and shows again on its due day as a deadline (the web's rule,
 * see calendar/schedule.ts). Only tasks appear: the workspace has no class timetable or events, so
 * none are invented. Week and Month list the selected day's tasks under the grid.
 */
export function CalendarView({ data, today, onEdit, onCreateDue }: { data: Collections; today: string; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void }) {
  const { mutate } = useWorkspace()
  const [prefs, setPrefs] = useCalendarPrefs()
  const [view, setView] = useState<View_>("week")
  const [selected, setSelected] = useState(today)
  // A task added from the "+" starts on the day being looked at.
  useEffect(() => onCreateDue(selected), [selected, onCreateDue])

  const { weekStartsOn: weekStart, timeFormat } = prefs
  const columns = useMemo(() => columnsFor(view, selected, weekStart), [view, selected, weekStart])
  const weeks = useMemo(() => (view === "month" ? monthGrid(selected, weekStart) : []), [view, selected, weekStart])
  const shown = useMemo(() => (view === "month" ? weeks.flat() : columns), [view, weeks, columns])
  const byDay = useMemo(() => tasksByDay(data.tasks, shown), [data.tasks, shown])
  const agenda = useMemo(() => agendaItems(data.tasks, selected, today, data.courses), [data.tasks, data.courses, selected, today])
  const meta = useMemo(() => dayMeta(data.tasks, data.journal, selected), [data.tasks, data.journal, selected])
  const toggle = useCallback((id: string) => void mutate(["tasks"], (d) => toggleTask(d, id)), [mutate])

  return (
    <>
      <CalendarHeader
        title={titleFor(view, selected, columns)}
        view={view}
        prefs={prefs}
        onView={setView}
        onStep={(direction) => setSelected(stepBy(view, selected, direction))}
        onToday={() => setSelected(today)}
        onPrefs={setPrefs}
      />
      {view === "month" ? (
        <MonthGrid weeks={weeks} month={selected} selected={selected} today={today} byDay={byDay} weekStart={weekStart} onSelect={setSelected} />
      ) : (
        <TimeGrid days={columns} byDay={byDay} today={today} selected={selected} format={timeFormat} compact={view === "week"} onSelectDay={setSelected} onEdit={onEdit} />
      )}
      {view === "day" ? null : <DayAgenda day={selected} items={agenda} meta={meta} format={timeFormat} onEdit={onEdit} onToggle={toggle} />}
      <View style={styles.fabRoom} />
    </>
  )
}

const styles = StyleSheet.create({
  fabRoom: { height: 64 },
})
