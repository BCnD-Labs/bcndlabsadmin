import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { shape } from "../../shape.ts"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { toggleTask, type Collections } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { SyncStatus } from "../data/SyncStatus.tsx"
import { todayKey } from "../data/sync-view.ts"
import { useReduceMotion } from "../nav/useReduceMotion.ts"
import { NAV_CLEARANCE, Icon } from "../ui.tsx"
import { CourseEditor } from "./learning/CourseEditor.tsx"
import { Pill, SmallButton } from "./learning/LearningControls.tsx"
import { KINDS, kindInfo, type Course, type Kind, type Task } from "./learning/learning-view.ts"
import { Library, Today, Upcoming, Overview, Work, LinkedNotes, Progress, type WorkTab } from "./learning/LearningViews.tsx"
import { LearningReflectionSheet, ReflectionList, type LearningReflection } from "./LearningReflections.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { typeOptions } from "./planner/learning-types.ts"
import { NoteSheet, type NoteEditor } from "./planner/notes/NoteSheet.tsx"

type CollectionTab = "today" | "library" | "upcoming"
type DetailTab = "overview" | "work" | "notes" | "reflections"

/** Native Learning uses the same workspace records as Planner, with a compact tabbed layout. */
export function LearningScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const reduceMotion = useReduceMotion()
  const [openId, setOpenId] = useState<string | null>(null)
  const [collection, setCollection] = useState<CollectionTab>("today")
  const [detail, setDetail] = useState<DetailTab>("work")
  const [workTab, setWorkTab] = useState<WorkTab>("open")
  const [kind, setKind] = useState<Kind | "all">("all")
  const [search, setSearch] = useState("")
  const [menu, setMenu] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [courseEditor, setCourseEditor] = useState<Course | "new" | null>(null)
  const [taskEditor, setTaskEditor] = useState<Editor | null>(null)
  const [coursePicker, setCoursePicker] = useState<"task" | "session" | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [reflectionEditor, setReflectionEditor] = useState<{ courseId: string; taskId?: string; entry?: LearningReflection } | null>(null)
  const course = data?.courses.find(x => x.id === openId)
  const blocked = status === "conflict"
  const today = todayKey()
  const shown = data?.courses.filter(x => (kind === "all" || (x.kind ?? "course") === kind) && [x.title, x.code, x.instructor, ...x.tags].join(" ").toLowerCase().includes(search.trim().toLowerCase())) ?? []

  function edit(action: () => void) {
    if (blocked) setNotice("Resolve the sync conflict before editing.")
    else if (!data) setNotice("Load your workspace first.")
    else { setNotice(undefined); setMenu(false); action() }
  }
  function openCourse(x: Course) {
    setOpenId(x.id)
    setDetail(x.kind === "reading" ? "overview" : "work")
    setWorkTab("open")
    setMenu(false)
  }
  async function complete(task: Task) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleTask(d, task.id))) setNotice(message ?? "Could not save this task.")
  }
  function chooseCourse(selected: Course) {
    setTaskEditor({ mode: "create", courseId: selected.id, learningType: coursePicker === "session" ? "event" : typeOptions(selected.kind)[0].value, ...(coursePicker === "session" && { kind: "event" as const, due: today }) })
    setCoursePicker(null)
  }
  const tabs = course ? ["overview", "work", "notes", "reflections"] as const : ["today", "upcoming", "library"] as const
  return <KeyboardFrame style={s.fill}>
    <View style={s.header}>
      <View style={s.top}><Text style={s.breadcrumb}>Blackwall <Text style={s.muted}>/ Learning</Text></Text><View style={s.topRight}><SyncStatus onOpenSettings={onOpenSettings} /><Pressable onPress={() => setMenu(v => !v)} style={s.add} accessibilityRole="button" accessibilityLabel={course ? `Add to ${course.title}` : "Add learning item"} accessibilityState={{ expanded: menu }}><Icon name="add" size={20} tint={c.accent} /></Pressable></View></View>
      <View style={s.tabs} accessibilityRole="tablist">{tabs.map(tab => <Pill key={tab} label={tab[0].toUpperCase() + tab.slice(1)} selected={course ? detail === tab : collection === tab} tab onPress={() => { if (course) setDetail(tab as DetailTab); else setCollection(tab as CollectionTab); setMenu(false) }} />)}</View>
      {menu ? <View style={s.menu}><Text style={s.menuLabel}>{course ? `ADD TO ${kindInfo(course).label.toUpperCase()}` : "CREATE"}</Text>{course ? <>{typeOptions(course.kind).map(x => <MenuItem key={x.value} label={x.label} icon={x.value === "event" ? "calendar-outline" : x.value === "exam" ? "ribbon-outline" : "checkbox-outline"} onPress={() => edit(() => { setTaskEditor({ mode: "create", courseId: course.id, learningType: x.value, ...(x.value === "event" && { kind: "event" as const }) }); setDetail("work") })} />)}<MenuItem label="Note" icon="document-text-outline" onPress={() => edit(() => { setNoteEditor({ mode: "create", courseId: course.id }); setDetail("notes") })} /><View style={s.rule} /><MenuItem label="Edit learning item" icon="create-outline" onPress={() => edit(() => setCourseEditor(course))} /></> : <MenuItem label="Learning item" icon="school-outline" onPress={() => edit(() => setCourseEditor("new"))} />}</View> : null}
    </View>
    {menu ? <Pressable style={s.dismiss} onPress={() => setMenu(false)} accessibilityRole="button" accessibilityLabel="Close add menu" /> : null}
    <KeyboardScrollView style={s.fill} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} colors={[c.accent]} />}>
      {!data ? <View style={s.empty}><Text style={s.emptyTitle}>{status === "signed-out" ? "Sign in to use Learning" : "Loading your workspace"}</Text><Text style={s.meta}>{message ?? "Your learning records live in your workspace."}</Text>{status === "signed-out" ? <SmallButton label="Sign in" onPress={onOpenSettings} /> : null}</View> : null}
      {data && status !== "ok" && message ? <Text style={s.notice}>{message}</Text> : null}{notice ? <Text style={s.error}>{notice}</Text> : null}
      {data && course ? <MotionPane motionKey={`${course.id}-${detail}`} reduce={reduceMotion}>
        <Pressable onPress={() => { setOpenId(null); setMenu(false) }} style={s.back} accessibilityRole="button" accessibilityLabel="Back to Learning"><Icon name="chevron-back" size={17} tint={c.accent} /><Text style={s.accent}>Library</Text></Pressable>
        <View style={s.identity}><View style={[s.kindMark, { backgroundColor: kindInfo(course).tint }]} /><View style={s.flex}><Text style={s.identityTitle}>{course.title}</Text><Text style={s.meta}>{[kindInfo(course).label, course.code, course.term].filter(Boolean).join(" · ")}</Text></View><Pressable onPress={() => edit(() => setCourseEditor(course))} style={s.edit} accessibilityRole="button" accessibilityLabel={`Edit ${course.title}`}><Icon name="create-outline" size={19} tint={c.muted} /></Pressable></View>
        <Progress course={course} tasks={data.tasks.filter(t => t.courseId === course.id)} />
        {detail === "overview" ? <Overview key={course.id} course={course} tasks={data.tasks.filter(t => t.courseId === course.id)} blocked={blocked} mutate={mutate} onError={setNotice} /> : null}
        {detail === "work" ? <Work course={course} tasks={data.tasks.filter(t => t.courseId === course.id)} data={data} tab={workTab} onTab={setWorkTab} onAdd={() => setMenu(true)} onOpen={id => setTaskEditor({ mode: "edit", id })} onToggle={complete} onReflect={taskId => edit(() => setReflectionEditor({ courseId: course.id, taskId }))} onEditReflection={entry => edit(() => setReflectionEditor({ courseId: course.id, entry }))} /> : null}
        {detail === "reflections" ? <><View style={s.reflectionHead}><Text style={s.reflectionTitle}>Learning reflections</Text><SmallButton label="+ Reflect" onPress={() => edit(() => setReflectionEditor({ courseId: course.id }))} /></View><ReflectionList data={data} courseId={course.id} onEdit={entry => edit(() => setReflectionEditor({ courseId: course.id, entry }))} /></> : null}
        {detail === "notes" ? <LinkedNotes notes={data.notes.filter(n => n.courseId === course.id)} onAdd={() => edit(() => setNoteEditor({ mode: "create", courseId: course.id }))} onOpen={id => setNoteEditor({ mode: "edit", id })} /> : null}
      </MotionPane> : data ? <MotionPane motionKey={collection} reduce={reduceMotion}>
        <View style={s.search}><Icon name="search-outline" size={16} tint={c.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Find learning…" placeholderTextColor={c.muted} style={s.searchInput} accessibilityLabel="Find learning" returnKeyType="search" />{search ? <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search"><Icon name="close-circle" size={17} tint={c.muted} /></Pressable> : null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}><Pill label="All" selected={kind === "all"} onPress={() => setKind("all")} />{KINDS.map(k => <Pill key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />)}</ScrollView>
        {collection === "today" ? <Today courses={shown} tasks={data.tasks} data={data} today={today} onTask={id => setTaskEditor({ mode: "edit", id })} onCourse={id => { const course = data.courses.find(course => course.id === id); if (course) openCourse(course) }} onAddTask={() => edit(() => setCoursePicker("task"))} onAddSession={() => edit(() => setCoursePicker("session"))} onToggle={complete} onReflect={task => edit(() => setReflectionEditor({ courseId: task.courseId!, taskId: task.id }))} onEditReflection={entry => edit(() => setReflectionEditor({ courseId: entry.item.courseId ?? "", entry }))} /> : collection === "library" ? <Library courses={shown} tasks={data.tasks} notes={data.notes} total={data.courses.length} onOpen={openCourse} onAdd={() => edit(() => setCourseEditor("new"))} /> : <Upcoming courses={shown} tasks={data.tasks} data={data} today={today} onTask={id => setTaskEditor({ mode: "edit", id })} onCourse={id => { const found = data.courses.find(x => x.id === id); if (found) openCourse(found) }} onReflect={task => edit(() => setReflectionEditor({ courseId: task.courseId!, taskId: task.id }))} onEditReflection={entry => edit(() => setReflectionEditor({ courseId: entry.item.courseId ?? "", entry }))} />}
      </MotionPane> : null}
    </KeyboardScrollView>
    {data && reflectionEditor ? <LearningReflectionSheet key={reflectionEditor.entry?.item.id ?? `${reflectionEditor.courseId}/${reflectionEditor.taskId ?? "course"}`} data={data} initialCourseId={reflectionEditor.courseId} initialTaskId={reflectionEditor.taskId} entry={reflectionEditor.entry} onClose={() => setReflectionEditor(null)} /> : null}
    {data && courseEditor ? <CourseEditor key={courseEditor === "new" ? "new" : courseEditor.id} value={courseEditor} onClose={() => setCourseEditor(null)} /> : null}
    {data && taskEditor ? <TaskSheet key={taskEditor.mode === "edit" ? taskEditor.id : `new-${taskEditor.courseId}-${taskEditor.learningType}`} editor={taskEditor} data={data} today={today} onClose={() => setTaskEditor(null)} /> : null}
    {data && noteEditor ? <NoteSheet key={noteEditor.mode === "edit" ? noteEditor.id : `new-${noteEditor.courseId}`} editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} compact /> : null}
    <Modal visible={!!coursePicker} transparent animationType="fade" onRequestClose={() => setCoursePicker(null)}><View style={s.pickerBackdrop}><View style={s.picker}><View style={s.pickerHead}><Text style={s.identityTitle}>Choose what you're learning</Text><Pressable onPress={() => setCoursePicker(null)} accessibilityRole="button" accessibilityLabel="Close course picker"><Icon name="close" tint={c.muted} /></Pressable></View><ScrollView style={s.pickerScroll} keyboardShouldPersistTaps="handled">{data?.courses.map(item => <Pressable key={item.id} onPress={() => chooseCourse(item)} style={s.pickerRow} accessibilityRole="button" accessibilityLabel={`Add ${coursePicker} to ${item.title}`}><View style={[s.kindMark, { backgroundColor: kindInfo(item).tint }]} /><Text style={[s.menuText, s.flex]}>{item.title}</Text><Icon name="chevron-forward" size={16} tint={c.muted} /></Pressable>)}{!data?.courses.length ? <Text style={s.meta}>Add a learning item first, then give it work or sessions.</Text> : null}</ScrollView>{!data?.courses.length ? <SmallButton label="+ Learning item" onPress={() => { setCoursePicker(null); setCourseEditor("new") }} /> : null}</View></View></Modal>
  </KeyboardFrame>
}

