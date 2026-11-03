import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { toggleTask, type Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { NAV_CLEARANCE, Icon } from "../../ui.tsx"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { CalendarHeader } from "./calendar/CalendarHeader.tsx"
import { DayAgenda } from "./calendar/DayAgenda.tsx"
import { titleFor } from "./calendar/format.ts"
import { columnsFor, monthGrid, stepBy, type CalendarView as View_ } from "./calendar/grid.ts"
import { MonthGrid } from "./calendar/MonthGrid.tsx"
import { PlannerSettings } from "./calendar/PlannerSettings.tsx"
import { agendaItems, dayMeta, tasksByDay } from "./calendar/schedule.ts"
import { TimeGrid } from "./calendar/TimeGrid.tsx"
import { useCalendarPrefs } from "./calendar/useCalendarPrefs.ts"
import { useWorkspacePrefs } from "./calendar/useWorkspacePrefs.ts"
import { calendarHeight } from "./calendar/workspace-prefs.ts"
import { DailyLogEditor } from "./log/DailyLogEditor.tsx"
import type { LogDrafts } from "./log/useLogDrafts.ts"
import { NoteSheet, type NoteEditor } from "./notes/NoteSheet.tsx"
import { linkedNotesForDay } from "./notes/calendar-notes.ts"
import { noteTitle, orderNotes } from "./notes/note-rules.ts"

/** Fixed calendar above a separately scrolling reflection workspace; its handle alone resizes it. */
export function CalendarView({ data, today, onEdit, onCreateDue, logs, blocked }: {
  data: Collections; today: string; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void
  logs: LogDrafts; blocked?: string
}) {
  const { mutate } = useWorkspace()
  const [prefs, setPrefs] = useCalendarPrefs(), [layout, setLayout] = useWorkspacePrefs()
  const [view, setView] = useState<View_>("three"), [selected, setSelected] = useState(today), [anchor, setAnchor] = useState(today)
  const [settings, setSettings] = useState<{ top: number; right: number } | null>(null), [available, setAvailable] = useState(600), [drag, setDrag] = useState<number | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const height = calendarHeight(available, drag ?? layout.fraction)
  const live = useRef({ available, height, setLayout })
  live.current = { available, height, setLayout }
  const start = useRef(0)
  const resize = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = live.current.height },
    onPanResponderMove: (_, g) => setDrag(calendarHeight(live.current.available, (start.current + g.dy) / live.current.available) / live.current.available),
    onPanResponderRelease: (_, g) => { live.current.setLayout({ fraction: calendarHeight(live.current.available, (start.current + g.dy) / live.current.available) / live.current.available }); setDrag(null) },
    onPanResponderTerminate: () => setDrag(null),
  }), [])
  useEffect(() => onCreateDue(selected), [selected, onCreateDue])
  const { weekStartsOn: weekStart, timeFormat } = prefs
  const displayDate = view === "three" ? anchor : selected
  const columns = useMemo(() => columnsFor(view, displayDate, weekStart), [view, displayDate, weekStart])
  const weeks = useMemo(() => view === "month" ? monthGrid(selected, weekStart) : [], [view, selected, weekStart])
  const byDay = useMemo(() => tasksByDay(data.tasks, view === "month" ? weeks.flat() : columns), [data.tasks, view, weeks, columns])
  const agenda = useMemo(() => agendaItems(data.tasks, selected, today, data.courses).filter(t => layout.showCompleted || !t.done), [data.tasks, data.courses, selected, today, layout.showCompleted])
  const meta = useMemo(() => dayMeta(data.tasks, data.journal, selected), [data.tasks, data.journal, selected])
  const toggle = useCallback((id: string) => { if (!blocked) void mutate(["tasks"], d => toggleTask(d, id)) }, [mutate, blocked])
  const linkedNotes = linkedNotesForDay(data, selected)
  const notes = orderNotes(linkedNotes, { search: "" })
  return <View style={styles.fill} onLayout={e => setAvailable(e.nativeEvent.layout.height)}>
    <View style={[styles.calendar, { height }]}>
      <CalendarHeader compact={available < 300} title={titleFor(view, displayDate, columns)} view={view} onView={v => { setAnchor(selected); setView(v) }} onStep={d => { const day = stepBy(view, displayDate, d); setAnchor(day); setSelected(day) }} onToday={() => { setAnchor(today); setSelected(today) }} onSettings={anchor => setSettings(anchor ?? { top: 140, right: 12 })} />
      {view === "month" ? <MonthGrid weeks={weeks} month={selected} selected={selected} today={today} byDay={byDay} weekStart={weekStart} onSelect={setSelected} /> : <TimeGrid days={columns} byDay={byDay} today={today} selected={selected} format={timeFormat} compact={view === "week"} onSelectDay={setSelected} onEdit={onEdit} />}
    </View>
    <View {...resize.panHandlers} style={styles.handle} accessible accessibilityRole="adjustable" accessibilityLabel="Calendar height" accessibilityHint="Drag up or down to resize the calendar" accessibilityValue={{ min: 25, max: 80, now: Math.round(height / available * 100) }} accessibilityActions={[{ name: "increment", label: "Taller calendar" }, { name: "decrement", label: "Shorter calendar" }]} onAccessibilityAction={e => setLayout({ fraction: layout.fraction + (e.nativeEvent.actionName === "increment" ? 0.05 : -0.05) })}><View style={styles.grip} /></View>
    <ScrollView style={styles.fill} contentContainerStyle={styles.below} keyboardShouldPersistTaps="handled">
      {layout.order.filter(s => !layout.hidden.includes(s) && (s !== "notes" || linkedNotes.length > 0)).map(section => <View key={section} style={[styles.section, section === "agenda" && styles.agendaSection]}>
        {section === "agenda" ? <DayAgenda day={selected} items={agenda} meta={meta} format={timeFormat} onEdit={onEdit} onToggle={toggle} showTimes={layout.showTimes} showCourses={layout.showCourses} /> : section === "log" ? <>
          <DailyLogEditor data={data} day={selected} logs={logs} blocked={blocked} />
        </> : <>
          <View style={styles.sectionHead}><Icon name="document-text-outline" tint={c.text2} /><Text style={styles.heading}>Notes · {linkedNotes.length}</Text></View>
          {[...notes.pinned, ...notes.others].map(n => <Pressable key={n.id} style={styles.note} onPress={() => setNoteEditor({ mode: "edit", id: n.id })} accessibilityRole="button"><Text style={styles.noteTitle} numberOfLines={1}>{noteTitle(n.text)}</Text><Icon name="chevron-forward" size={16} tint={c.muted} /></Pressable>)}

        </>}
      </View>)}
      {layout.hidden.length === 3 ? <Pressable onPress={() => setSettings({ top: 140, right: 12 })} style={styles.add} accessibilityRole="button"><Text style={styles.muted}>Choose sections in Planner settings</Text></Pressable> : null}
    </ScrollView>
    {settings ? <PlannerSettings anchor={settings} onClose={() => setSettings(null)} prefs={layout} onChange={setLayout} calendar={prefs} onCalendar={setPrefs} /> : null}
    {noteEditor ? <NoteSheet editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} /> : null}
  </View>
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 }, calendar: { borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: "hidden", marginHorizontal: 10 },
  handle: { height: 24, alignItems: "center", justifyContent: "center" }, grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border },
  below: { paddingHorizontal: 16, paddingBottom: NAV_CLEARANCE, gap: 12 }, section: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingBottom: 12, gap: 8 },
  agendaSection: { paddingBottom: 0, gap: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 }, heading: { flex: 1, color: c.text, fontSize: 15, fontWeight: "600" },
  add: { minHeight: 36, minWidth: 36, justifyContent: "center", alignItems: "center" }, note: { flexDirection: "row", alignItems: "center", minHeight: 40, gap: 8 },
  noteTitle: { flex: 1, color: c.text2, fontSize: 14 }, muted: { color: c.muted, fontSize: 12 },
})
