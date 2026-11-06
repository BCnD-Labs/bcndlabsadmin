import { shape } from "../../shape.ts"
import { useState } from "react"
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { STARTERS } from "../../../../blackwall-admin/shared/site-starters.ts"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { Pill } from "./learning/LearningControls.tsx"
import { saveSiteRecord } from "./site-records.ts"

type Site = Collections["sites"][number]

/** Core site setup; page layout and publishing remain in the web editor. */
export function SiteEditor({ value, onClose }: { value: Site | "new"; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const previous = value === "new" ? null : value
  const [name, setName] = useState(previous?.name ?? "")
  const [domain, setDomain] = useState(previous?.domain ?? "")
  const [footerText, setFooterText] = useState(previous?.footerText ?? "")
  const [darkMode, setDarkMode] = useState(previous?.darkMode ?? true)
  const [starter, setStarter] = useState(previous?.starter ?? "midnight")
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const dirty = name !== (previous?.name ?? "") || domain !== (previous?.domain ?? "") || footerText !== (previous?.footerText ?? "") || darkMode !== (previous?.darkMode ?? true) || (!previous && starter !== "midnight")
  function close() {
    if (busy) return
    if (!dirty) return onClose()
    Alert.alert("Discard site changes?", "Your edits have not been saved.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: onClose }])
  }
  async function save() {
    if (busy) return
    if (!name.trim()) return setError("Give this site a name.")
    setBusy(true)
    const ok = await mutate(previous ? ["sites"] : ["sites", "pages"], data => saveSiteRecord(data, previous?.id, { name, domain, footerText, darkMode }, starter))
    setBusy(false)
    if (ok) onClose()
    else setError(message ?? "Could not save this site. Your changes are still here.")
  }
  return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={s.backdrop}><View style={s.sheet}>
    <View style={s.header}><Text style={s.heading}>{previous ? "Edit site" : "New site"}</Text><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close site editor"><Icon name="close" size={19} tint={c.text2} /></Pressable></View>
    <ScrollView style={s.scroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="Site name" placeholderTextColor={c.muted} accessibilityLabel="Site name" style={s.input} />
      <Text style={s.label}>Domain</Text><TextInput value={domain} onChangeText={setDomain} placeholder="example.com (optional)" placeholderTextColor={c.muted} accessibilityLabel="Site domain" autoCapitalize="none" keyboardType="url" style={s.input} />
      {!previous ? <><Text style={s.label}>Starting palette</Text><View style={s.options}>{Object.entries(STARTERS).map(([key, palette]) => <Pill key={key} label={palette.name} selected={starter === key} onPress={() => setStarter(key)} />)}</View><Text style={s.hint}>Starts with an empty Home page. Build its layout in the web view.</Text></> : null}
      <Pressable onPress={() => setMore(v => !v)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: more }}><Text style={s.moreText}>{more ? "− Fewer details" : "+ More details"}</Text></Pressable>
      {more ? <><Text style={s.label}>Appearance</Text><View style={s.options}><Pill label="Dark default" selected={darkMode} onPress={() => setDarkMode(true)} /><Pill label="Light default" selected={!darkMode} onPress={() => setDarkMode(false)} /></View><Text style={s.label}>Footer text</Text><TextInput value={footerText} onChangeText={setFooterText} placeholder="Optional" placeholderTextColor={c.muted} accessibilityLabel="Site footer text" style={s.input} /></> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.actions}><Pressable onPress={close} style={s.action} accessibilityRole="button"><Text style={s.actionText}>Close</Text></Pressable><Pressable onPress={() => void save()} disabled={busy} style={[s.action, s.save, busy && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{busy ? "Saving…" : "Save site"}</Text></Pressable></View>
  </View></View></Modal>
}

const s = StyleSheet.create({ backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 520, maxHeight: "76%", borderRadius: shape.dialog, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" }, header: { minHeight: 36, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: c.line }, heading: { color: c.text, fontSize: 15, fontWeight: "600" }, scroll: { flexGrow: 0, flexShrink: 1 }, form: { padding: 12, gap: 7 }, label: { color: c.muted, fontSize: 11 }, input: { minHeight: 34, borderRadius: 11, backgroundColor: c.ground, borderWidth: 1, borderColor: c.line, color: c.text, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, hint: { color: c.muted, fontSize: 11 }, more: { minHeight: 26, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: c.accent, fontSize: 12 }, error: { color: "#ffa8a8", fontSize: 12 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, padding: 8, borderTopWidth: 1, borderColor: c.line }, action: { minHeight: 28, borderRadius: 15, paddingHorizontal: 12, justifyContent: "center", backgroundColor: c.raised }, save: { backgroundColor: c.action }, disabled: { opacity: 0.5 }, actionText: { color: c.text2, fontSize: 12 }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" } })

