import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { toggleTask, type Collections } from "../../lib/shared.ts"
import { color } from "../../theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { Button, Card, Checkbox, Chip, ChipRow, Empty, Icon, ListRow, ProgressBar, Screen } from "../ui.tsx"
import { CourseEditor } from "./learning/CourseEditor.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { formatDay } from "./planner/dates.ts"
import { NoteSheet, type NoteEditor } from "./planner/notes/NoteSheet.tsx"

type Course = Collections["courses"][number]
type Kind = NonNullable<Course["kind"]>
const kinds: { value: Kind; label: string }[] = [
  { value: "course", label: "Course" }, { value: "certification", label: "Certification" },
  { value: "selfpaced", label: "Self-paced" }, { value: "skill", label: "Skill" }, { value: "reading", label: "Reading" },
]
const kindLabel = (kind: Course["kind"]) => kinds.find(k => k.value === (kind ?? "course"))?.label ?? "Course"

/** Existing workspace records and editing; the richer Learning layout remains a separate preview. */
export function LearningScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(null)
  const [courseEditor, setCourseEditor] = useState<Course | "new" | null>(null)
  const [taskEditor, setTaskEditor] = useState<Editor | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [filter, setFilter] = useState<Kind | "all">("all")
  const [notice, setNotice] = useState<string>()
  const blocked = status === "conflict"
  const course = data?.courses.find(c => c.id === openId)
  async function complete(id: string) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleTask(d, id))) setNotice(message ?? "Could not save this task.")
  }
  const right = <Pressable onPress={() => data && !blocked ? setCourseEditor("new") : setNotice(blocked ? "Resolve the sync conflict before editing." : "Load your workspace first.")} accessibilityRole="button" accessibilityLabel="Add learning item" style={styles.iconButton}><Icon name="add" tint={color.text} /></Pressable>
  return <Screen title={course?.title ?? "Learning"} subtitle={course ? kindLabel(course.kind) : data ? `${data.courses.length} learning items` : undefined} right={right} onRefresh={() => void refresh()} refreshing={refreshing}>
    {!data ? <Card title={status === "signed-out" ? "Sign in to use Learning" : "Loading your workspace"}><Text style={styles.meta}>{status === "signed-out" ? "Your learning records live in your workspace." : message ?? "Pull down to try again."}</Text>{status === "signed-out" ? <Button label="Sign in" onPress={onOpenSettings} /> : null}</Card> : null}
    {data && status !== "ok" && message ? <Text style={styles.meta}>{message}</Text> : null}
    {notice ? <Text style={styles.error}>{notice}</Text> : null}
    {data && course ? <>
      <Pressable onPress={() => setOpenId(null)} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to Learning"><Icon name="chevron-back" size={19} /><Text style={styles.meta}>All learning</Text></Pressable>
      <Card title="Overview" right={<Button label="Edit" onPress={() => setCourseEditor(course)} />}>
        {course.code || course.term ? <Text style={styles.meta}>{[course.code, course.term].filter(Boolean).join(" · ")}</Text> : null}
        {course.instructor ? <Text style={styles.meta}>{course.instructor}</Text> : null}
        {course.description ? <Text style={styles.body}>{course.description}</Text> : null}
        {course.kind === "reading" && course.pagesTotal ? <Text style={styles.meta}>{`${course.pagesRead ?? 0} / ${course.pagesTotal} pages`}</Text> : null}
        {course.url ? <Pressable onPress={() => void Linking.openURL(course.url)} accessibilityRole="link"><Text style={styles.link}>Open source ↗</Text></Pressable> : null}
      </Card>
      <Card title="Work" right={<Button label="+ Task" onPress={() => blocked ? setNotice("Resolve the sync conflict before editing.") : setTaskEditor({ mode: "create", courseId: course.id })} />}>
        {data.tasks.filter(t => t.courseId === course.id).length === 0 ? <Empty>No tasks yet. Add one to plan the next step.</Empty> : null}
        {data.tasks.filter(t => t.courseId === course.id).sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999")).map(t => <ListRow key={t.id} title={t.title} subtitle={[t.learningType, t.due ? `Due ${formatDay(t.due)}` : "", t.score != null ? `Score ${t.score}%` : ""].filter(Boolean).join(" · ") || undefined} done={t.done} left={<Checkbox checked={t.done} onPress={() => void complete(t.id)} label={`${t.done ? "Reopen" : "Complete"} ${t.title}`} />} onPress={() => setTaskEditor({ mode: "edit", id: t.id })} />)}
      </Card>
      <Card title="Linked notes" right={<Button label="+ Note" onPress={() => blocked ? setNotice("Resolve the sync conflict before editing.") : setNoteEditor({ mode: "create", courseId: course.id })} />}>
        {data.notes.filter(n => n.courseId === course.id).length ? data.notes.filter(n => n.courseId === course.id).map(n => <ListRow key={n.id} title={n.text.trim().split("\n")[0] || "Untitled note"} onPress={() => setNoteEditor({ mode: "edit", id: n.id })} />) : <Empty>No notes linked yet.</Empty>}
      </Card>
    </> : data ? <>
      <ChipRow><Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />{kinds.map(k => <Chip key={k.value} label={k.label} active={filter === k.value} onPress={() => setFilter(k.value)} />)}</ChipRow>
      {data.courses.filter(c => filter === "all" || (c.kind ?? "course") === filter).length === 0 ? <Card><Empty>{data.courses.length ? "Nothing in this category yet." : "Add a course, book, certification, skill, or self-paced track to start."}</Empty></Card> : null}
      {data.courses.filter(c => filter === "all" || (c.kind ?? "course") === filter).map(c => {
        const tasks = data.tasks.filter(t => t.courseId === c.id && t.kind !== "event")
        const done = tasks.filter(t => t.done).length
        const progress = c.kind === "reading" && c.pagesTotal ? (c.pagesRead ?? 0) / c.pagesTotal : tasks.length ? done / tasks.length : 0
        return <Card key={c.id} onPress={() => setOpenId(c.id)}><View style={styles.cardHead}><View style={[styles.dot, { backgroundColor: "#74a7ff" }]} /><View style={styles.flex}><Text style={styles.name}>{c.title}</Text><Text style={styles.meta}>{[kindLabel(c.kind), c.code, c.term].filter(Boolean).join(" · ")}</Text></View><Icon name="chevron-forward" size={18} /></View><ProgressBar value={progress} /><Text style={styles.meta}>{c.kind === "reading" && c.pagesTotal ? `${c.pagesRead ?? 0} of ${c.pagesTotal} pages` : `${done} of ${tasks.length} tasks done`}</Text></Card>
      })}
    </> : null}
    {data && courseEditor ? <CourseEditor key={courseEditor === "new" ? "new" : courseEditor.id} value={courseEditor} onClose={() => setCourseEditor(null)} /> : null}
    {data && taskEditor ? <TaskSheet key={taskEditor.mode === "edit" ? taskEditor.id : `new-${taskEditor.courseId}`} editor={taskEditor} data={data} today={todayKey()} onClose={() => setTaskEditor(null)} /> : null}
    {data && noteEditor ? <NoteSheet key={noteEditor.mode === "edit" ? noteEditor.id : `new-${noteEditor.courseId}`} editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} /> : null}
  </Screen>
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, cardHead: { flexDirection: "row", alignItems: "center", gap: 10 }, dot: { width: 11, height: 11, borderRadius: 6 }, name: { color: color.text, fontSize: 16, fontWeight: "700" }, meta: { color: color.muted, fontSize: 13, lineHeight: 19 }, body: { color: color.text2, fontSize: 14, lineHeight: 20 }, link: { color: "#74a7ff", fontSize: 13, paddingVertical: 8 }, error: { color: color.errorText, fontSize: 13 }, iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.panel, alignItems: "center", justifyContent: "center" }, back: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 36 },
})
