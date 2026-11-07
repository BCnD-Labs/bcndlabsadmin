import { KeyboardFrame, KeyboardScrollView, useKeyboardTop } from "../../editing/keyboard.tsx"
import { shape } from "../../../shape.ts"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { toggleTask, type Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { NAV_CLEARANCE, Icon } from "../../ui.tsx"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { useReduceMotion } from "../../nav/useReduceMotion.ts"
import { CalendarHeader } from "./calendar/CalendarHeader.tsx"
import { DayAgenda } from "./calendar/DayAgenda.tsx"
import { WorkspaceSection } from "../../WorkspacePage.tsx"
import { longDay, titleFor } from "./calendar/format.ts"
import { columnsFor, monthGrid, stepBy, type CalendarView as View_ } from "./calendar/grid.ts"
import { monthMinHeight, rubberBand } from "./calendar/month-density.ts"
import { MonthGrid } from "./calendar/MonthGrid.tsx"
import { PlannerSettings } from "./calendar/PlannerSettings.tsx"
import { agendaItems, dayMeta, tasksByDay } from "./calendar/schedule.ts"
import { TimeGrid } from "./calendar/TimeGrid.tsx"
import { useCalendarPrefs } from "./calendar/useCalendarPrefs.ts"
import { usePeriodSwipe } from "./calendar/usePeriodSwipe.ts"
import { useWorkspacePrefs } from "./calendar/useWorkspacePrefs.ts"
import { calendarHeight } from "./calendar/workspace-prefs.ts"
import { DailyLogEditor } from "./log/DailyLogEditor.tsx"
import { selectedItem } from "../../selected-item.ts"
import { TaskPeek, previewText } from "./TaskPeek.tsx"
import type { LogDrafts } from "./log/useLogDrafts.ts"
import { NoteSheet, type NoteEditor } from "./notes/NoteSheet.tsx"
import { linkedNotesForDay } from "./notes/calendar-notes.ts"
import { noteTitle, orderNotes } from "./notes/note-rules.ts"

/**
 * Fixed calendar above a separately scrolling reflection workspace; its handle alone resizes it, anywhere between a
 * smallest and a largest height (nothing snaps; past either end it stretches a little and springs back). Swiping the
 * grid changes the period: up or down in the month view, left or right in the others.
 */
export function CalendarView({ data, today, onEdit, onCreateDue, logs, blocked, selected, onSelect: setSelected }: {
  data: Collections; today: string; selected: string; onSelect: (day: string) => void; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void
  logs: LogDrafts; blocked?: string
}) {
  const { mutate } = useWorkspace()
  const [prefs, setPrefs] = useCalendarPrefs(), [layout, setLayout] = useWorkspacePrefs()
  const [view, setView] = useState<View_>("month")
  const [settings, setSettings] = useState<{ top: number; right: number } | null>(null), [available, setAvailable] = useState(600), [chrome, setChrome] = useState(88)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [notePreviewId, setNotePreviewId] = useState<string | null>(null)
  const reduceMotion = useReduceMotion()
  const { weekStartsOn: weekStart, timeFormat } = prefs
  const displayDate = selected
  const columns = useMemo(() => columnsFor(view, displayDate, weekStart), [view, displayDate, weekStart])
  const weeks = useMemo(() => view === "month" ? monthGrid(selected, weekStart) : [], [view, selected, weekStart])
  // The month view has a larger smallest size, so its week rows never get cramped.
  const floor = view === "month" ? monthMinHeight(chrome, weeks.length) : undefined
  const bounds = useMemo(() => ({ min: calendarHeight(available, 0, floor), max: calendarHeight(available, 1, floor) }), [available, floor])
  const keyboardTop = useKeyboardTop()
  const normalHeight = calendarHeight(available, layout.fraction, floor)
  const target = keyboardTop == null ? normalHeight : Math.min(normalHeight, Math.max(0, available - 200))
  const height = useRef(new Animated.Value(target)).current
  const dragging = useRef(false)
  const live = useRef({ available, bounds, setLayout, reduceMotion })
  live.current = { available, bounds, setLayout, reduceMotion }
  const glide = (to: number, ms: number) => live.current.reduceMotion ? height.setValue(to) : Animated.timing(height, { toValue: to, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  // Follows the saved size, and eases when it changes by itself (a different view's smallest size, rotation).
  useEffect(() => { if (!dragging.current) glide(target, 180) }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  const start = useRef(0)
  const resize = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragging.current = true; height.stopAnimation(v => { start.current = v }) },
    onPanResponderMove: (_, g) => height.setValue(rubberBand(start.current + g.dy, live.current.bounds.min, live.current.bounds.max)),
    onPanResponderRelease: (_, g) => {
      const { available: room, bounds: b } = live.current
      const px = Math.max(b.min, Math.min(b.max, start.current + g.dy))
      dragging.current = false
      live.current.setLayout({ fraction: px / room })
      glide(px, 150)
    },
    onPanResponderTerminate: () => { dragging.current = false; glide(Math.max(live.current.bounds.min, Math.min(live.current.bounds.max, start.current)), 150) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [height])
  useEffect(() => onCreateDue(selected), [selected, onCreateDue])
  const byDay = useMemo(() => tasksByDay(data.tasks, view === "month" ? weeks.flat() : columns), [data.tasks, view, weeks, columns])
  const agenda = useMemo(() => agendaItems(data.tasks, selected, today, data.courses).filter(t => layout.showCompleted || !t.done), [data.tasks, data.courses, selected, today, layout.showCompleted])
  const meta = useMemo(() => dayMeta(data.tasks, data.journal, selected), [data.tasks, data.journal, selected])
  const toggle = useCallback((id: string) => { if (!blocked) void mutate(["tasks"], d => toggleTask(d, id)) }, [mutate, blocked])
  const step = useCallback((d: -1 | 1) => { setSelected(stepBy(view, displayDate, d)) }, [view, displayDate])
  const swipe = usePeriodSwipe(view === "month", step, reduceMotion)
  const previewTask = data.tasks.find(t => t.id === previewId)
  const previewCourse = previewTask?.courseId ? data.courses.find(c => c.id === previewTask.courseId) : undefined
  const linkedNotes = linkedNotesForDay(data, selected)
  const notes = orderNotes(linkedNotes, { search: "" })
  return <View style={styles.fill} onLayout={e => setAvailable(e.nativeEvent.layout.height)}>
    <Animated.View style={[styles.calendar, { height }]}>
      <View onLayout={e => setChrome(e.nativeEvent.layout.height)}><CalendarHeader compact={available < 300} title={titleFor(view, displayDate, columns)} view={view} onView={setView} onStep={step} onToday={() => setSelected(today)} onSettings={anchor => setSettings(anchor ?? { top: 140, right: 12 })} /></View>
      <Animated.View {...swipe.panHandlers} style={[styles.fill, swipe.style]}>
      {view === "month" ? <MonthGrid weeks={weeks} month={selected} selected={selected} today={today} byDay={byDay} weekStart={weekStart} onSelect={setSelected} /> : <TimeGrid days={columns} byDay={byDay} today={today} selected={selected} format={timeFormat} compact={view === "week"} onSelectDay={setSelected} onPreview={(id, day) => { setSelected(day); setPreviewId(id) }} />}
      </Animated.View>
    </Animated.View>
    <View {...resize.panHandlers} style={styles.handle} accessible accessibilityRole="adjustable" accessibilityLabel="Calendar height" accessibilityHint="Drag up or down to resize the calendar" accessibilityValue={{ min: 25, max: 80, now: Math.round(target / available * 100) }} accessibilityActions={[{ name: "increment", label: "Taller calendar" }, { name: "decrement", label: "Shorter calendar" }]} onAccessibilityAction={e => setLayout({ fraction: layout.fraction + (e.nativeEvent.actionName === "increment" ? 0.05 : -0.05) })}><View style={styles.grip} /></View>
    <KeyboardScrollView style={styles.fill} contentContainerStyle={styles.below} keyboardShouldPersistTaps="handled">
      {layout.order.filter(s => !layout.hidden.includes(s) && (s !== "notes" || linkedNotes.length > 0)).map(section => section === "agenda"
        ? <WorkspaceSection key={section} title={longDay(selected)} icon="calendar-outline" tint={c.accent} count={agenda.length ? `${agenda.length} ${agenda.length === 1 ? "item" : "items"}` : "none"} flush>
          <DayAgenda day={selected} items={agenda} tasks={data.tasks} meta={meta} format={timeFormat} onEdit={onEdit} onToggle={toggle} showTimes={layout.showTimes} showCourses={layout.showCourses} />
        </WorkspaceSection>
        : section === "log"
        ? <WorkspaceSection key={section} title="Log" icon="book-outline" tint={c.accent}><DailyLogEditor data={data} day={selected} logs={logs} blocked={blocked} heading="Log" embedded /></WorkspaceSection>
        : <WorkspaceSection key={section} title="Notes" icon="document-text-outline" tint={c.blue} count={String(linkedNotes.length)} flush>
          {[...notes.pinned, ...notes.others].map(n => <View key={n.id} style={[selectedItem.item, notePreviewId === n.id && selectedItem.itemOn]}><Pressable style={styles.note} onPress={() => setNotePreviewId(value => value === n.id ? null : n.id)} accessibilityRole="button" accessibilityLabel={`Preview ${noteTitle(n.text)}`} accessibilityState={{ expanded: notePreviewId === n.id }}><Text style={styles.noteTitle} numberOfLines={1}>{noteTitle(n.text)}</Text><Icon name={notePreviewId === n.id ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} /></Pressable>{notePreviewId === n.id ? <View style={selectedItem.preview}><Text style={styles.noteText} numberOfLines={2} ellipsizeMode="tail">{previewText(n.text, 120)}</Text><Pressable onPress={() => setNoteEditor({ mode: "edit", id: n.id })} accessibilityRole="button" accessibilityLabel={`Open ${noteTitle(n.text)}`} style={selectedItem.action}><Text style={selectedItem.actionText}>Open</Text></Pressable></View> : null}</View>)}
        </WorkspaceSection>)}
      {layout.hidden.length === 3 ? <Pressable onPress={() => setSettings({ top: 140, right: 12 })} style={styles.add} accessibilityRole="button"><Text style={styles.muted}>Choose sections in Planner settings</Text></Pressable> : null}
    </KeyboardScrollView>
    <Modal visible={!!previewTask} transparent animationType="fade" onRequestClose={() => setPreviewId(null)}><View style={styles.peekBackdrop}><View style={styles.peekDialog}><View style={styles.peekHead}><Text style={styles.peekTitle} numberOfLines={2}>{previewTask?.title}</Text><Pressable onPress={() => setPreviewId(null)} accessibilityRole="button" accessibilityLabel="Close preview"><Icon name="close" tint={c.muted} /></Pressable></View>{previewTask ? <TaskPeek task={previewTask} course={previewCourse?.title} onOpen={() => { const id = previewTask.id; setPreviewId(null); onEdit(id) }} /> : null}</View></View></Modal>
    {settings ? <PlannerSettings anchor={settings} onClose={() => setSettings(null)} prefs={layout} onChange={setLayout} calendar={prefs} onCalendar={setPrefs} /> : null}
    {noteEditor ? <NoteSheet editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} /> : null}
  </View>
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 }, calendar: { borderWidth: 1, borderColor: c.line, borderRadius: shape.card, overflow: "hidden", marginHorizontal: 10 },
  handle: { height: 24, alignItems: "center", justifyContent: "center" }, grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border },
  below: { paddingHorizontal: 16, paddingBottom: NAV_CLEARANCE, gap: 12 }, section: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingBottom: 12, gap: 8 },
  agendaSection: { paddingBottom: 0, gap: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 }, heading: { flex: 1, color: c.text, fontSize: 15, fontWeight: "600" },
  add: { minHeight: 36, minWidth: 36, justifyContent: "center", alignItems: "center" }, note: { flexDirection: "row", alignItems: "center", minHeight: 40, gap: 8, paddingHorizontal: 10 },
  noteTitle: { flex: 1, color: c.text2, fontSize: 14 }, muted: { color: c.muted, fontSize: 12 },
  noteText: { color: c.text2, fontSize: 12, lineHeight: 17 },   peekBackdrop: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.55)" }, peekDialog: { padding: 14, borderRadius: 10, backgroundColor: c.raised, gap: 10 }, peekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, peekTitle: { flex: 1, color: c.text, fontWeight: "700", fontSize: 16 },
})

