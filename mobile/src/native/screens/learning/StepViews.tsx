import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { addSubtasks, dueWords, studyPlan, toggleSubtask, toggleTask, topicUsage, updateCourse, updateTask, weekLoad, WEEKDAY_LABELS, type Collections, type StudyProposal } from "../../../lib/shared.ts"
import { addDaysToKey, weekdayOfKey } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { shape } from "../../../shape.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Icon } from "../../ui.tsx"
import { PropChip } from "../../kit/PropChip.tsx"
import { kit } from "../../kit/tokens.ts"
import { WorkspaceSection } from "../../WorkspacePage.tsx"
import { shortDay } from "../planner/dates.ts"
import { TaskCheck } from "../planner/TaskCheck.tsx"
import { Pill, SmallButton } from "./LearningControls.tsx"
import { kindInfo, type Course, type Task } from "./learning-view.ts"

type Step = NonNullable<Task["subtasks"]>[number]

/** Steps you planned for today (or earlier): tick one off, or tap to open the task it belongs to. */
export function StepsToday({ steps, courses, today, onOpen }: { steps: { task: Task; step: Step }[]; courses: Course[]; today: string; onOpen: (id: string) => void }) {
  const { mutate } = useWorkspace()
  if (!steps.length) return null
  return <WorkspaceSection title="Steps you planned" icon="footsteps-outline" tint={kit.hue.learning} count={String(steps.length)} collapsible flush>{steps.map(({ task, step }) => {
    const course = courses.find(x => x.id === task.courseId)
    return <View key={step.id} style={s.row}>
      <TaskCheck checked={step.done} onPress={() => void mutate(["tasks"], d => toggleSubtask(d, task.id, step.id))} label={`Finish step: ${step.title}`} />
      <Pressable onPress={() => onOpen(task.id)} style={s.flex} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`}><Text style={s.title} numberOfLines={2}>{step.title}</Text><View style={s.chips}>{course ? <PropChip kind="course" value={course.code || course.title} /> : null}<Text style={s.sub} numberOfLines={1}>{task.title}</Text>{step.date && step.date < today ? <PropChip kind="overdue" value={dueWords(step.date, today).toUpperCase()} /> : null}</View></Pressable>
    </View>
  })}</WorkspaceSection>
}

/** Exams coming up with no study plan yet. */
export function StudyNudges({ exams, courses, today, onPlan }: { exams: Task[]; courses: Course[]; today: string; onPlan: (taskId: string) => void }) {
  if (!exams.length) return null
  return <WorkspaceSection title="Plan your studying" icon="book-outline" tint={kit.hue.learning} count={String(exams.length)} collapsible flush>{exams.map(t => {
    const course = courses.find(x => x.id === t.courseId)
    return <View key={t.id} style={s.row}><View style={s.flex}><Text style={s.title} numberOfLines={2}>{t.title}</Text><View style={s.chips}>{course ? <PropChip kind="course" value={course.code || course.title} /> : null}<Text style={s.sub}>{dueWords(t.due!, today)}</Text></View></View><SmallButton label="Plan studying" onPress={() => onPlan(t.id)} /></View>
  })}</WorkspaceSection>
}

/**
 * A study plan counted back from an exam. A proposal only: nothing is saved until the user adds it.
 * Inside an open task editor (`onDraft`) the steps go into that editor's draft and are saved with it.
 */
export function StudyPlanSheet({ data, taskId, today, onClose, onDraft }: { data: Collections; taskId: string; today: string; onClose: () => void; onDraft?: (steps: StudyProposal[]) => void }) {
  const { mutate, message } = useWorkspace()
  const exam = data.tasks.find(t => t.id === taskId)
  const plan = studyPlan({ tasks: data.tasks, courses: data.courses }, taskId, today)
  const [off, setOff] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const chosen = plan.filter((_, i) => !off.includes(i))
  async function apply() {
    if (busy || !chosen.length) return
    if (onDraft) { onDraft(chosen); onClose(); return }
    setBusy(true)
    const ok = await mutate(["tasks"], d => addSubtasks(d, taskId, chosen.map(p => ({ title: p.title, date: p.date, topicId: p.topicId }))))
    setBusy(false)
    if (ok) onClose(); else setError(message ?? "Could not save the plan. Nothing was changed.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.head}><Text style={s.heading} numberOfLines={1}>Plan studying{exam ? `: ${exam.title}` : ""}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" tint={c.muted} /></Pressable></View>
    <ScrollView style={s.list} contentContainerStyle={s.listContent}>
      <Text style={s.note}>{plan.length ? "Reviews are spread over the days before the exam, with a final review the day before. Untick what you'd rather skip." : "Nothing to add. Either the exam is today or past, or its reviews are already steps on it."}</Text>
      {plan.map((p, i) => <View key={`${p.title}${p.date}`} style={s.plan}><TaskCheck checked={!off.includes(i)} onPress={() => setOff(v => v.includes(i) ? v.filter(x => x !== i) : [...v, i])} label={`Add ${p.title}`} compact /><Text style={[s.title, s.flex]} numberOfLines={2}>{p.title}</Text><Text style={s.when}>{p.date === today ? "Today" : shortDay(p.date)}</Text></View>)}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}><SmallButton label="Close" onPress={onClose} />{plan.length ? <Pressable onPress={() => void apply()} disabled={!chosen.length || busy} style={[s.apply, !chosen.length && s.off]} accessibilityRole="button"><Text style={s.applyText}>{busy ? "Saving…" : `Add ${chosen.length} step${chosen.length === 1 ? "" : "s"}`}</Text></Pressable> : null}</View>
  </View></View></Modal>
}

/** Which module(s) a piece of work sits in. Tap to add or remove; saved at once. */
export function ModulePills({ course, task }: { course: Course; task: Task }) {
  const { mutate } = useWorkspace()
  const modules = course.topics ?? []
  async function flip(id: string) {
    const has = task.topicIds?.includes(id)
    const next = has ? (task.topicIds ?? []).filter(x => x !== id) : [...(task.topicIds ?? []), id]
    await mutate(["tasks"], d => updateTask(d, task.id, { topicIds: next.length ? next : undefined }))
  }
  return <View style={s.pills} accessibilityLabel="Module">{modules.map(m => <Pill key={m.id} label={m.title} selected={!!task.topicIds?.includes(m.id)} onPress={() => void flip(m.id)} />)}</View>
}

/** Put several pieces of work into a module at once, grouped by due date: tick a date to take everything due that day. */
export function AddWorkSheet({ course, moduleId, data, onClose }: { course: Course; moduleId: string; data: Collections; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const mod = course.topics?.find(m => m.id === moduleId)
  const candidates = data.tasks.filter(t => t.courseId === course.id && t.kind !== "event" && t.learningType !== "event" && !t.topicIds?.includes(moduleId)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title))
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const groups = [...new Set(candidates.map(t => t.due ?? ""))].map(due => ({ due, rows: candidates.filter(t => (t.due ?? "") === due) }))
  const flip = (ids: string[], on: boolean) => setPicked(v => on ? [...new Set([...v, ...ids])] : v.filter(x => !ids.includes(x)))
  async function apply() {
    if (busy || !picked.length) return
    setBusy(true)
    const known = new Set((course.topics ?? []).map(m => m.id))
    const ok = await mutate(["tasks"], d => picked.reduce((acc, id) => { const t = acc.tasks.find(x => x.id === id); return t ? updateTask(acc, id, { topicIds: [...new Set([...(t.topicIds ?? []).filter(m => !known.has(m)), moduleId])] }) : acc }, d))
    setBusy(false)
    if (ok) onClose(); else setError(message ?? "Could not save. Nothing was changed.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.head}><Text style={s.heading} numberOfLines={1}>Add work to {mod?.title ?? "module"}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" tint={c.muted} /></Pressable></View>
    <ScrollView style={s.list} contentContainerStyle={s.listContent}>
      <Text style={s.note}>{candidates.length ? "Tick a date to take everything due that day, or pick items one by one. Work in another module moves here." : `Everything in this course is already in ${mod?.title ?? "this module"}.`}</Text>
      {groups.map(g => <View key={g.due || "none"}>
        <View style={s.plan}><TaskCheck checked={g.rows.every(t => picked.includes(t.id))} onPress={() => flip(g.rows.map(t => t.id), !g.rows.every(t => picked.includes(t.id)))} label={`Everything due ${g.due || "with no date"}`} compact /><Text style={[s.title, s.flex]}>{g.due ? shortDay(g.due) : "No date"} · {g.rows.length}</Text></View>
        {g.rows.map(t => <View key={t.id} style={[s.plan, s.indent]}><TaskCheck checked={picked.includes(t.id)} onPress={() => flip([t.id], !picked.includes(t.id))} label={t.title} compact /><Text style={[s.sub, s.flex]} numberOfLines={2}>{t.title}</Text></View>)}
      </View>)}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}><SmallButton label="Cancel" onPress={onClose} /><Pressable onPress={() => void apply()} disabled={!picked.length || busy} style={[s.apply, !picked.length && s.off]} accessibilityRole="button"><Text style={s.applyText}>{busy ? "Saving…" : `Add ${picked.length || ""} to module`}</Text></Pressable></View>
  </View></View></Modal>
}

/** A course's modules. Tap one to see its work and add more; tick the ones you know. */
export function TopicsList({ course, data, blocked, onError }: { course: Course; data: Collections; blocked: boolean; onError: (text: string) => void }) {
  const { mutate } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const topics = course.topics ?? []
  if (!topics.length) return null
  const use = new Map(topicUsage({ tasks: data.tasks, courses: data.courses }, course.id).map(u => [u.topicId, u]))
  async function toggle(id: string) {
    if (blocked) return onError("Resolve the sync conflict before editing.")
    if (!await mutate(["courses"], d => updateCourse(d, course.id, { topics: topics.map(t => t.id === id ? { ...t, done: !t.done || undefined } : t) }))) onError("Could not save this module.")
  }
  return <>
    <WorkspaceSection title="Modules" icon="layers-outline" tint={kindInfo(course).tint} count={`${topics.filter(t => t.done).length} of ${topics.length} known`} flush>{topics.map(t => {
      const work = data.tasks.filter(x => x.courseId === course.id && x.topicIds?.includes(t.id) && x.kind !== "event").sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
      const notes = data.notes.filter(n => n.courseId === course.id && n.topicIds?.includes(t.id))
      const u = use.get(t.id)
      const isOpen = open === t.id
      return <View key={t.id}>
        <View style={s.row}>
          <TaskCheck checked={!!t.done} onPress={() => void toggle(t.id)} label={`I know ${t.title}`} />
          <Pressable onPress={() => setOpen(isOpen ? null : t.id)} style={s.flex} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={`${t.title}, ${work.length ? `${work.filter(x => x.done).length} of ${work.length} done` : "no work yet"}`}><Text style={[s.title, t.done && s.done]} numberOfLines={2}>{t.title}</Text><Text style={s.sub}>{work.length ? `${work.filter(x => x.done).length}/${work.length} done` : [u?.assignments ? `${u.assignments} assignment${u.assignments === 1 ? "" : "s"}` : "", u?.exams ? `${u.exams} exam${u.exams === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "No work yet"}</Text></Pressable>
          <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
        </View>
        {isOpen ? <View style={s.moduleBody}>
          {work.map(x => <View key={x.id} style={s.moduleRow}><TaskCheck checked={x.done} onPress={() => void mutate(["tasks"], d => toggleTask(d, x.id))} label={`${x.title}: ${x.done ? "reopen" : "done"}`} compact /><Text style={[s.sub, s.flex, x.done && s.done]} numberOfLines={1}>{x.title}</Text><Text style={s.sub}>{x.due ? shortDay(x.due) : ""}</Text></View>)}
          {notes.map(n => <Text key={n.id} style={s.sub} numberOfLines={1}>Note: {n.text.split("\n")[0]}</Text>)}
          <SmallButton label="+ Add work" onPress={() => setAdding(t.id)} />
        </View> : null}
      </View>
    })}</WorkspaceSection>
    {adding ? <AddWorkSheet course={course} moduleId={adding} data={data} onClose={() => setAdding(null)} /> : null}
  </>
}

