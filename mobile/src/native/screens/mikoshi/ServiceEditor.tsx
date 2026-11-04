import { useState } from "react"
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { createService, removeService, updateService, type Collections } from "../../../lib/shared.ts"
import { originOf } from "../../../lib/url.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"
import { Pill } from "../learning/LearningControls.tsx"

type Service = Collections["services"][number]
const commonGroups = ["Infrastructure", "Apps", "AI", "Media"]

/** Edits the Blackwall launcher record, not the tool's own web page. */
export function ServiceEditor({ value, groups, onClose }: { value: Service | "new"; groups: string[]; onClose: () => void }) {
  const { mutate } = useWorkspace()
  const previous = value === "new" ? null : value
  const [name, setName] = useState(previous?.name ?? "")
  const [url, setUrl] = useState(previous?.url ?? "https://")
  const [description, setDescription] = useState(previous?.description ?? "")
  const [group, setGroup] = useState(previous?.group ?? "Services")
  const [pinned, setPinned] = useState(previous?.pinned ?? false)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const dirty = name !== (previous?.name ?? "") || url !== (previous?.url ?? "https://") || description !== (previous?.description ?? "") || group !== (previous?.group ?? "Services") || pinned !== (previous?.pinned ?? false)
  const choices = [...new Set([...commonGroups, ...groups.filter(Boolean)])]

  function dismiss() {
    if (busy) return
    if (!dirty) return onClose()
    Alert.alert("Discard tool changes?", "Your edits have not been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ])
  }

  async function save() {
    if (busy) return
    const trimmed = { name: name.trim(), url: url.trim(), description: description.trim(), group: group.trim() || "Services", pinned }
    if (!trimmed.name) return setError("Give this tool a name.")
    if (trimmed.url.length > 2048 || !originOf(trimmed.url)) return setError("Enter a full http:// or https:// address without spaces or a password.")
    setBusy(true)
    const ok = await mutate(["services"], data => {
      if (previous && !data.services.some(service => service.id === previous.id)) throw new Error("This tool no longer exists. Refresh Mikoshi and try again.")
      return previous ? updateService(data, previous.id, trimmed) : createService(data, trimmed).data
    })
    setBusy(false)
    if (ok) onClose()
    else setError("Could not save this tool. Your changes are still here.")
  }

  function confirmDelete() {
    if (!previous || busy) return
    Alert.alert("Remove this tool?", `${previous.name} will disappear from Mikoshi. The tool itself will not be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void remove() },
    ])
  }

  async function remove() {
    if (!previous) return
    setBusy(true)
    const ok = await mutate(["services"], data => {
      if (!data.services.some(service => service.id === previous.id)) throw new Error("This tool has already been removed.")
      return removeService(data, previous.id)
    })
    setBusy(false)
    if (ok) onClose()
    else setError("Could not remove this tool. Try again.")
  }

  return <Modal visible transparent animationType="fade" onRequestClose={dismiss}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.header}><Text style={s.heading}>{previous ? "Edit tool" : "New tool"}</Text><Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close tool editor"><Icon name="close" size={18} tint={c.text2} /></Pressable></View>
    <ScrollView style={s.scroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="Portainer" placeholderTextColor={c.muted} accessibilityLabel="Tool name" maxLength={100} style={s.input} />
      <Text style={s.label}>Address</Text><TextInput value={url} onChangeText={setUrl} placeholder="https://host:9443" placeholderTextColor={c.muted} accessibilityLabel="Tool address" keyboardType="url" autoCapitalize="none" autoCorrect={false} style={s.input} />
      <Text style={s.hint}>HTTPS tools open inside Blackwall. HTTP tools open in your browser.</Text>
      <Pressable onPress={() => setMore(v => !v)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: more }}><Text style={s.moreText}>{more ? "− Fewer details" : "+ More details"}</Text></Pressable>
      {more ? <>
        <Text style={s.label}>What it is</Text><TextInput value={description} onChangeText={setDescription} placeholder="Containers" placeholderTextColor={c.muted} accessibilityLabel="Tool description" maxLength={40} style={s.input} />
        <Text style={s.label}>Group</Text><View style={s.choices}>{choices.map(choice => <Pill key={choice} label={choice} selected={group === choice} onPress={() => setGroup(choice)} />)}</View>
        <TextInput value={group} onChangeText={setGroup} placeholder="Or name a group" placeholderTextColor={c.muted} accessibilityLabel="Tool group" maxLength={32} style={s.input} />
        <View style={s.pin}><Text style={s.pinText}>Pin to the top</Text><Switch value={pinned} onValueChange={setPinned} trackColor={{ false: c.line, true: c.selectedBorder }} thumbColor={pinned ? c.accent : c.muted} accessibilityLabel="Pin tool to the top" /></View>
      </> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}>{previous ? <Pressable onPress={confirmDelete} disabled={busy} style={s.remove} accessibilityRole="button"><Text style={s.removeText}>Remove</Text></Pressable> : null}<View style={s.spacer} /><Pressable onPress={dismiss} style={s.action} accessibilityRole="button"><Text style={s.actionText}>Close</Text></Pressable><Pressable onPress={() => void save()} disabled={busy} style={[s.action, s.save, busy && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{busy ? "Saving…" : previous ? "Save" : "Add tool"}</Text></Pressable></View>
  </View></View></Modal>
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { width: "92%", maxWidth: 480, maxHeight: "76%", borderRadius: 15, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  header: { minHeight: 34, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: c.line },
  heading: { color: c.text, fontSize: 14, fontWeight: "600" }, scroll: { flexGrow: 0, flexShrink: 1 }, form: { padding: 11, gap: 6 },
  label: { color: c.muted, fontSize: 11 }, hint: { color: c.muted, fontSize: 11, lineHeight: 15 },
  input: { minHeight: 33, borderRadius: 13, backgroundColor: c.ground, borderWidth: 1, borderColor: c.line, color: c.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 },
  more: { minHeight: 27, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: c.accent, fontSize: 12 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, pin: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pinText: { color: c.text2, fontSize: 12 },
  error: { color: "#ffa8a8", fontSize: 12 }, actions: { flexDirection: "row", alignItems: "center", gap: 7, padding: 8, borderTopWidth: 1, borderColor: c.line }, spacer: { flex: 1 },
  action: { minHeight: 28, borderRadius: 15, paddingHorizontal: 12, justifyContent: "center", backgroundColor: c.raised }, save: { backgroundColor: c.action }, disabled: { opacity: 0.5 },
  actionText: { color: c.text2, fontSize: 12 }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" }, remove: { minHeight: 28, paddingHorizontal: 8, justifyContent: "center" }, removeText: { color: "#ff8787", fontSize: 12 },
})
