import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { createCourse, updateCourse, validDateKey, type Collections, type NewCourse } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { plannerColor as p } from "../../planner-theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Icon } from "../../ui.tsx"
import { cleanLinks, linkProblem } from "../planner/doc-links.ts"
import { LinksSection } from "../planner/LinksSection.tsx"

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
  const [startDate, setStartDate] = useState(previous?.startDate ?? "")
  const [endDate, setEndDate] = useState(previous?.endDate ?? "")
  const [schedule, setSchedule] = useState(previous?.schedule ?? "")
  const [location, setLocation] = useState(previous?.location ?? "")
  const [description, setDescription] = useState(previous?.description ?? "")
  const [url, setUrl] = useState(previous?.url ?? "")
  const [links, setLinks] = useState(previous?.links ?? [])
  const [pagesRead, setPagesRead] = useState(String(previous?.pagesRead ?? ""))
  const [pagesTotal, setPagesTotal] = useState(String(previous?.pagesTotal ?? ""))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)
  function field(label: string, val: string, change: (v: string) => void, placeholder?: string) {
    return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={val} onChangeText={change} placeholder={placeholder ?? label} placeholderTextColor={color.muted} accessibilityLabel={label} /></View>
  }
  async function save() {
    if (busy) return
    if (!title.trim()) return setError("Give this item a title.")
    if (url.trim() && !/^https?:\/\//i.test(url.trim())) return setError("Use a full http or https link.")
    if (linkProblem(links)) return setError(linkProblem(links)!)
    if ((startDate.trim() && !validDateKey(startDate.trim())) || (endDate.trim() && !validDateKey(endDate.trim()))) return setError("Use YYYY-MM-DD for dates.")
    const read = pagesRead.trim() ? Number(pagesRead) : undefined, total = pagesTotal.trim() ? Number(pagesTotal) : undefined
    if (kind === "reading" && ((read != null && (!Number.isInteger(read) || read < 0)) || (total != null && (!Number.isInteger(total) || total < 1)) || (read != null && total != null && read > total))) return setError("Check the page numbers.")
    const patch: Partial<NewCourse> = { kind, title: title.trim(), code: code.trim(), instructor: instructor.trim(), term: term.trim(), startDate: startDate.trim() || undefined, endDate: endDate.trim() || undefined, schedule: schedule.trim(), location: location.trim(), description: description.trim(), url: url.trim(), links: cleanLinks(links), pagesRead: kind === "reading" ? read : undefined, pagesTotal: kind === "reading" ? total : undefined }
    setBusy(true)
    const ok = await mutate(["courses"], d => previous ? updateCourse(d, previous.id, patch) : createCourse(d, { instructorEmail: "", tags: [], color: "blue", ...patch } as NewCourse).data)
    setBusy(false)
    if (ok) onClose()
    else setError(message ?? "Could not save this item. Your changes are still here.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}>
    <View style={styles.head}><Text style={styles.heading}>{previous ? "Edit learning" : "Add learning"}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" /></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>{kinds.map(k => <Pressable key={k.value} onPress={() => setKind(k.value)} style={[styles.kind, kind === k.value && styles.kindOn]} accessibilityRole="button" accessibilityState={{ selected: kind === k.value }}><Text style={[styles.kindText, kind === k.value && styles.kindTextOn]}>{k.label}</Text></Pressable>)}</ScrollView>
      {field("Title", title, setTitle, kind === "reading" ? "Book title" : "What are you learning?")}
      {kind === "reading" ? <View style={styles.pages}>{field("Pages read", pagesRead, setPagesRead)}{field("Total pages", pagesTotal, setPagesTotal)}</View> : null}
      {expanded ? <>{field("Code / short label", code, setCode)}{field(kind === "reading" ? "Author" : kind === "certification" ? "Issuer" : "Instructor / source", instructor, setInstructor)}{field("Term / timeframe", term, setTerm)}{field("Start date", startDate, setStartDate, "YYYY-MM-DD")}{field(kind === "certification" ? "Exam date" : "End / target date", endDate, setEndDate, "YYYY-MM-DD")}{field("Schedule", schedule, setSchedule)}{field("Location", location, setLocation)}{field("Description", description, setDescription)}{field("Source link", url, setUrl, "https://…")}<Text style={styles.label}>Resources</Text><LinksSection links={links} onChange={setLinks} hint="Links to notes, files, or other resources for this learning item." /></> : <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel="More details" style={styles.more}><Text style={styles.moreText}>+ More details</Text></Pressable>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={styles.actions}><Pressable onPress={onClose} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Close</Text></Pressable><Pressable onPress={() => void save()} style={[styles.action, styles.save]} accessibilityRole="button"><Text style={[styles.actionText, styles.saveText]}>{busy ? "Saving…" : "Save"}</Text></Pressable></View>
  </View></View></Modal>
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "76%", borderRadius: 16, backgroundColor: p.panel, borderWidth: 1, borderColor: p.border, overflow: "hidden" }, head: { minHeight: 35, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: p.line }, heading: { color: p.text, fontSize: 15, fontWeight: "600" }, form: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 }, kinds: { gap: 6 }, kind: { borderRadius: 18, minHeight: 27, paddingHorizontal: 10, justifyContent: "center", backgroundColor: p.raised }, kindOn: { backgroundColor: p.selected, borderWidth: 1, borderColor: p.selectedBorder }, kindText: { color: p.muted, fontSize: 12 }, kindTextOn: { color: p.accent }, label: { color: color.muted, fontSize: 11, marginBottom: 2 }, input: { minHeight: 34, borderRadius: 12, borderWidth: 1, borderColor: p.line, backgroundColor: p.ground, color: p.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 }, pages: { flexDirection: "row", gap: 12 }, more: { alignSelf: "flex-start", minHeight: 26, justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: p.accent, fontSize: 12 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: 1, borderColor: p.line }, action: { minHeight: 27, paddingHorizontal: 13, borderRadius: 16, justifyContent: "center", backgroundColor: p.raised }, save: { backgroundColor: p.action }, actionText: { color: p.text2, fontSize: 12, fontWeight: "600" }, saveText: { color: "#fff" }, error: { color: color.errorText, fontSize: 13 },
})
