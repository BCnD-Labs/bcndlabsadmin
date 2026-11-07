import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { defaultMakeId, saveJournalItem, type Collections } from "../../lib/shared.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { previewText } from "./planner/TaskPeek.tsx"
import { selectedItem } from "../selected-item.ts"

type Entry = NonNullable<Collections["journal"][number]["entries"]>[number]
export type LearningReflection = { date: string; item: Entry }
type Answers = { clicked: string; fuzzy: string; next: string; notes: string }
const empty: Answers = { clicked: "", fuzzy: "", next: "", notes: "" }

export function learningReflections(data: Collections, courseId?: string, taskId?: string): LearningReflection[] {
  return data.journal.flatMap(day => (day.entries ?? []).filter(item =>
    (item.courseId || item.taskId) && (!taskId || item.taskId === taskId) && (!courseId || item.courseId === courseId || data.tasks.some(task => task.id === item.taskId && task.courseId === courseId))
  ).map(item => ({ date: day.id, item }))).sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt))
}

/** Keep the answers readable on older web/Mac clients that only know journal text. */
export function writeLearningReflection(a: Answers): string {
  const lines = ["## Learning reflection"]
  for (const [label, value] of [["Clicked", a.clicked], ["Still fuzzy", a.fuzzy], ["Next step", a.next]]) {
    if (value.trim()) lines.push(`${label}: ${value.trim().replace(/\s*\n\s*/g, " ")}`)
  }
  if (a.notes.trim()) lines.push("", "Notes:", a.notes.trim())
  return lines.join("\n")
}
export function readLearningReflection(text: string): Answers {
  const a = { ...empty }
  const [head, ...rest] = text.split("\nNotes:\n")
  for (const line of head.split("\n")) {
    const field = /^(Clicked|Still fuzzy|Next step): (.*)$/.exec(line)
    if (field) a[field[1] === "Clicked" ? "clicked" : field[1] === "Still fuzzy" ? "fuzzy" : "next"] = field[2]
  }
  a.notes = rest.join("\nNotes:\n")
  return a
}

