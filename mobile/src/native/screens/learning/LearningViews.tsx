import { formatTime } from "../planner/calendar/format.ts"
import { useCalendarPrefs } from "../planner/calendar/useCalendarPrefs.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../../editing/keyboard.tsx"
import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { updateCourse } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Icon } from "../../ui.tsx"
import { shortDay } from "../planner/dates.ts"
import { typeLabel } from "../planner/learning-types.ts"
import { TaskCheck } from "../planner/TaskCheck.tsx"
import { TaskPeek, previewText } from "../planner/TaskPeek.tsx"
import { isSafeLink } from "../planner/doc-links.ts"
import { Pill, SmallButton } from "./LearningControls.tsx"
import { dueGroup, kindInfo, learningProgress, learningToday, upcomingLearning, type Course, type Task } from "./learning-view.ts"

export type WorkTab = "open" | "done" | "all"
type Note = NonNullable<ReturnType<typeof useWorkspace>["data"]>["notes"][number]

export function Progress({ course, tasks }: { course: Course; tasks: Task[] }) {
  const p = learningProgress(course, tasks)
  return <View style={s.progress}><Text style={s.progressText}>{p.label}</Text>{p.best != null ? <Text style={s.meta}>Best practice test {p.best}%</Text> : null}{p.measured ? <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p.value * 100) }}><View style={[s.bar, { width: `${p.value * 100}%`, backgroundColor: kindInfo(course).tint }]} /></View> : null}</View>
}

