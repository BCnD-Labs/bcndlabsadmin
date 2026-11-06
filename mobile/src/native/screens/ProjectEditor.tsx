import { shape } from "../../shape.ts"
import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { Pill } from "./learning/LearningControls.tsx"
import { saveProjectRecord } from "./project-records.ts"

type Project = Collections["projects"][number]
type Status = Project["status"]
type Colour = Project["color"]
const statuses: Status[] = ["active", "planned", "paused", "done"]
const colours: { key: Colour; tint: string }[] = [{ key: "teal", tint: "#26a69a" }, { key: "amber", tint: c.amber }, { key: "red", tint: "#ef5350" }, { key: "slate", tint: "#90a4ae" }]

/** Edits a workspace project and its repository assignments through one guarded mutation. */
export function ProjectEditor({ value, data, onClose }: { value: Project | "new"; data: Collections; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const previous = value === "new" ? null : value
  const [name, setName] = useState(previous?.name ?? "")
  const [code, setCode] = useState(previous?.code ?? "")
  const [status, setStatus] = useState<Status>(previous?.status ?? "active")
  const [colour, setColour] = useState<Colour>(previous?.color ?? "teal")
  const [description, setDescription] = useState(previous?.description ?? "")
  const [linked, setLinked] = useState<string[]>(previous ? data.repos.filter(r => r.projectId === previous.id).map(r => r.id) : [])
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const available = data.repos.filter(r => !r.projectId || r.projectId === previous?.id)
  const autoCode = name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase()
  function toggleRepo(id: string) { setLinked(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]) }
  async function save() {
    if (busy) return
    if (!name.trim()) return setError("Give this project a name.")
    const patch = { name: name.trim(), code: (code.trim() || autoCode || "PRJ").toUpperCase().slice(0, 5), status, color: colour, description: description.trim() }
    setBusy(true)
    const ok = await mutate(["projects", "repos"], d => saveProjectRecord(d, previous?.id, patch, linked))
    setBusy(false)
    if (ok) onClose()
    else setError(message ?? "Could not save this project. Your changes are still here.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.header}><Text style={s.heading}>{previous ? "Edit project" : "New project"}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close project editor"><Icon name="close" size={19} tint={c.text2} /></Pressable></View>
    <ScrollView style={s.scroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={c.muted} accessibilityLabel="Project name" style={s.input} />
      <Text style={s.label}>Short code</Text><TextInput value={code} onChangeText={setCode} placeholder={autoCode || "PRJ"} placeholderTextColor={c.muted} autoCapitalize="characters" maxLength={5} accessibilityLabel="Short code" style={s.input} />
      <Pressable onPress={() => setMore(v => !v)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: more }}><Text style={s.moreText}>{more ? "− Fewer details" : "+ More details"}</Text></Pressable>
      {more ? <><Text style={s.label}>Status</Text><View style={s.options}>{statuses.map(choice => <Pill key={choice} label={choice[0].toUpperCase() + choice.slice(1)} selected={status === choice} onPress={() => setStatus(choice)} />)}</View>
      <Text style={s.label}>Colour</Text><View style={s.options}>{colours.map(option => <Pressable key={option.key} onPress={() => setColour(option.key)} style={[s.swatch, colour === option.key && s.swatchOn]} accessibilityRole="button" accessibilityLabel={option.key + " colour"} accessibilityState={{ selected: colour === option.key }}><View style={[s.swatchDot, { backgroundColor: option.tint }]} /><Text style={s.swatchText}>{option.key}</Text></Pressable>)}</View>
      <Text style={s.label}>Description</Text><TextInput value={description} onChangeText={setDescription} multiline textAlignVertical="top" placeholder="What is this project for?" placeholderTextColor={c.muted} accessibilityLabel="Description" style={[s.input, s.description]} />
      {available.length ? <><Text style={s.label}>Repositories</Text>{available.map(repo => <Pressable key={repo.id} onPress={() => toggleRepo(repo.id)} style={s.repo} accessibilityRole="checkbox" accessibilityState={{ checked: linked.includes(repo.id) }}><Icon name={linked.includes(repo.id) ? "checkbox" : "square-outline"} size={19} tint={linked.includes(repo.id) ? c.accent : c.muted} /><Text style={s.repoName} numberOfLines={1}>{repo.fullName}</Text></Pressable>)}</> : null}</> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}><Pressable onPress={onClose} style={s.action} accessibilityRole="button"><Text style={s.actionText}>Close</Text></Pressable><Pressable onPress={() => void save()} disabled={busy} style={[s.action, s.save, busy && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{busy ? "Saving…" : "Save project"}</Text></Pressable></View>
  </View></View></Modal>
}

const s = StyleSheet.create({ backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "76%", borderRadius: shape.dialog, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" }, header: { minHeight: 36, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: c.line }, heading: { color: c.text, fontSize: 15, fontWeight: "600" }, scroll: { flexGrow: 0 }, form: { padding: 12, gap: 7 }, label: { color: c.muted, fontSize: 11 }, input: { minHeight: 34, borderRadius: 11, backgroundColor: c.ground, borderWidth: 1, borderColor: c.line, color: c.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 }, more: { minHeight: 26, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: c.accent, fontSize: 12 }, description: { minHeight: 64 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, swatch: { minHeight: 29, borderRadius: 15, backgroundColor: c.raised, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "transparent" }, swatchOn: { borderColor: c.accent }, swatchDot: { width: 9, height: 9, borderRadius: 5 }, swatchText: { color: c.text2, fontSize: 11, textTransform: "capitalize" }, repo: { minHeight: 31, flexDirection: "row", alignItems: "center", gap: 8 }, repoName: { color: c.text2, fontSize: 12, flex: 1 }, error: { color: "#ffa8a8", fontSize: 12 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, padding: 8, borderTopWidth: 1, borderColor: c.line }, action: { minHeight: 28, borderRadius: 15, paddingHorizontal: 12, justifyContent: "center", backgroundColor: c.raised }, save: { backgroundColor: c.action }, disabled: { opacity: 0.5 }, actionText: { color: c.text2, fontSize: 12 }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" } })