const LOAD_TONE = { light: c.muted, busy: c.amber, heavy: "#ff8787" } as const
const LOAD_LABEL = { light: "Light", busy: "Busy", heavy: "Heavy" } as const

/** The week at a glance: how heavy each day is, with what is due, planned and in class. */
export function WeekView({ data, today, onOpen, onPlan }: { data: Collections; today: string; onOpen: (id: string) => void; onPlan: () => void }) {
  const [offset, setOffset] = useState(0)
  // The week starts on Sunday here, as the calendar does by default.
  const first = addDaysToKey(addDaysToKey(today, -weekdayOfKey(today))!, offset * 7)!
  const days = weekLoad({ tasks: data.tasks, courses: data.courses }, first)
  return <>
    <View style={s.weekHead}><Text style={s.weekTitle} accessibilityRole="header">{shortDay(first)} – {shortDay(addDaysToKey(first, 6)!)}</Text><View style={s.weekNav}><Pill label="This week" selected={offset === 0} onPress={() => setOffset(0)} /><Pill label="‹" selected={false} onPress={() => setOffset(v => v - 1)} /><Pill label="›" selected={false} onPress={() => setOffset(v => v + 1)} /></View></View>
    <SmallButton label="Plan my next weeks" onPress={onPlan} />
    {days.map(d => <View key={d.date} style={[s.day, d.date === today && s.dayToday]} accessible accessibilityLabel={`${WEEKDAY_LABELS[weekdayOfKey(d.date)]} ${shortDay(d.date)}, ${LOAD_LABEL[d.load]}`}>
      <View style={s.dayHead}><Text style={s.dayName}>{WEEKDAY_LABELS[weekdayOfKey(d.date)]} {shortDay(d.date)}</Text><Text style={[s.load, { color: LOAD_TONE[d.load] }]}>{LOAD_LABEL[d.load].toUpperCase()}</Text></View>
      {d.classes ? <Text style={s.sub}>{d.classes} class{d.classes === 1 ? "" : "es"} · {(d.classMinutes / 60).toFixed(d.classMinutes % 60 ? 1 : 0)}h</Text> : null}
      {d.due.map(t => <Pressable key={t.id} onPress={() => onOpen(t.id)} style={s.item} accessibilityRole="button" accessibilityLabel={`Due: ${t.title}`}><Icon name="flag-outline" size={13} tint={t.learningType === "exam" ? "#ff8787" : c.amber} /><Text style={s.itemText} numberOfLines={2}>{t.title}</Text></Pressable>)}
      {d.focus.filter(t => t.due !== d.date).map(t => <Pressable key={t.id} onPress={() => onOpen(t.id)} style={[s.item, s.dashed]} accessibilityRole="button"><Text style={s.itemText} numberOfLines={2}>Work on: {t.title}</Text></Pressable>)}
      {d.steps.map(({ task, step }) => <Pressable key={step.id} onPress={() => onOpen(task.id)} style={[s.item, s.dashed]} accessibilityRole="button"><Text style={s.itemText} numberOfLines={2}>Step: {step.title}</Text></Pressable>)}
      {!d.classes && !d.due.length && !d.focus.length && !d.steps.length ? <Text style={s.sub}>Free</Text> : null}
    </View>)}
  </>
}

