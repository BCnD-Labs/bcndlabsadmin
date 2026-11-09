import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { applyFocusPlan, daysLabel, meetingKindLabel, planWeek, statusLabel, statusOf, WORK_STATUSES, type Collections, type MeetingOccurrence, type TodayPlan } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { shape } from "../../../shape.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Icon } from "../../ui.tsx"
import { PropChip } from "../../kit/PropChip.tsx"
import { kit } from "../../kit/tokens.ts"
import { WorkspaceSection } from "../../WorkspacePage.tsx"
import { formatTime } from "../planner/calendar/format.ts"
import { useCalendarPrefs } from "../planner/calendar/useCalendarPrefs.ts"
import { shortDay } from "../planner/dates.ts"
import { TaskCheck } from "../planner/TaskCheck.tsx"
import { Pill, SmallButton } from "./LearningControls.tsx"
import { kindInfo, type Course, type Task } from "./learning-view.ts"

/** One clear next step for someone who doesn't know where to begin. */
export function StartHere({ next, courses, onStart }: { next: NonNullable<TodayPlan["next"]>; courses: Course[]; onStart: (task: Task) => void }) {
  const course = courses.find(x => x.id === next.task.courseId)
  return <View style={s.start} accessible accessibilityLabel={`Start here: ${next.task.title}. ${next.why}`}>
    <Icon name="sparkles-outline" size={20} tint={kit.hue.learning} />
    <View style={s.flex}><Text style={s.startLabel}>START HERE</Text><Text style={s.startTitle} numberOfLines={2}>{next.task.title}</Text><View style={s.chips}>{course ? <PropChip kind="course" value={course.code || course.title} /> : null}<Text style={s.why}>{next.why}</Text></View></View>
    <Pressable onPress={() => onStart(next.task)} style={({ pressed }) => [s.startButton, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Start ${next.task.title}`}><Icon name="play" size={13} tint="#fff" /><Text style={s.startButtonText}>Start</Text></Pressable>
  </View>
}

export function ClassesToday({ classes, now }: { classes: MeetingOccurrence[]; now: number }) {
  const [prefs] = useCalendarPrefs()
  if (!classes.length) return null
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return <WorkspaceSection title="Classes today" icon="time-outline" tint={kit.hue.learning} count={String(classes.length)} flush>{classes.map(({ course, meeting }) => {
    const over = now >= minutes(meeting.end), live = now >= minutes(meeting.start) && !over
    return <View key={`${course.id}${meeting.id}`} style={[s.classRow, over && s.over]} accessible accessibilityLabel={`${course.title} ${meetingKindLabel(meeting.kind)} ${formatTime(meeting.start, prefs.timeFormat)} to ${formatTime(meeting.end, prefs.timeFormat)}`}>
      <View style={[s.bar, { backgroundColor: kindInfo(course).tint }]} />
      <View style={s.time}><Text style={s.timeText}>{formatTime(meeting.start, prefs.timeFormat)}</Text><Text style={s.timeSub}>to {formatTime(meeting.end, prefs.timeFormat)}</Text></View>
      <View style={s.flex}><Text style={s.title} numberOfLines={1}>{course.title}{meeting.kind !== "class" ? ` · ${meetingKindLabel(meeting.kind)}` : ""}</Text>{meeting.location ? <Text style={s.sub} numberOfLines={1}>{meeting.location}</Text> : null}</View>
      {live ? <PropChip kind="status" value="NOW" /> : null}
    </View>
  })}</WorkspaceSection>
}

/** Where a task stands; tapping a status saves it. Submitted and graded also finish the task. */
export function StatusPills({ task, onStatus }: { task: Task; onStatus: (status: ReturnType<typeof statusOf>) => void }) {
  const current = statusOf(task)
  return <View style={s.statusRow} accessibilityLabel={`Status: ${statusLabel(current)}`}>{WORK_STATUSES.map(x => <Pill key={x.value} label={x.label} selected={current === x.value} onPress={() => onStatus(x.value)} />)}</View>
}

/** The plan is only a proposal: nothing is saved until the user adds it to their days. */
export function PlanWeekSheet({ data, today, onClose }: { data: Collections; today: string; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const proposals = planWeek({ tasks: data.tasks, courses: data.courses }, today)
  const [off, setOff] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const chosen = proposals.filter(p => !off.includes(p.task.id))
  async function apply() {
    if (busy || !chosen.length) return
    setBusy(true)
    const ok = await mutate(["tasks"], d => applyFocusPlan(d, chosen.map(p => ({ id: p.task.id, date: p.date }))))
    setBusy(false)
    if (ok) onClose(); else setError(message ?? "Could not save the plan. Nothing was changed.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.head}><Text style={s.heading}>Plan my next two weeks</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" tint={c.muted} /></Pressable></View>
    <ScrollView style={s.list} contentContainerStyle={s.listContent}>
      {proposals.length ? <Text style={s.note}>Each one goes on a day a few days before it is due, never more than three a day. They show as your focus for that day. Untick what you'd rather plan yourself.</Text> : <Text style={s.note}>Nothing left to plan. Everything due in the next two weeks already has a day, or nothing is due.</Text>}
      {proposals.map(p => <View key={p.task.id} style={s.planRow}><TaskCheck checked={!off.includes(p.task.id)} onPress={() => setOff(v => v.includes(p.task.id) ? v.filter(x => x !== p.task.id) : [...v, p.task.id])} label={`Plan ${p.task.title}`} compact /><View style={s.flex}><Text style={s.title} numberOfLines={2}>{p.task.title}</Text><Text style={s.sub} numberOfLines={2}>{p.why}</Text></View><Text style={s.when}>{p.date === today ? "Today" : shortDay(p.date)}</Text></View>)}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}><SmallButton label="Close" onPress={onClose} />{proposals.length ? <Pressable onPress={() => void apply()} disabled={!chosen.length || busy} style={[s.apply, !chosen.length && s.disabled]} accessibilityRole="button"><Text style={s.applyText}>{busy ? "Saving…" : `Add ${chosen.length} to my days`}</Text></Pressable> : null}</View>
  </View></View></Modal>
}

export { daysLabel }

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.72 }, chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 3 },
  start: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.selectedBorder },
  startLabel: { color: c.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }, startTitle: { color: c.text, fontSize: 15, fontWeight: "700", marginTop: 1 }, why: { color: c.muted, fontSize: 11.5 },
  startButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, borderRadius: shape.card, backgroundColor: c.action }, startButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  classRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingVertical: 5, paddingHorizontal: 8 }, over: { opacity: 0.55 }, bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  time: { width: 62 }, timeText: { color: c.text2, fontSize: 12, fontWeight: "600" }, timeSub: { color: c.muted, fontSize: 10 }, title: { color: c.text, fontSize: 13.5, fontWeight: "600" }, sub: { color: c.muted, fontSize: 11.5 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "80%", borderRadius: shape.dialog, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  head: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: c.line }, heading: { color: c.text, fontSize: 15, fontWeight: "600" },
  list: { flexGrow: 0 }, listContent: { paddingVertical: 6 }, note: { color: c.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: 12, paddingVertical: 6 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 50, paddingHorizontal: 6, borderTopWidth: 1, borderColor: c.line }, when: { color: c.text2, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderColor: c.line },
  apply: { minHeight: 32, paddingHorizontal: 13, borderRadius: shape.card, justifyContent: "center", backgroundColor: c.action }, disabled: { opacity: 0.45 }, applyText: { color: "#fff", fontSize: 12, fontWeight: "600" }, error: { color: "#ff8787", fontSize: 12, padding: 12 },
})