export function Library({ courses, tasks, notes, total, onOpen, onAdd }: { courses: Course[]; tasks: Task[]; notes: Note[]; total: number; onOpen: (course: Course) => void; onAdd: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Library</Text><Text style={s.meta}>{courses.length} items</Text></View>{courses.map(x => <View key={x.id}><CourseRow course={x} tasks={tasks.filter(t => t.courseId === x.id)} onPress={() => setSelected(id => id === x.id ? null : x.id)} />{selected === x.id ? <CoursePeek course={x} tasks={tasks} noteCount={notes.filter(n => n.courseId === x.id).length} onOpen={() => onOpen(x)} /> : null}</View>)}{!courses.length ? <View style={s.empty}><Text style={s.emptyTitle}>{total ? "No matches" : "Your learning library is empty"}</Text><Text style={s.meta}>{total ? "Try a different search or kind." : "Add a course, certification, skill, book, or self-paced track."}</Text>{!total ? <SmallButton label="+ Add learning" onPress={onAdd} /> : null}</View> : null}</>
}
function CourseRow({ course, tasks, onPress }: { course: Course; tasks: Task[]; onPress: () => void }) {
  const p = learningProgress(course, tasks)
  const next = tasks.filter(t => !t.done && t.kind !== "event" && t.learningType !== "event" && t.due).sort((a, b) => a.due!.localeCompare(b.due!))[0]
  return <Pressable onPress={onPress} style={({ pressed }) => [s.courseRow, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Preview ${course.title}. ${p.label}`}><View style={[s.kindMark, { backgroundColor: kindInfo(course).tint }]} /><View style={s.flex}><Text style={s.rowTitle} numberOfLines={2}>{course.title}</Text><Text style={s.meta} numberOfLines={1}>{[kindInfo(course).label, course.code, p.label].filter(Boolean).join(" · ")}</Text>{next ? <Text style={s.next} numberOfLines={1}>Due · {next.title} · {shortDay(next.due!)}</Text> : null}{p.measured ? <View style={s.track}><View style={[s.bar, { width: `${p.value * 100}%`, backgroundColor: kindInfo(course).tint }]} /></View> : null}</View><Icon name="chevron-down" size={16} tint={c.muted} /></Pressable>
}
function CoursePeek({ course, tasks, noteCount = 0, onOpen }: { course: Course; tasks: Task[]; noteCount?: number; onOpen: () => void }) {
  const open = tasks.filter(t => t.courseId === course.id && !t.done).length
  return <View style={s.coursePeek}>{course.description ? <Text style={s.peekText} numberOfLines={2} ellipsizeMode="tail">{previewText(course.description)}</Text> : null}<Text style={s.meta} numberOfLines={2}>{[course.schedule, course.location, `${open} open`, noteCount ? `${noteCount} linked notes` : "", course.links?.length ? `${course.links.length} resources` : ""].filter(Boolean).join(" · ")}</Text><SmallButton label="Open" onPress={onOpen} /></View>
}

export function Today({ courses, tasks, today, onTask, onCourse, onAddTask, onAddSession, onToggle }: { courses: Course[]; tasks: Task[]; today: string; onTask: (id: string) => void; onCourse: (id: string) => void; onAddTask: () => void; onAddSession: () => void; onToggle: (task: Task) => void }) {
  const day = learningToday(courses, tasks, today)
  const [prefs] = useCalendarPrefs()
  const [selected, setSelected] = useState<string | null>(null)
  const sections = [{ title: "Today's schedule", rows: day.schedule }, { title: "Overdue", rows: day.overdue }, { title: "Due today", rows: day.due }]
  return <><View style={s.sectionHead}><Text style={s.sectionTitle} accessibilityRole="header">Today · {shortDay(today)}</Text><SmallButton label="+ Task" onPress={onAddTask} /><SmallButton label="+ Session" onPress={onAddSession} /></View>
    {sections.map(section => <View key={section.title} style={s.group}><Text accessibilityRole="header" style={[s.groupLabel, section.title === "Overdue" && s.error]}>{section.title} · {section.rows.length}</Text>{section.rows.map(task => {
      const course = courses.find(course => course.id === task.courseId)!
      const event = task.kind === "event" || task.learningType === "event"
      const schedule = section.title === "Today's schedule"
      const key = `${section.title}/${task.id}`
      return <View key={task.id}><View style={s.workRow}>{event ? <Icon name="calendar-outline" tint={kindInfo(course).tint} size={20} /> : <TaskCheck checked={false} onPress={() => onToggle(task)} label={`Complete ${task.title}`} />}<Pressable accessibilityRole="button" accessibilityLabel={`Preview ${task.title}`} onPress={() => setSelected(id => id === key ? null : key)} style={s.flex}><Text style={s.rowTitle} numberOfLines={2}>{task.title}</Text><Text style={s.meta}>{[schedule ? task.scheduledTime ? formatTime(task.scheduledTime, prefs.timeFormat) : "All day" : task.due ? `Due ${shortDay(task.due)}` : "", event ? "Session / event" : schedule ? "Planned work" : typeLabel(task.learningType ?? "", course.kind), course.title].filter(Boolean).join(" · ")}</Text></Pressable></View>{selected === key ? <TaskPeek task={task} course={course.title} onOpen={() => onTask(task.id)} /> : null}</View>
    })}{section.rows.length === 0 ? <Text style={s.emptyHint}>{section.title === "Today's schedule" ? "Plan a dated session or schedule a learning task to see it here." : section.title === "Overdue" ? "Nothing overdue." : "Nothing due today."}</Text> : null}</View>)}
    {day.exams.map(course => <View key={course.id}><Pressable style={s.recordRow} accessibilityRole="button" accessibilityLabel={`Preview ${course.title} exam date`} onPress={() => setSelected(id => id === `exam/${course.id}` ? null : `exam/${course.id}`)}><Icon name="ribbon-outline" tint={kindInfo(course).tint} /><Text style={s.rowTitle}>{course.title} · Exam today</Text></Pressable>{selected === `exam/${course.id}` ? <CoursePeek course={course} tasks={tasks} onOpen={() => onCourse(course.id)} /> : null}</View>)}
  </>
}

export function Upcoming({ courses, tasks, today, onTask, onCourse }: { courses: Course[]; tasks: Task[]; today: string; onTask: (id: string) => void; onCourse: (id: string) => void }) {
  const [prefs] = useCalendarPrefs()
  const [selected, setSelected] = useState<string | null>(null)
  const rows = upcomingLearning(courses, tasks, today)
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Upcoming</Text><Text style={s.meta}>{rows.length} dated items</Text></View>{(["Overdue", "Next 7 days", "Later"] as const).map(group => { const part = rows.filter(x => dueGroup(x.due, today) === group); return part.length ? <View key={group} style={s.group}><Text style={[s.groupLabel, group === "Overdue" && s.error]}>{group} · {part.length}</Text>{part.map(x => {
    const course = courses.find(y => y.id === x.courseId)
    return <View key={x.id}><Pressable onPress={() => setSelected(id => id === x.id ? null : x.id)} style={({ pressed }) => [s.upcomingRow, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Preview ${x.title}`}><View style={s.dateBox}><Text style={s.dateText}>{shortDay(x.due)}</Text></View><View style={s.flex}><Text style={s.rowTitle} numberOfLines={2}>{x.title}</Text><Text style={s.meta} numberOfLines={1}>{course?.title} · {x.occasion ? `${x.occasion === "planned" ? "Planned work" : "Session / event"}${x.time ? ` · ${formatTime(x.time, prefs.timeFormat)}` : " · All day"}` : x.task ? typeLabel(x.task.learningType ?? "", course?.kind) : "Exam date"}</Text></View><Icon name="chevron-down" size={16} tint={c.muted} /></Pressable>{selected === x.id ? x.task ? <TaskPeek task={x.task} course={course?.title} onOpen={() => onTask(x.task!.id)} /> : course ? <CoursePeek course={course} tasks={tasks} onOpen={() => onCourse(course.id)} /> : null : null}</View>
  })}</View> : null })}{rows.length === 0 ? <Text style={s.emptyHint}>No dated learning work yet. Add a deadline or schedule a session.</Text> : null}</>
}

