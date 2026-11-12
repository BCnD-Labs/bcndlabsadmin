import { formatTime } from "../planner/calendar/format.ts"
import { useCalendarPrefs } from "../planner/calendar/useCalendarPrefs.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../../editing/keyboard.tsx"
import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { statusLabel, statusOf, todayPlan, updateCourse, type Collections, type WorkStatus } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { mono } from "../../../theme.ts"
import { Icon } from "../../ui.tsx"
import { shape } from "../../../shape.ts"
import { todayKey } from "../../data/sync-view.ts"
import { WorkspaceSection } from "../../WorkspacePage.tsx"
import { MiniBar, Ring } from "../../kit/charts.tsx"
import { PropChip } from "../../kit/PropChip.tsx"
import { dateParts } from "../../kit/stats.ts"
import { chipTone, kit, type ChipKind } from "../../kit/tokens.ts"
import { shortDay } from "../planner/dates.ts"
import { typeLabel } from "../planner/learning-types.ts"
import { TaskCheck } from "../planner/TaskCheck.tsx"
import { ReflectionList, learningReflections, type LearningReflection } from "../LearningReflections.tsx"
import { selectedItem } from "../../selected-item.ts"
import { TaskPeek, previewText } from "../planner/TaskPeek.tsx"
import { isSafeLink } from "../planner/doc-links.ts"
import { Pill, SmallButton } from "./LearningControls.tsx"
import { ClassesToday, StartHere, StatusPills } from "./PlanViews.tsx"
import { ModulePills, StepsToday, StudyNudges, TopicsList } from "./StepViews.tsx"
import { stepProgress } from "../../../lib/shared.ts"
import { dueGroup, kindInfo, learningProgress, learningToday, upcomingLearning, type Course, type Task } from "./learning-view.ts"

export type WorkTab = "open" | "done" | "all"
type Note = NonNullable<ReturnType<typeof useWorkspace>["data"]>["notes"][number]

export function Progress({ course, tasks }: { course: Course; tasks: Task[] }) {
  const p = learningProgress(course, tasks)
  const tint = kindInfo(course).tint
  return <View style={s.progress}>
    {p.measured ? <Ring value={p.value} size={36} tint={tint} label={`${course.title}, ${Math.round(p.value * 100)} percent`} /> : <View style={s.noRing} accessible={false}><Text style={s.noRingText}>–</Text></View>}
    <View style={s.flex}><Text style={s.progressText}>{p.label}</Text>{p.best != null ? <View style={s.chipRow}><PropChip kind="status" label="Best practice test" value={`${p.best}%`} /></View> : null}{p.measured ? <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p.value * 100) }}><View style={[s.bar, { width: `${p.value * 100}%`, backgroundColor: tint }]} /></View> : null}</View>
  </View>
}