export function ReflectionList({ data, courseId, taskId, onEdit }: { data: Collections; courseId?: string; taskId?: string; onEdit: (entry: LearningReflection) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const entries = learningReflections(data, courseId, taskId)
  return <View style={s.list}>
    {entries.map(entry => {
      const task = data.tasks.find(t => t.id === entry.item.taskId)
      const course = data.courses.find(c => c.id === (entry.item.courseId ?? task?.courseId))
      const source = task?.title ?? course?.title ?? "Linked item was deleted"
      const summary = readLearningReflection(entry.item.text)
      const preview = summary.clicked || summary.fuzzy || summary.next || summary.notes || "Learning reflection"
      return <View key={entry.item.id} style={[selectedItem.item, selected === entry.item.id && selectedItem.itemOn]}>
        <Pressable onPress={() => setSelected(id => id === entry.item.id ? null : entry.item.id)} accessibilityRole="button" accessibilityLabel={`Preview reflection for ${source}`} accessibilityState={{ expanded: selected === entry.item.id }} style={s.row}>
          <Text style={s.title} numberOfLines={1}>{source}</Text>
          <Text style={s.meta} numberOfLines={1}>{[task && course?.title, entry.date].filter(Boolean).join(" · ")}</Text>
        </Pressable>
        {selected === entry.item.id ? <View style={selectedItem.preview}><Text style={s.preview} numberOfLines={2} ellipsizeMode="tail">{previewText(preview)}</Text><Pressable onPress={() => onEdit(entry)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>Open reflection</Text></Pressable></View> : null}
      </View>
    })}
    {!entries.length ? <Text style={s.hint}>No learning reflections yet. A word or a short answer is enough to start.</Text> : null}
  </View>
}

export function LearningReflectionSheet({ data, initialCourseId, initialTaskId, entry, onClose }: { data: Collections; initialCourseId?: string; initialTaskId?: string; entry?: LearningReflection; onClose: () => void }) {
  const { mutate, status } = useWorkspace()
  const [id] = useState(() => entry?.item.id ?? defaultMakeId("lrn"))
  const [courseId, setCourseId] = useState(() => entry?.item.courseId ?? initialCourseId ?? data.tasks.find(t => t.id === initialTaskId)?.courseId ?? "")
  const [taskId, setTaskId] = useState(() => entry?.item.taskId ?? initialTaskId ?? "")
  const [answers, setAnswers] = useState<Answers>(() => entry ? readLearningReflection(entry.item.text) : { ...empty })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const canSave = !!courseId && !!(answers.clicked.trim() || answers.fuzzy.trim() || answers.next.trim() || answers.notes.trim()) && status !== "conflict" && !saving
  const tasks = data.tasks.filter(t => t.courseId === courseId && t.kind !== "event")
  const set = (key: keyof Answers, value: string) => { setError(""); setAnswers(a => ({ ...a, [key]: value })) }
  async function save() {
    if (!canSave) return
    setSaving(true); setError("")
    const now = new Date().toISOString()
    const item: Entry = { id, text: writeLearningReflection(answers), createdAt: entry?.item.createdAt ?? now, updatedAt: now, courseId, taskId: taskId || undefined }
    try {
      const ok = await mutate(["journal"], current => saveJournalItem(current, entry?.date ?? todayKey(), item))
      if (ok) onClose()
      else setError("Couldn't save. Your answers are still here.")
    } catch { setError("Couldn't save. Your answers are still here.") }
    finally { setSaving(false) }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardFrame style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
      <View style={s.head}><Text style={s.dialogTitle}>Learning reflection</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close reflection"><Icon name="close" tint={c.text2} /></Pressable></View>
      <KeyboardScrollView style={s.scroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Linked learning item</Text>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={s.choices}>{data.courses.map(course => <Pressable key={course.id} onPress={() => { setCourseId(course.id); setTaskId("") }} style={[s.choice, courseId === course.id && s.choiceOn]} accessibilityRole="button" accessibilityState={{ selected: courseId === course.id }}><Text style={s.choiceText}>{course.title}</Text></Pressable>)}</ScrollView>
        {courseId ? <><Text style={s.label}>Assignment or step (optional)</Text><ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={s.choices}><Pressable onPress={() => setTaskId("")} style={[s.choice, !taskId && s.choiceOn]}><Text style={s.choiceText}>Whole item</Text></Pressable>{tasks.map(task => <Pressable key={task.id} onPress={() => setTaskId(task.id)} style={[s.choice, taskId === task.id && s.choiceOn]}><Text style={s.choiceText}>{task.title}</Text></Pressable>)}</ScrollView></> : null}
        {([["clicked", "What clicked?"], ["fuzzy", "Still fuzzy?"], ["next", "Next small step?"]] as const).map(([key, label]) => <View key={key} style={s.field}><Text style={s.label}>{label}</Text><TextInput value={answers[key]} onChangeText={v => set(key, v)} placeholder="A word or short phrase" placeholderTextColor={c.muted} style={s.input} accessibilityLabel={label} /></View>)}
        <View style={s.field}><Text style={s.label}>Anything else? (optional)</Text><TextInput value={answers.notes} onChangeText={v => set("notes", v)} multiline textAlignVertical="top" placeholder="Write as much or as little as you like…" placeholderTextColor={c.muted} style={[s.input, s.notes]} accessibilityLabel="Learning reflection notes" /></View>
        {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      </KeyboardScrollView>
      <Pressable onPress={() => void save()} disabled={!canSave} style={[s.save, !canSave && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{saving ? "Saving…" : "Save reflection"}</Text></Pressable>
    </View></KeyboardFrame>
  </Modal>
}

const s = StyleSheet.create({
  list: { gap: 2 },
  row: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 5, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, meta: { color: c.muted, fontSize: 11 }, hint: { color: c.muted, fontSize: 12, paddingVertical: 8 },
  preview: { color: c.text2, fontSize: 12 },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }, dialog: { maxHeight: "88%", padding: 16, borderRadius: 18, backgroundColor: c.raised, gap: 12 }, head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, dialogTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  scroll: { flexShrink: 1 }, form: { gap: 10, paddingBottom: 10 }, label: { color: c.text, fontSize: 13, fontWeight: "600" }, field: { gap: 5 }, choices: { flexDirection: "row", gap: 6 }, choice: { minHeight: 32, maxWidth: 220, justifyContent: "center", borderRadius: 16, paddingHorizontal: 10, backgroundColor: c.panel }, choiceOn: { backgroundColor: c.selected }, choiceText: { color: c.text2, fontSize: 12 },
  input: { color: c.text, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 40, fontSize: 13 }, notes: { minHeight: 92, paddingTop: 10 }, save: { alignItems: "center", justifyContent: "center", minHeight: 42, borderRadius: 12, backgroundColor: c.action }, saveText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.45 }, error: { color: "#ff8787", fontSize: 12 },
})