export function Work({ course, tasks, tab, onTab, onAdd, onOpen, onToggle }: { course: Course; tasks: Task[]; tab: WorkTab; onTab: (tab: WorkTab) => void; onAdd: () => void; onOpen: (id: string) => void; onToggle: (task: Task) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const shown = tasks.filter(t => tab === "all" || (tab === "done") === t.done).sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Work</Text><SmallButton label="+ Add" onPress={onAdd} /></View><View style={s.smallTabs}>{(["open", "done", "all"] as const).map(x => <Pill key={x} label={x[0].toUpperCase() + x.slice(1)} selected={tab === x} onPress={() => { setSelected(null); onTab(x) }} />)}</View>{shown.map(t => <View key={t.id}><View style={s.workRow}>{t.kind === "event" || t.learningType === "event" ? <Icon name="calendar-outline" size={18} tint={c.accent} /> : <TaskCheck checked={t.done} onPress={() => onToggle(t)} label={`${t.done ? "Reopen" : "Complete"} ${t.title}`} />}<Pressable onPress={() => setSelected(id => id === t.id ? null : t.id)} style={s.flex} accessibilityRole="button" accessibilityLabel={`Preview ${t.title}`}><Text style={[s.rowTitle, t.done && s.done]} numberOfLines={2}>{t.title}</Text><Text style={s.meta}>{[typeLabel(t.learningType ?? "", course.kind), t.due ? shortDay(t.due) : "", t.score != null ? `Score ${t.score}%` : ""].filter(Boolean).join(" · ")}</Text></Pressable><Pressable onPress={() => setSelected(id => id === t.id ? null : t.id)} style={s.iconTouch} accessibilityRole="button" accessibilityLabel={`Preview ${t.title}`}><Icon name="chevron-down" size={17} tint={c.muted} /></Pressable></View>{selected === t.id ? <TaskPeek task={t} course={course.title} onOpen={() => onOpen(t.id)} /> : null}</View>)}{!shown.length ? <Text style={s.emptyHint}>{tab === "done" ? "Completed work will appear here." : "No work here yet. Add a step when you’re ready."}</Text> : null}</>
}

export function LinkedNotes({ notes, onAdd, onOpen }: { notes: Note[]; onAdd: () => void; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Linked notes</Text><SmallButton label="+ Note" onPress={onAdd} /></View>{notes.map(n => <View key={n.id}><Pressable onPress={() => setSelected(id => id === n.id ? null : n.id)} style={s.recordRow} accessibilityRole="button" accessibilityLabel={`Preview note ${n.text.trim().split("\n")[0] || "Untitled"}`}><Icon name="document-text-outline" size={17} tint={c.accent} /><Text style={[s.rowTitle, s.flex]} numberOfLines={2}>{n.text.trim().split("\n")[0] || "Untitled note"}</Text><Icon name="chevron-down" size={16} tint={c.muted} /></Pressable>{selected === n.id ? <View style={s.coursePeek}><Text style={s.peekText} numberOfLines={2} ellipsizeMode="tail">{previewText(n.text)}</Text><SmallButton label="Open" onPress={() => onOpen(n.id)} /></View> : null}</View>)}{!notes.length ? <Text style={s.emptyHint}>Notes linked to this item will appear here.</Text> : null}</>
}

export function Overview({ course, tasks, blocked, mutate, onError }: { course: Course; tasks: Task[]; blocked: boolean; mutate: ReturnType<typeof useWorkspace>["mutate"]; onError: (text: string) => void }) {
  const [pages, setPages] = useState(String(course.pagesRead ?? ""))
  const [saving, setSaving] = useState(false)
  const read = Number(pages)
  const validPages = pages.trim() && Number.isInteger(read) && read >= 0 && (course.pagesTotal == null || read <= course.pagesTotal) && read !== (course.pagesRead ?? 0)
  async function savePages() {
    if (blocked) return onError("Resolve the sync conflict before editing.")
    if (!validPages || saving) return onError("Enter a whole page number within this book.")
    setSaving(true)
    const ok = await mutate(["courses"], d => updateCourse(d, course.id, { pagesRead: read }))
    setSaving(false)
    if (!ok) onError("Could not update your reading progress.")
  }
  const facts = [[course.kind === "reading" ? "Author" : course.kind === "certification" ? "Vendor" : "Source", course.instructor], ["When", [course.startDate && shortDay(course.startDate), course.endDate && shortDay(course.endDate)].filter(Boolean).join(" – ")], ["Schedule", course.schedule], ["Location", course.location], ["Term", course.term]].filter(([, value]) => !!value)
  return <><Text style={s.sectionTitle}>Overview</Text>{course.description ? <Text style={s.body}>{course.description}</Text> : null}{course.kind === "reading" ? <View style={s.pages}><Text style={s.meta}>Pages read</Text><TextInput value={pages} onChangeText={setPages} keyboardType="number-pad" style={s.pageInput} accessibilityLabel="Pages read" placeholder="0" placeholderTextColor={c.muted} /><Text style={s.meta}>/ {course.pagesTotal ?? "?"}</Text><SmallButton label={saving ? "Saving…" : "Update"} onPress={() => void savePages()} /></View> : null}{facts.map(([label, value]) => <View key={label} style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factValue}>{value}</Text></View>)}{course.kind === "certification" && course.endDate ? <Text style={s.meta}>Exam date is scheduled; passing status is not recorded here.</Text> : null}{course.url || course.links?.length ? <><Text style={s.sectionTitle}>Resources</Text>{course.url ? <Resource label="Main link" url={course.url} /> : null}{course.links?.map((link, i) => <Resource key={`${link.url}-${i}`} label={link.label || link.url} url={link.url} />)}</> : null}{!course.description && !facts.length && !course.url && !course.links?.length && course.kind !== "reading" ? <Text style={s.emptyHint}>Add a description, dates, or resources from Edit.</Text> : null}{tasks.filter(t => !t.done).length ? <Text style={s.meta}>{tasks.filter(t => !t.done).length} open work items</Text> : null}</>
}
function Resource({ label, url }: { label: string; url: string }) {
  if (!isSafeLink(url)) return <View style={s.recordRow}><Icon name="link-outline" size={16} tint={c.muted} /><Text style={[s.meta, s.flex]} numberOfLines={1}>{label} · Check link in editor</Text></View>
  return <Pressable onPress={() => void Linking.openURL(url).catch(() => {})} style={s.recordRow} accessibilityRole="link" accessibilityLabel={`Open ${label}`}><Icon name="link-outline" size={16} tint={c.accent} /><Text style={[s.rowTitle, s.flex]} numberOfLines={1}>{label}</Text><Icon name="open-outline" size={15} tint={c.muted} /></Pressable>
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.72 }, sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }, sectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  progress: { gap: 4, paddingVertical: 2 }, progressText: { color: c.text2, fontSize: 12 }, track: { width: "100%", height: 3, borderRadius: 2, backgroundColor: c.raised, overflow: "hidden", marginTop: 3 }, bar: { height: 3, borderRadius: 2 },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }, kindMark: { width: 5, height: 30, borderRadius: 3 }, rowTitle: { color: c.text, fontSize: 14, lineHeight: 19, fontWeight: "600" }, next: { color: c.text2, fontSize: 11, lineHeight: 16 },
  coursePeek: { gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: c.selected, borderLeftWidth: 3, borderLeftColor: c.accent }, peekText: { color: c.text2, fontSize: 12, lineHeight: 17 },
  group: { gap: 1 }, groupLabel: { color: c.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 5 }, error: { color: "#ff8787" }, upcomingRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 49, borderBottomWidth: 1, borderColor: c.line }, dateBox: { minWidth: 46, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 8, backgroundColor: c.raised, alignItems: "center" }, dateText: { color: c.dateText, fontSize: 11 },
  smallTabs: { flexDirection: "row", gap: 6 }, workRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 43, paddingVertical: 4, borderBottomWidth: 1, borderColor: c.line }, done: { color: c.green, textDecorationLine: "line-through" }, iconTouch: { width: 32, minHeight: 34, alignItems: "center", justifyContent: "center" }, recordRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 39, borderBottomWidth: 1, borderColor: c.line },
  body: { color: c.text2, fontSize: 13, lineHeight: 19 }, fact: { flexDirection: "row", gap: 9, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 6 }, factLabel: { width: 66, color: c.muted, fontSize: 12 }, factValue: { flex: 1, color: c.text2, fontSize: 12 }, pages: { flexDirection: "row", alignItems: "center", gap: 7 }, pageInput: { width: 55, minHeight: 30, borderRadius: 9, borderWidth: 1, borderColor: c.line, color: c.text, textAlign: "center", fontSize: 13, paddingVertical: 3 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28 }, emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" }, emptyHint: { color: c.muted, fontSize: 13, lineHeight: 19, paddingVertical: 14 },
})