export function Library({ courses, tasks, notes, total, onOpen, onAdd }: { courses: Course[]; tasks: Task[]; notes: Note[]; total: number; onOpen: (course: Course) => void; onAdd: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return <>
    <WorkspaceSection compact title="Library" icon="school-outline" tint={kit.hue.learning} count={`${courses.length} ${courses.length === 1 ? "item" : "items"}`} flush>
      {courses.map(x => <View key={x.id} style={[selectedItem.item, selected === x.id && selectedItem.itemOn]}><CourseRow course={x} selected={selected === x.id} tasks={tasks.filter(t => t.courseId === x.id)} onPress={() => setSelected(id => id === x.id ? null : x.id)} />{selected === x.id ? <CoursePeek course={x} tasks={tasks} noteCount={notes.filter(n => n.courseId === x.id).length} onOpen={() => onOpen(x)} /> : null}</View>)}
      {!courses.length ? <View style={s.empty}><Text style={s.emptyTitle}>{total ? "No matches" : "Your learning library is empty"}</Text><Text style={s.meta}>{total ? "Try a different search or kind." : "Add a course, certification, skill, book, or self-paced track."}</Text>{!total ? <SmallButton label="+ Add learning" onPress={onAdd} /> : null}</View> : null}
    </WorkspaceSection>
    {courses.length ? <Text style={s.foot}>Progress reflects finished work, milestones, or pages, according to the learning item.</Text> : null}
  </>
}
function CourseRow({ course, selected, tasks, onPress }: { course: Course; selected: boolean; tasks: Task[]; onPress: () => void }) {
  const p = learningProgress(course, tasks)
  const tint = kindInfo(course).tint
  const today = todayKey()
  const next = tasks.filter(t => !t.done && t.kind !== "event" && t.learningType !== "event" && t.due).sort((a, b) => a.due!.localeCompare(b.due!))[0]
  return <Pressable onPress={onPress} style={({ pressed }) => [s.courseRow, { borderLeftColor: tint }, selected && s.courseRowOn, pressed && s.pressed]} accessibilityRole="button" accessibilityState={{ expanded: selected }} accessibilityLabel={`Preview ${course.title}. ${p.label}`}>
    <View style={s.flex}>
      <Text style={s.libraryTitle} numberOfLines={1}>{course.title}</Text>
      <View style={s.chipRow}>
        <View style={[s.kindLabel, { backgroundColor: `${tint}24` }]}><Text style={[s.kindText, { color: tint }]}>{kindInfo(course).label.toUpperCase()}</Text></View>
        {course.code ? <PropChip kind="neutral" label="Code" value={course.code} /> : null}
        {next ? <PropChip kind={next.due! < today ? "overdue" : "date"} label="Next" value={shortDay(next.due!)} /> : null}
      </View>
      <View style={s.libraryProgress}><Text style={s.libraryProgressLabel} numberOfLines={1}>{p.label}</Text>{p.measured ? <><View style={s.libraryProgressBar}><MiniBar value={p.value} tint={tint} /></View><Text style={[s.libraryPercent, { color: tint }]}>{Math.round(p.value * 100)}%</Text></> : null}</View>
    </View>
    <Icon name={selected ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
  </Pressable>
}
function CoursePeek({ course, tasks, noteCount = 0, onOpen }: { course: Course; tasks: Task[]; noteCount?: number; onOpen: () => void }) {
  const open = tasks.filter(t => t.courseId === course.id && !t.done).length
  const when = [course.startDate && shortDay(course.startDate), course.endDate && shortDay(course.endDate)].filter(Boolean).join(" – ")
  const source = course.kind === "reading" ? "Author" : course.kind === "certification" ? "Vendor" : "Source"
  type Chip = { key: string; kind: ChipKind; label?: string; value: string }
  const list: (Chip | undefined)[] = [
    course.instructor ? { key: "source", kind: "neutral", label: source, value: course.instructor } : undefined,
    course.term ? { key: "term", kind: "neutral", label: "Term", value: course.term } : undefined,
    when ? { key: "when", kind: "date", label: course.kind === "certification" ? "Exam" : "When", value: when } : undefined,
    course.schedule ? { key: "schedule", kind: "neutral", label: "Schedule", value: course.schedule } : undefined,
    course.location ? { key: "location", kind: "neutral", label: "Where", value: course.location } : undefined,
    ...(course.tags ?? []).map((tag): { key: string; kind: ChipKind; label: string; value: string } => ({ key: `tag-${tag}`, kind: "tag", label: "Tag", value: tag })),
    { key: "open", kind: "status", label: "Open", value: String(open) },
    noteCount ? { key: "notes", kind: "neutral", label: "Notes", value: String(noteCount) } : undefined,
    course.links?.length ? { key: "links", kind: "neutral", label: "Links", value: String(course.links.length) } : undefined,
  ]
  const chips = list.filter((x): x is Chip => !!x)
  return <View style={selectedItem.preview}>{course.description ? <Text style={s.peekText} numberOfLines={2} ellipsizeMode="tail">{previewText(course.description)}</Text> : null}<View style={s.chipRow}>{chips.map(chip => <PropChip key={chip.key} kind={chip.kind} label={chip.label} value={chip.value} />)}</View><Pressable onPress={onOpen} style={s.openPill} accessibilityRole="button" accessibilityLabel={`Open ${course.title}`}><Icon name="open-outline" size={12} tint="#fff" /><Text style={s.openPillText}>Open</Text></Pressable></View>
}

export function Today({ courses, tasks, data, today, onTask, onCourse, onAddTask, onAddSession, onPlan, onStart, onToggle, onReflect, onEditReflection, onStudy }: { onStudy: (taskId: string) => void; courses: Course[]; tasks: Task[]; data: Collections; today: string; onTask: (id: string) => void; onCourse: (id: string) => void; onAddTask: () => void; onAddSession: () => void; onPlan: () => void; onStart: (task: Task) => void; onToggle: (task: Task) => void; onReflect: (task: Task) => void; onEditReflection: (entry: LearningReflection) => void }) {
  const day = learningToday(courses, tasks, today)
  const plan = todayPlan({ tasks: data.tasks, courses: data.courses }, today)
  const nowDate = new Date(), nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
  const [prefs] = useCalendarPrefs()
  const [selected, setSelected] = useState<string | null>(null)
  const sections = [{ title: "Today's schedule", icon: "calendar-outline" as const, tint: kit.hue.learning, rows: day.schedule }, { title: "Overdue", icon: "alert-circle-outline" as const, tint: chipTone.overdue.ink, rows: day.overdue }, { title: "Due today", icon: "flag-outline" as const, tint: chipTone.date.ink, rows: day.due }]
  return <><View style={s.sectionHead}><Text style={s.sectionTitle} accessibilityRole="header">Today · {shortDay(today)}</Text><View style={s.headActions}><SmallButton label="Plan week" onPress={onPlan} /><SmallButton label="+ Task" onPress={onAddTask} /><SmallButton label="+ Session" onPress={onAddSession} /></View></View>
    {plan.next ? <StartHere next={plan.next} courses={data.courses} onStart={onStart} /> : null}
    <ClassesToday classes={plan.classes} now={nowMinutes} />
    <StepsToday steps={plan.steps} courses={data.courses} today={today} onOpen={onTask} />
    {sections.map(section => <WorkspaceSection key={section.title} title={section.title} icon={section.icon} tint={section.tint} count={String(section.rows.length)} collapsible flush>{section.rows.map(task => {
      const course = courses.find(course => course.id === task.courseId)!
      const event = task.kind === "event" || task.learningType === "event"
      const schedule = section.title === "Today's schedule"
      const key = `${section.title}/${task.id}`
      return <View key={task.id} style={[selectedItem.item, selected === key && selectedItem.itemOn]}><View style={s.workRow}>{event ? <View style={s.leadIcon}><Icon name="calendar-outline" tint={kindInfo(course).tint} size={20} /></View> : <TaskCheck checked={false} onPress={() => onToggle(task)} label={`Complete ${task.title}`} />}<Pressable accessibilityRole="button" accessibilityLabel={`Preview ${task.title}`} onPress={() => setSelected(id => id === key ? null : key)} style={s.flex}><Text style={s.rowTitle} numberOfLines={2}>{task.title}</Text><View style={s.chipRow}>
        {schedule ? <PropChip kind="date" label="Time" value={task.scheduledTime ? formatTime(task.scheduledTime, prefs.timeFormat) : "All day"} /> : task.due ? <PropChip kind={task.due < today ? "overdue" : "date"} label="Due" value={shortDay(task.due)} /> : null}
        <PropChip kind="tag" value={event ? "SESSION" : schedule ? "PLANNED" : typeLabel(task.learningType ?? "", course.kind)} />
        <PropChip kind="course" label="Course" value={course.title} />
      </View></Pressable></View>{selected === key ? <><TaskPeek task={task} course={course.title} onOpen={() => onTask(task.id)} /><TaskReflectionLinks data={data} task={task} course={course} onReflect={() => onReflect(task)} onEdit={onEditReflection} /></> : null}</View>
    })}{section.rows.length === 0 ? <Text style={s.emptyHint}>{section.title === "Today's schedule" ? "Plan a dated session or schedule a learning task to see it here." : section.title === "Overdue" ? "Nothing overdue." : "Nothing due today."}</Text> : null}</WorkspaceSection>)}
    <StudyNudges exams={plan.studyNudges} courses={data.courses} today={today} onPlan={onStudy} />
    {day.exams.length ? <WorkspaceSection title="Exams today" icon="ribbon-outline" tint={chipTone.date.ink} count={String(day.exams.length)} flush>{day.exams.map(course => <View key={course.id} style={[selectedItem.item, selected === `exam/${course.id}` && selectedItem.itemOn]}><Pressable style={s.recordRow} accessibilityRole="button" accessibilityLabel={`Preview ${course.title} exam date`} onPress={() => setSelected(id => id === `exam/${course.id}` ? null : `exam/${course.id}`)}><Icon name="ribbon-outline" tint={kindInfo(course).tint} /><Text style={[s.rowTitle, s.flex]}>{course.title}</Text><PropChip kind="date" value="EXAM TODAY" /></Pressable>{selected === `exam/${course.id}` ? <CoursePeek course={course} tasks={tasks} onOpen={() => onCourse(course.id)} /> : null}</View>)}</WorkspaceSection> : null}
  </>
}

export function Upcoming({ courses, tasks, data, today, onTask, onCourse, onReflect, onEditReflection }: { courses: Course[]; tasks: Task[]; data: Collections; today: string; onTask: (id: string) => void; onCourse: (id: string) => void; onReflect: (task: Task) => void; onEditReflection: (entry: LearningReflection) => void }) {
  const [prefs] = useCalendarPrefs()
  const [selected, setSelected] = useState<string | null>(null)
  const rows = upcomingLearning(courses, tasks, today)
  const groups = { Overdue: { icon: "alert-circle-outline" as const, tint: chipTone.overdue.ink }, "Next 7 days": { icon: "calendar-outline" as const, tint: chipTone.date.ink }, Later: { icon: "time-outline" as const, tint: kit.hue.learning } }
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Upcoming</Text><Text style={s.meta}>{rows.length} dated items</Text></View>{(["Overdue", "Next 7 days", "Later"] as const).map(group => { const part = rows.filter(x => dueGroup(x.due, today) === group); return part.length ? <WorkspaceSection key={group} title={group} icon={groups[group].icon} tint={groups[group].tint} count={String(part.length)} collapsible flush>{part.map(x => {
    const course = courses.find(y => y.id === x.courseId)
    const what = x.occasion ? (x.occasion === "planned" ? "PLANNED" : "SESSION") : x.task ? typeLabel(x.task.learningType ?? "", course?.kind) : "EXAM DATE"
    return <View key={x.id} style={[selectedItem.item, selected === x.id && selectedItem.itemOn]}><Pressable onPress={() => setSelected(id => id === x.id ? null : x.id)} style={({ pressed }) => [s.upcomingRow, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Preview ${x.title}`}><UpcomingDate due={x.due} /><View style={s.flex}><Text style={s.rowTitle} numberOfLines={2}>{x.title}</Text><View style={s.chipRow}><PropChip kind="tag" value={what} />{x.occasion ? <PropChip kind="date" label="Time" value={x.time ? formatTime(x.time, prefs.timeFormat) : "All day"} /> : null}{course ? <PropChip kind="course" label="Course" value={course.title} /> : null}</View></View><Icon name={selected === x.id ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} /></Pressable>{selected === x.id ? x.task ? <><TaskPeek task={x.task} course={course?.title} onOpen={() => onTask(x.task!.id)} />{course ? <TaskReflectionLinks data={data} task={x.task} course={course} onReflect={() => onReflect(x.task!)} onEdit={onEditReflection} /> : null}</> : course ? <CoursePeek course={course} tasks={tasks} onOpen={() => onCourse(course.id)} /> : null : null}</View>
  })}</WorkspaceSection> : null })}{rows.length === 0 ? <Text style={s.emptyHint}>No dated learning work yet. Add a deadline or schedule a session.</Text> : null}</>
}

function UpcomingDate({ due }: { due: string }) {
  const parts = dateParts(due)
  return <View style={s.dateBox} accessible accessibilityLabel={`${parts.month} ${parts.day}`}><Text style={s.dateMonth}>{parts.month}</Text><Text style={s.dateText}>{parts.day}</Text></View>
}

export function Work({ course, tasks, data, tab, onTab, onAdd, onAddToModule, onOpen, onToggle, onStatus, onReflect, onEditReflection }: { course: Course; tasks: Task[]; data: Collections; tab: WorkTab; onTab: (tab: WorkTab) => void; onAdd: () => void; onAddToModule: (topicId: string) => void; onOpen: (id: string) => void; onToggle: (task: Task) => void; onStatus: (task: Task, status: WorkStatus) => void; onReflect: (id: string) => void; onEditReflection: (entry: LearningReflection) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)
  const shown = tasks.filter(t => tab === "all" || (tab === "done") === t.done).sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
  const today = todayKey()
  const modules = course.topics ?? []
  const [by, setBy] = useState<"module" | "date">(modules.length ? "module" : "date")
  const byModule = by === "module" && modules.length > 0
  const modulesFor = (t: Task) => modules.filter(m => t.topicIds?.includes(m.id))
  const placed = new Set<string>()
  const groups = [...modules.map(m => { const mine = shown.filter(t => t.topicIds?.includes(m.id) && !placed.has(t.id)); mine.forEach(t => placed.add(t.id)); const all = tasks.filter(t => t.topicIds?.includes(m.id)); return { key: m.id, label: m.title, note: all.length ? `${all.filter(t => t.done).length} of ${all.length} done` : "no work yet", items: mine } }), { key: "none", label: "No module", note: undefined as string | undefined, items: shown.filter(t => !placed.has(t.id)) }].filter(g => g.items.length || g.key !== "none")
  const rowFor = (t: Task) => (<View key={t.id} style={[selectedItem.item, selected === t.id && selectedItem.itemOn]}><View style={s.workRow}>{t.kind === "event" || t.learningType === "event" ? <View style={s.leadIcon}><Icon name="calendar-outline" size={18} tint={c.accent} /></View> : <TaskCheck checked={t.done} onPress={() => onToggle(t)} label={`${t.done ? "Reopen" : "Complete"} ${t.title}`} />}<Pressable onPress={() => setSelected(id => id === t.id ? null : t.id)} style={s.flex} accessibilityRole="button" accessibilityLabel={`Preview ${t.title}`}><Text style={[s.rowTitle, t.done && s.done]} numberOfLines={2}>{t.title}</Text><View style={s.chipRow}><PropChip kind="tag" value={typeLabel(t.learningType ?? "", course.kind)} />{t.due ? <PropChip kind={!t.done && t.due < today ? "overdue" : "date"} label="Due" value={shortDay(t.due)} /> : null}{t.workType ? <PropChip kind="neutral" value={t.workType.toUpperCase()} /> : null}{!byModule && modulesFor(t).length ? <PropChip kind="tag" label="Module" value={modulesFor(t)[0].title + (modulesFor(t).length > 1 ? ` +${modulesFor(t).length - 1}` : "")} /> : null}{t.score != null ? <PropChip kind="status" label="Score" value={`${t.score}%`} /> : null}{t.subtasks?.length ? <PropChip kind="neutral" label="Steps" value={`${stepProgress(t).done}/${stepProgress(t).total}`} /> : null}{tracked(t, course) && statusOf(t) !== "not_started" ? <PropChip kind="status" value={statusLabel(statusOf(t)).toUpperCase()} /> : null}</View></Pressable><Pressable onPress={() => setSelected(id => id === t.id ? null : t.id)} style={s.iconTouch} accessibilityRole="button" accessibilityLabel={`Preview ${t.title}`}><Icon name={selected === t.id ? "chevron-up" : "chevron-down"} size={17} tint={c.muted} /></Pressable></View>{selected === t.id ? <><TaskPeek task={t} course={course.title} onOpen={() => onOpen(t.id)} />{tracked(t, course) ? <View style={s.statusControl}><Pressable onPress={() => setStatusOpen(id => id === t.id ? null : t.id)} style={s.statusChip} accessibilityRole="button" accessibilityLabel={`Change status: ${statusLabel(statusOf(t))}`} accessibilityState={{ expanded: statusOpen === t.id }}><Text style={s.statusChipText}>{statusLabel(statusOf(t))}</Text><Icon name={statusOpen === t.id ? "chevron-up" : "chevron-down"} size={13} tint={c.accent} /></Pressable>{statusOpen === t.id ? <StatusPills task={t} onStatus={status => { onStatus(t, status); setStatusOpen(null) }} /> : null}</View> : null}{course.topics?.length && t.kind !== "event" && t.learningType !== "event" ? <ModulePills course={course} task={t} /> : null}<TaskReflectionLinks data={data} task={t} course={course} onReflect={() => onReflect(t.id)} onEdit={onEditReflection} /></> : null}</View>)
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Work</Text><SmallButton label="+ Add" onPress={onAdd} /></View>{modules.length ? <View style={s.smallTabs}><Pill label="By module" selected={byModule} onPress={() => setBy("module")} /><Pill label="By date" selected={!byModule} onPress={() => setBy("date")} /></View> : null}<View style={s.smallTabs}>{(["open", "done", "all"] as const).map(x => <Pill key={x} label={`${x[0].toUpperCase() + x.slice(1)} ${tasks.filter(t => x === "all" || (x === "done") === t.done).length}`} selected={tab === x} onPress={() => { setSelected(null); onTab(x) }} />)}</View>
    <WorkspaceSection compact title={tab === "open" ? "Open work" : tab === "done" ? "Finished work" : "All work"} icon="checkbox-outline" tint={kindInfo(course).tint} count={String(shown.length)} flush>
      {byModule ? groups.map(g => <View key={g.key}><View style={s.moduleHead}><Text style={s.groupLabel} numberOfLines={1}>{g.label}</Text><Text style={s.moduleCount}>{g.note}</Text>{g.key !== "none" ? <Pressable onPress={() => onAddToModule(g.key)} style={s.moduleAdd} accessibilityRole="button" accessibilityLabel={`Add work to ${g.label}`}><Icon name="add" size={16} tint={kindInfo(course).tint} /></Pressable> : null}</View>{g.items.map(t => rowFor(t))}</View>) : shown.map(t => rowFor(t))}
      {!shown.length && !byModule ? <Text style={s.emptyHint}>{tab === "done" ? "Completed work will appear here." : "No work here yet. Add a step when you’re ready."}</Text> : null}
    </WorkspaceSection></>
}

/** Classes track assignments, exams and milestones through not started, in progress, submitted and graded. */
const tracked = (t: Task, course: Course) => (course.kind ?? "course") === "course" && t.kind !== "event" && t.learningType !== "event"

function TaskReflectionLinks({ data, task, course, onReflect, onEdit }: { data: Collections; task: Task; course: Course; onReflect: () => void; onEdit: (entry: LearningReflection) => void }) {
  const count = learningReflections(data, course.id, task.id).length
  return <View><View style={s.reflectionRow}><Text style={s.meta}>{count} linked {count === 1 ? "reflection" : "reflections"}</Text><SmallButton label="+ Reflect" onPress={onReflect} /></View>{count ? <ReflectionList data={data} courseId={course.id} taskId={task.id} onEdit={onEdit} /> : null}</View>
}

export function LinkedNotes({ notes, onAdd, onOpen }: { notes: Note[]; onAdd: () => void; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return <><View style={s.sectionHead}><Text style={s.sectionTitle}>Linked notes</Text><SmallButton label="+ Note" onPress={onAdd} /></View><WorkspaceSection title="Notes" icon="document-text-outline" tint={c.blue} count={String(notes.length)} flush>{notes.map(n => <View key={n.id} style={[selectedItem.item, selected === n.id && selectedItem.itemOn]}><Pressable onPress={() => setSelected(id => id === n.id ? null : n.id)} style={s.recordRow} accessibilityRole="button" accessibilityLabel={`Preview note ${n.text.trim().split("\n")[0] || "Untitled"}`}><Icon name="document-text-outline" size={17} tint={c.accent} /><Text style={[s.rowTitle, s.flex]} numberOfLines={2}>{n.text.trim().split("\n")[0] || "Untitled note"}</Text><Icon name={selected === n.id ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} /></Pressable>{selected === n.id ? <View style={selectedItem.preview}><Text style={s.peekText} numberOfLines={2} ellipsizeMode="tail">{previewText(n.text)}</Text><Pressable onPress={() => onOpen(n.id)} style={s.openPill} accessibilityRole="button" accessibilityLabel="Open note"><Icon name="open-outline" size={12} tint="#fff" /><Text style={s.openPillText}>Open</Text></Pressable></View> : null}</View>)}{!notes.length ? <Text style={s.emptyHint}>Notes linked to this item will appear here.</Text> : null}</WorkspaceSection></>
}

export function Overview({ course, tasks, data, blocked, mutate, onError }: { data: Collections; course: Course; tasks: Task[]; blocked: boolean; mutate: ReturnType<typeof useWorkspace>["mutate"]; onError: (text: string) => void }) {
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
  const openCount = tasks.filter(t => !t.done).length
  return <>
    <WorkspaceSection title="Overview" icon="information-circle-outline" tint={kindInfo(course).tint} count={openCount ? `${openCount} open` : undefined}>
      <View style={s.overview}>
        {course.description ? <Text style={s.body}>{course.description}</Text> : null}
        {course.kind === "reading" ? <View style={s.pages}><Text style={s.meta}>Pages read</Text><TextInput value={pages} onChangeText={setPages} keyboardType="number-pad" style={s.pageInput} accessibilityLabel="Pages read" placeholder="0" placeholderTextColor={c.muted} /><Text style={s.meta}>/ {course.pagesTotal ?? "?"}</Text><SmallButton label={saving ? "Saving…" : "Update"} onPress={() => void savePages()} /></View> : null}
        {facts.length ? <View style={s.chipRow}>{facts.map(([label, value]) => <PropChip key={label} kind={label === "When" ? "date" : "neutral"} label={label} value={String(value)} />)}</View> : null}
        {course.kind === "certification" && course.endDate ? <Text style={s.meta}>Exam date is scheduled; passing status is not recorded here.</Text> : null}
        {!course.description && !facts.length && !course.url && !course.links?.length && course.kind !== "reading" ? <Text style={s.emptyHint}>Add a description, dates, or resources from Edit.</Text> : null}
      </View>
    </WorkspaceSection>
    <TopicsList course={course} data={data} blocked={blocked} onError={onError} />
    {course.url || course.links?.length ? <WorkspaceSection title="Resources" icon="link-outline" tint={c.accent} count={String((course.url ? 1 : 0) + (course.links?.length ?? 0))} flush>{course.url ? <Resource label="Main link" url={course.url} /> : null}{course.links?.map((link, i) => <Resource key={`${link.url}-${i}`} label={link.label || link.url} url={link.url} />)}</WorkspaceSection> : null}
  </>
}
function Resource({ label, url }: { label: string; url: string }) {
  if (!isSafeLink(url)) return <View style={s.recordRow}><Icon name="link-outline" size={16} tint={c.muted} /><Text style={[s.meta, s.flex]} numberOfLines={1}>{label} · Check link in editor</Text></View>
  return <Pressable onPress={() => void Linking.openURL(url).catch(() => {})} style={s.recordRow} accessibilityRole="link" accessibilityLabel={`Open ${label}`}><Icon name="link-outline" size={16} tint={c.accent} /><Text style={[s.rowTitle, s.flex]} numberOfLines={1}>{label}</Text><Icon name="open-outline" size={15} tint={c.muted} /></Pressable>
}

const s = StyleSheet.create({
  reflectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 36, paddingRight: 10, paddingBottom: 6 },
  flex: { flex: 1, minWidth: 0 }, pressed: { opacity: 0.72 }, sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }, headActions: { flexDirection: "row", gap: 6 }, leadIcon: { width: 32, alignItems: "center" }, sectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  progress: { flexDirection: "row", alignItems: "center", gap: 9, padding: 7, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, progressText: { color: c.text2, fontSize: 11 }, track: { width: "100%", height: 3, borderRadius: 2, backgroundColor: c.raised, overflow: "hidden", marginTop: 3 }, bar: { height: 3, borderRadius: 2 },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 58, borderLeftWidth: 3, paddingVertical: 5, paddingHorizontal: 8 }, courseRowOn: { backgroundColor: c.selected }, kindMark: { width: 5, height: 30, borderRadius: 3 },
  libraryTitle: { color: c.text, fontSize: 13, fontWeight: "700" }, kindLabel: { alignSelf: "center", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }, kindText: { fontSize: 9, fontWeight: "700" },
  libraryProgress: { flexDirection: "row", alignItems: "center", gap: 6 }, libraryProgressLabel: { flex: 1, minWidth: 0, color: c.muted, fontSize: 10.5 }, libraryProgressBar: { width: 52 }, libraryPercent: { width: 31, textAlign: "right", fontFamily: mono, fontSize: 10, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginVertical: 3 }, noRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "#232426", alignItems: "center", justifyContent: "center" }, noRingText: { color: c.muted, fontSize: 12 },
  openPill: { alignSelf: "flex-start", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 15, backgroundColor: c.action, borderWidth: 1, borderColor: c.selectedBorder }, openPillText: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
  foot: { color: c.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 2 }, rowTitle: { color: c.text, fontSize: 14, lineHeight: 19, fontWeight: "600" }, next: { color: c.text2, fontSize: 11, lineHeight: 16 },
  peekText: { color: c.text2, fontSize: 12, lineHeight: 17 },
  group: { gap: 1 }, groupLabel: { flex: 1, color: c.text, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }, moduleHead: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 9, paddingRight: 4, backgroundColor: kit.courseGroup.header, borderTopWidth: 1, borderBottomWidth: 1, borderColor: kit.courseGroup.line }, moduleCount: { color: c.muted, fontSize: 10 }, moduleAdd: { width: 32, height: 30, alignItems: "center", justifyContent: "center" }, statusControl: { gap: 5, paddingHorizontal: 10, paddingBottom: 5 }, statusChip: { alignSelf: "flex-start", minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, borderRadius: 7, backgroundColor: chipTone.status.fill }, statusChipText: { color: chipTone.status.ink, fontSize: 11, fontWeight: "600" }, error: { color: "#ff8787" }, upcomingRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 48, paddingVertical: 4, paddingHorizontal: 8 }, dateBox: { width: 36, height: 36, borderRadius: 6, backgroundColor: "#3b3220", alignItems: "center", justifyContent: "center" }, dateMonth: { color: "#ffcc80", fontFamily: mono, fontSize: 8, fontWeight: "700", letterSpacing: 0.8 }, dateText: { color: "#ffcc80", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  smallTabs: { flexDirection: "row", gap: 6 }, workRow: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 40, paddingVertical: 2, paddingHorizontal: 6 }, done: { color: c.green, textDecorationLine: "line-through" }, iconTouch: { width: 32, minHeight: 34, alignItems: "center", justifyContent: "center" }, recordRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  overview: { gap: 10, paddingVertical: 8 }, body: { color: c.text2, fontSize: 13, lineHeight: 19 }, fact: { flexDirection: "row", gap: 9, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 6 }, factLabel: { width: 66, color: c.muted, fontSize: 12 }, factValue: { flex: 1, color: c.text2, fontSize: 12 }, pages: { flexDirection: "row", alignItems: "center", gap: 7 }, pageInput: { width: 55, minHeight: 30, borderRadius: 9, borderWidth: 1, borderColor: c.line, color: c.text, textAlign: "center", fontSize: 13, paddingVertical: 3 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28 }, emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" }, emptyHint: { color: c.muted, fontSize: 12, lineHeight: 18, padding: 10 },
})



