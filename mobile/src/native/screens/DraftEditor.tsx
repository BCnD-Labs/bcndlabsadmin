import { useEditorClose } from "../editing/useEditorClose.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { shape } from "../../shape.ts"
import { useState } from "react"
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { Pill } from "./learning/LearningControls.tsx"
import { saveDraftRecord } from "./draft-records.ts"

type Draft = Collections["drafts"][number]
const states: Draft["status"][] = ["idea", "drafting", "review", "ready"]

/** A compact Markdown writer for workspace drafts; publishing stays in the CMS workflow. */
export function DraftEditor({ value, data, siteId, onClose }: { value: Draft | "new"; data: Collections; siteId?: string; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const previous = value === "new" ? null : value
  const initialSite = previous?.siteId ?? siteId
  const [title, setTitle] = useState(previous?.title ?? "")
  const [body, setBody] = useState(previous?.body ?? "")
  const [slug, setSlug] = useState(previous?.slug ?? "")
  const [excerpt, setExcerpt] = useState(previous?.excerpt ?? "")
  const [kind, setKind] = useState<Draft["kind"]>(previous?.kind ?? "post")
  const [status, setStatus] = useState<Draft["status"]>(previous?.status ?? "idea")
  const [selectedSite, setSelectedSite] = useState<string | undefined>(initialSite)
  const [more, setMore] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const dirty = title !== (previous?.title ?? "") || body !== (previous?.body ?? "") || slug !== (previous?.slug ?? "") || excerpt !== (previous?.excerpt ?? "") || kind !== (previous?.kind ?? "post") || status !== (previous?.status ?? "idea") || selectedSite !== initialSite

  async function save(closeAfter = true): Promise<boolean> {
    if (busy) return false
    if (!title.trim()) return (setError("Give this draft a title."), false)
    setBusy(true)
    let ok = false
    try { ok = await mutate(["drafts"], data => saveDraftRecord(data, previous?.id, { title, body, slug, excerpt, kind, status, siteId: selectedSite }))
    } catch { setError("Could not save. Your changes are still here.") } finally { setBusy(false) }
    if (ok && closeAfter) onClose()
    if (!ok) setError(message ?? "Could not save this draft. Your writing is still here.")
    return ok
  }
  const close = useEditorClose(dirty, busy, onClose, () => save(false))
  return <Modal visible transparent animationType="fade" onRequestClose={() => close()}><KeyboardFrame style={s.backdrop}><View style={[s.sheet, expanded && s.expanded]}>
    <View style={s.header}><Text style={s.heading}>{previous ? "Edit draft" : "New draft"}</Text><View style={s.headerActions}><Pressable onPress={() => setExpanded(v => !v)} accessibilityRole="button" accessibilityLabel={expanded ? "Shrink editor" : "Expand editor"}><Icon name={expanded ? "contract-outline" : "expand-outline"} size={18} tint={c.accent} /></Pressable><Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close draft editor"><Icon name="close" size={19} tint={c.text2} /></Pressable></View></View>
    <KeyboardScrollView style={s.scroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Title</Text><TextInput value={title} onChangeText={setTitle} placeholder="What are you writing?" placeholderTextColor={c.muted} accessibilityLabel="Draft title" style={s.input} />
      <Text style={s.label}>Markdown</Text><TextInput value={body} onChangeText={setBody} placeholder="Start writing…" placeholderTextColor={c.muted} accessibilityLabel="Draft body" multiline textAlignVertical="top" style={[s.input, s.body, expanded && s.largeBody]} />
      <Pressable onPress={() => setMore(v => !v)} style={s.more} accessibilityRole="button" accessibilityState={{ expanded: more }}><Text style={s.moreText}>{more ? "− Fewer details" : "+ More details"}</Text></Pressable>
      {more ? <>
        <Text style={s.label}>Kind</Text><View style={s.options}><Pill label="Post" selected={kind === "post"} onPress={() => setKind("post")} /><Pill label="Page draft" selected={kind === "page"} onPress={() => setKind("page")} /></View>
        <Text style={s.label}>Writing status</Text><View style={s.options}>{states.map(choice => <Pill key={choice} label={choice[0].toUpperCase() + choice.slice(1)} selected={status === choice} onPress={() => setStatus(choice)} />)}</View>
        <Text style={s.hint}>Ready marks your writing. Publishing happens in the web view.</Text>
        <Text style={s.label}>URL slug</Text><TextInput value={slug} onChangeText={setSlug} placeholder="Made from the title if empty" placeholderTextColor={c.muted} accessibilityLabel="URL slug" autoCapitalize="none" style={s.input} />
        <Text style={s.label}>Excerpt</Text><TextInput value={excerpt} onChangeText={setExcerpt} placeholder="Short summary" placeholderTextColor={c.muted} accessibilityLabel="Excerpt" multiline style={[s.input, s.excerpt]} />
        {data.sites.length ? <><Text style={s.label}>Site</Text><View style={s.options}><Pill label="Unassigned" selected={!selectedSite} onPress={() => setSelectedSite(undefined)} />{data.sites.map(site => <Pill key={site.id} label={site.name} selected={selectedSite === site.id} onPress={() => setSelectedSite(site.id)} />)}</View></> : null}
      </> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </KeyboardScrollView>
    <View style={s.actions}><Pressable onPress={() => close()} style={s.action} accessibilityRole="button"><Text style={s.actionText}>Close</Text></Pressable><Pressable onPress={() => void save()} disabled={busy} style={[s.action, s.save, busy && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{busy ? "Saving…" : "Save draft"}</Text></Pressable></View>
  </View></KeyboardFrame></Modal>
}

const s = StyleSheet.create({ backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { width: "92%", maxWidth: 560, maxHeight: "76%", borderRadius: shape.dialog, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, overflow: "hidden" }, expanded: { maxHeight: "94%" }, header: { minHeight: 37, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: c.line }, heading: { color: c.text, fontSize: 15, fontWeight: "600" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 20 }, scroll: { flexGrow: 0, flexShrink: 1 }, form: { padding: 12, gap: 7 }, label: { color: c.muted, fontSize: 11 }, input: { minHeight: 34, borderRadius: 11, backgroundColor: c.ground, borderWidth: 1, borderColor: c.line, color: c.text, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 }, body: { minHeight: 150, maxHeight: 280, lineHeight: 19 }, largeBody: { minHeight: 300, maxHeight: 560 }, excerpt: { minHeight: 55 }, more: { minHeight: 26, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: c.accent, fontSize: 12 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, hint: { color: c.muted, fontSize: 11 }, error: { color: "#ffa8a8", fontSize: 12 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, padding: 8, borderTopWidth: 1, borderColor: c.line }, action: { minHeight: 32, borderRadius: 15, paddingHorizontal: 12, justifyContent: "center", backgroundColor: c.raised }, save: { backgroundColor: c.action }, disabled: { opacity: 0.5 }, actionText: { color: c.text2, fontSize: 12 }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" } })

