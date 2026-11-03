import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { createCourse, updateCourse, type Collections, type NewCourse } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Button, Chip, ChipRow, Icon } from "../../ui.tsx"

type Course = Collections["courses"][number]
type Kind = NonNullable<Course["kind"]>
const kinds: { value: Kind; label: string }[] = [
  { value: "course", label: "Course" }, { value: "certification", label: "Certification" },
  { value: "selfpaced", label: "Self-paced" }, { value: "skill", label: "Skill" }, { value: "reading", label: "Reading" },
]

/** Compact editor for the five existing Learning record kinds. Empty optional fields are valid. */
export function CourseEditor({ value, onClose }: { value: Course | "new"; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const previous = value === "new" ? null : value
  const [kind, setKind] = useState<Kind>(previous?.kind ?? "course")
  const [title, setTitle] = useState(previous?.title ?? "")
  const [code, setCode] = useState(previous?.code ?? "")
  const [instructor, setInstructor] = useState(previous?.instructor ?? "")
  const [term, setTerm] = useState(previous?.term ?? "")
  const [description, setDescription] = useState(previous?.description ?? "")
  const [url, setUrl] = useState(previous?.url ?? "")
  const [pagesRead, setPagesRead] = useState(String(previous?.pagesRead ?? ""))
  const [pagesTotal, setPagesTotal] = useState(String(previous?.pagesTotal ?? ""))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  function field(label: string, val: string, change: (v: string) => void, placeholder?: string) {
    return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={val} onChangeText={change} placeholder={placeholder ?? label} placeholderTextColor={color.muted} accessibilityLabel={label} /></View>
  }
  async function save() {
    if (busy) return
    if (!title.trim()) return setError("Give this item a title.")
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) return setError("Use a full http or https link.")
    const read = pagesRead.trim() ? Number(pagesRead) : undefined, total = pagesTotal.trim() ? Number(pagesTotal) : undefined
    if (kind === "reading" && ((read != null && (!Number.isInteger(read) || read < 0)) || (total != null && (!Number.isInteger(total) || total < 1)) || (read != null && total != null && read > total))) return setError("Check the page numbers.")
    const patch: Partial<NewCourse> = { kind, title: title.trim(), code: code.trim(), instructor: instructor.trim(), term: term.trim(), description: description.trim(), url: url.trim(), ...(kind === "reading" ? { pagesRead: read, pagesTotal: total } : {}) }
    setBusy(true)
    const ok = await mutate(["courses"], d => previous ? updateCourse(d, previous.id, patch) : createCourse(d, { instructorEmail: "", schedule: "", location: "", tags: [], color: "blue", ...patch } as NewCourse).data)
    setBusy(false)
    if (ok) onClose()
    else setError(message ?? "Could not save this item. Your changes are still here.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}>
    <View style={styles.head}><Text style={styles.heading}>{previous ? "Edit learning" : "Add learning"}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" /></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <ChipRow>{kinds.map(k => <Chip key={k.value} label={k.label} active={kind === k.value} onPress={() => setKind(k.value)} />)}</ChipRow>
      {field("Title", title, setTitle, kind === "reading" ? "Book title" : "What are you learning?")}
      {field("Code / short label", code, setCode)}
      {field(kind === "reading" ? "Author" : kind === "certification" ? "Issuer" : "Instructor / source", instructor, setInstructor)}
      {field("Term / timeframe", term, setTerm)}
      {field("Description", description, setDescription)}
      {field("Source link", url, setUrl, "https://…")}
      {kind === "reading" ? <View style={styles.pages}>{field("Pages read", pagesRead, setPagesRead)}{field("Total pages", pagesTotal, setPagesTotal)}</View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={styles.actions}><Button label="Cancel" onPress={onClose} /><Button label={busy ? "Saving…" : "Save"} primary onPress={() => void save()} /></View>
  </View></View></Modal>
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "83%", borderRadius: 16, backgroundColor: color.panel, borderWidth: 1, borderColor: color.border, overflow: "hidden" }, head: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: color.border }, heading: { color: color.text, fontSize: 16, fontWeight: "700" }, form: { padding: 14, gap: 10 }, label: { color: color.muted, fontSize: 12, marginBottom: 3 }, input: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, color: color.text, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 }, pages: { flexDirection: "row", gap: 12 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, padding: 10, borderTopWidth: 1, borderColor: color.border }, error: { color: color.errorText, fontSize: 13 },
})