function MotionPane({ motionKey, reduce, children }: { motionKey: string; reduce: boolean; children: ReactNode }) {
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => { if (reduce) { fade.setValue(1); return }; fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [motionKey, reduce, fade])
  return <Animated.View style={[s.pane, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>{children}</Animated.View>
}
function MenuItem({ label, icon, onPress }: { label: string; icon: "calendar-outline" | "ribbon-outline" | "checkbox-outline" | "document-text-outline" | "create-outline" | "school-outline"; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.menuItem, pressed && s.pressed]} accessibilityRole="button"><Icon name={icon} size={17} tint={c.accent} /><Text style={s.menuText}>{label}</Text></Pressable>
}
const s = StyleSheet.create({
  reflectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, reflectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  fill: { flex: 1, backgroundColor: c.ground }, flex: { flex: 1, minWidth: 0 }, pane: { gap: 10 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE, gap: 10 },
  header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 8, zIndex: 4 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, topRight: { flexDirection: "row", alignItems: "center", gap: 7 }, breadcrumb: { color: c.text, fontSize: 13, fontWeight: "600" }, muted: { color: c.muted, fontWeight: "400" }, add: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.panel, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line },
  dismiss: { ...StyleSheet.absoluteFill, zIndex: 3 },
  tabs: { flexDirection: "row", gap: 5 }, pressed: { opacity: 0.72 },
  menu: { position: "absolute", right: 14, top: 42, width: 206, padding: 6, borderRadius: shape.menu, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border, elevation: 8, zIndex: 8 }, menuLabel: { color: c.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, paddingHorizontal: 9, paddingVertical: 6 }, menuItem: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 9, borderRadius: 9 }, menuText: { color: c.text, fontSize: 13 }, rule: { height: 1, backgroundColor: c.line, marginVertical: 4 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, borderRadius: 20, backgroundColor: c.panel, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line }, searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 5 }, filters: { gap: 6, paddingVertical: 1 },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 28, gap: 2 }, accent: { color: c.accent, fontSize: 12 }, identity: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 2 }, identityTitle: { color: c.text, fontSize: 18, fontWeight: "700" }, kindMark: { width: 5, height: 30, borderRadius: 3 }, edit: { width: 32, minHeight: 34, alignItems: "center", justifyContent: "center" }, meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28 }, emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" }, notice: { color: c.amber, fontSize: 12 }, error: { color: "#ff8787", fontSize: 12 },
  pickerBackdrop: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.55)" }, picker: { maxHeight: "75%", padding: 14, borderRadius: 16, backgroundColor: c.raised, gap: 10 }, pickerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, pickerScroll: { flexGrow: 0 }, pickerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: c.line },
})