const s = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 10, paddingBottom: 8 }, indent: { paddingLeft: 26 }, moduleBody: { gap: 4, paddingHorizontal: 12, paddingBottom: 8 }, moduleRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34 },
  flex: { flex: 1, minWidth: 0 }, row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.line },
  title: { color: c.text, fontSize: 14, lineHeight: 19, fontWeight: "600" }, done: { color: c.muted, textDecorationLine: "line-through" }, sub: { color: c.muted, fontSize: 11.5 }, chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 2 },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "80%", borderRadius: shape.dialog, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  head: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: c.line }, heading: { color: c.text, fontSize: 15, fontWeight: "600", flex: 1 },
  list: { flexGrow: 0 }, listContent: { paddingVertical: 6 }, note: { color: c.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: 12, paddingVertical: 6 }, plan: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 46, paddingHorizontal: 6, borderTopWidth: 1, borderColor: c.line }, when: { color: c.text2, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderColor: c.line }, apply: { minHeight: 32, paddingHorizontal: 13, borderRadius: shape.card, justifyContent: "center", backgroundColor: c.action }, off: { opacity: 0.45 }, applyText: { color: "#fff", fontSize: 12, fontWeight: "600" }, error: { color: "#ff8787", fontSize: 12, padding: 12 },
  weekHead: { gap: 6 }, weekTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, weekNav: { flexDirection: "row", gap: 6 },
  day: { gap: 5, padding: 10, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, dayToday: { borderColor: c.selectedBorder }, dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, dayName: { color: c.text, fontSize: 13, fontWeight: "700" }, load: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  item: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.raised }, dashed: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: c.line }, itemText: { color: c.text2, fontSize: 12, flex: 1 },
})
