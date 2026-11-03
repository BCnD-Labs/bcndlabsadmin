import { useEffect, useRef, useState, type ComponentRef } from "react"
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { saveJournalItem, saveJournalLegacyText, type Collections } from "../../../../lib/shared.ts"
import { MAX_LOG_SECTIONS, MAX_SECTION_TITLE } from "../../../../../../blackwall-admin/shared/journal-sections.ts"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import { appendPrompt, LOG_PROMPTS, shownText } from "./log-rules.ts"
import type { EntryDraft, LogDrafts } from "./useLogDrafts.ts"

type Item = NonNullable<Collections["journal"][number]["entries"]>[number]
type Compose = { kind: "entry"; day: string; id: string; text: string; sectionId?: string; legacy?: boolean; asNote: boolean; noteId: string; createdAt: string; initialText: string }
type Naming = { kind: "section"; id?: string; text: string }
type Editor = Compose | Naming
const newId = () => `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** Compact dated entry list. Legacy main/section text remains editable without a migration. */
export function DailyLogEditor({ data, day, logs, blocked }: { data: Collections; day: string; logs: LogDrafts; blocked?: string }) {
  const { mutate } = useWorkspace()
  const [active, setActive] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [quick, setQuick] = useState(false)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const sections = logs.shownSections(day)
  const selected = sections.find((section) => section.id === active)
  const journal = data.journal.find((entry) => entry.id === day)
  const legacyText = selected ? selected.text : shownText(logs.drafts, data.journal, day)
  const items = (journal?.entries ?? []).filter((entry) => (entry.sectionId ?? null) === active)
  useEffect(() => setActive(null), [day])
  const draftKey = `${day}/${active ?? ""}`
  const draft = logs.entryDrafts[draftKey]
  const makeDraft = (): EntryDraft => { const id = newId(); return { id, text: "", asNote: false, noteId: `nte_${id}`, createdAt: new Date().toISOString() } }
  function changeDraft(change: (value: EntryDraft) => EntryDraft) {
    setError(null)
    logs.setEntryDrafts((current) => ({ ...current, [draftKey]: change(current[draftKey] ?? makeDraft()) }))
  }
  function template(label: string) {
    changeDraft((value) => ({ ...value, text: appendPrompt(value.text, label) }))
    setQuick(false)
    input.current?.focus()
  }
  async function saveInline() {
    if (!draft?.text.trim() || busy.current) return
    if (blocked) { setError(blocked); return }
    if (active && !journal?.sections?.some((section) => section.id === active)) { setError("This section has not saved yet. Try again in a moment."); return }
    const key = draftKey
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      const ok = await mutate(["journal", "notes"], (current) => saveJournalItem(current, day, { id: draft.id, text: draft.text, sectionId: active ?? undefined, noteId: draft.asNote ? draft.noteId : undefined, createdAt: draft.createdAt, updatedAt: draft.createdAt }, draft.asNote))
      if (!ok) setError("Couldn't save. Your entry is kept here; try again.")
      else logs.setEntryDrafts((current) => {
        if (current[key] !== draft) return current
        const next = { ...current }; delete next[key]; return next
      })
    } catch { setError("Couldn't save. Your entry is kept here; try again.") }
    finally { busy.current = false; setSaving(false) }
  }

  function open(item?: Item, legacy = false) {
    setError(null)
    const id = item?.id ?? newId()
    const noteId = item?.noteId ?? (legacy ? (selected ? selected.noteId : journal?.mainNoteId) : undefined) ?? `nte_${id}`
    setEditor({ kind: "entry", day, id, text: item?.text ?? (legacy ? legacyText : ""), sectionId: selected?.id, legacy, asNote: !!(item?.noteId ?? (legacy ? (selected ? selected.noteId : journal?.mainNoteId) : undefined)), noteId, createdAt: item?.createdAt ?? new Date().toISOString(), initialText: item?.text ?? (legacy ? legacyText : "") })
  }
  function close() { if (!busy.current) { setEditor(null); setQuick(false); setError(null) } }
  async function save() {
    if (!editor?.text.trim() || busy.current) return
    setError(null)
    if (editor.kind === "section") {
      const title = editor.text.trim()
      if (editor.id) logs.editSections(day, sections.map((section) => section.id === editor.id ? { ...section, title } : section), true)
      else if (sections.length < MAX_LOG_SECTIONS) { const id = newId(); logs.editSections(day, [...sections, { id, title, text: "" }], true); setActive(id) }
      setEditor(null)
      return
    }
    if (blocked) { setError(blocked); return }
    if (editor.sectionId && !data.journal.find((entry) => entry.id === editor.day)?.sections?.some((section) => section.id === editor.sectionId)) { setError("This section has not saved yet. Try again in a moment."); return }
    busy.current = true
    setSaving(true)
    try {
      const result = await mutate(["journal", "notes"], (current) => editor.legacy
        ? saveJournalLegacyText(current, editor.day, editor.sectionId, editor.text, editor.asNote, editor.noteId)
        : saveJournalItem(current, editor.day, { id: editor.id, text: editor.text, sectionId: editor.sectionId, noteId: editor.asNote ? editor.noteId : undefined, createdAt: editor.createdAt, updatedAt: editor.createdAt }, editor.asNote))
      if (!result) setError("Couldn't save. Your entry is kept here; try again.")
      else {
        if (editor.legacy) logs.acknowledgeLegacy(editor.day, editor.sectionId, editor.initialText, editor.text, editor.asNote ? editor.noteId : undefined)
        setEditor(null)
      }
    } catch { setError("Couldn't save. Your entry is kept here; try again.") }
    finally { busy.current = false; setSaving(false) }
  }

  const row = (key: string, text: string, note: boolean, onPress: () => void) => <Pressable key={key} onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`Edit log entry: ${text}`}>
    <Icon name={note ? "document-text-outline" : "ellipse-outline"} size={13} tint={c.muted} />
    <Text style={styles.rowText} numberOfLines={2}>{text}</Text><Icon name="chevron-forward" size={13} tint={c.muted} />
  </Pressable>

  return <View style={styles.root}>
    <View style={styles.header}><Icon name="create-outline" tint={c.text2} size={17} /><Text style={styles.heading} accessibilityRole="header">Daily log</Text>
      <Pressable disabled={!!blocked || saving} onPress={() => { setError(null); setQuick(true) }} style={styles.icon} accessibilityRole="button" accessibilityLabel="Daily log quick inserts"><Icon name="add" tint={c.accent} size={19} /></Pressable>
    </View>
    {sections.length ? <View style={styles.tabsRow}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} keyboardShouldPersistTaps="handled">
      {[{ id: null, title: "Log" }, ...sections].map((section) => <Pressable key={section.id ?? "main"} onPress={() => setActive(section.id)} accessibilityRole="tab" accessibilityState={{ selected: active === section.id }} style={[styles.tab, active === section.id && styles.selected]}><Text style={[styles.tabText, active === section.id && styles.actionText]}>{section.title}</Text></Pressable>)}
    </ScrollView>{selected ? <Pressable disabled={!!blocked} onPress={() => { setError(null); setEditor({ kind: "section", id: selected.id, text: selected.title }) }} style={styles.icon} accessibilityRole="button" accessibilityLabel={`Rename ${selected.title}`}><Icon name="pencil-outline" tint={c.muted} size={14} /></Pressable> : null}</View> : null}
    <TextInput ref={input} value={draft?.text ?? ""} editable={!saving && !blocked} onChangeText={(text) => changeDraft((value) => ({ ...value, text }))} multiline textAlignVertical="top" maxLength={1_000_000} placeholder="What happened today?" placeholderTextColor={c.muted} style={styles.composer} accessibilityLabel="New daily log entry" />
    {draft?.text.trim() ? <View style={styles.composeActions}>
      <Pressable disabled={saving} onPress={() => changeDraft((value) => ({ ...value, asNote: !value.asNote }))} style={styles.noteToggle} accessibilityRole="checkbox" accessibilityState={{ checked: draft.asNote }} accessibilityLabel="Also save as a Note"><Icon name={draft.asNote ? "checkbox-outline" : "square-outline"} size={17} tint={draft.asNote ? c.accent : c.muted} /><Text style={styles.tabText}>Save as Note</Text></Pressable>
      <Pressable disabled={saving || !!blocked} onPress={() => void saveInline()} style={[styles.pill, styles.savePill]} accessibilityRole="button" accessibilityLabel="Save entry"><Text style={styles.saveText}>{saving ? "Saving…" : "Save entry"}</Text></Pressable>
    </View> : null}
    {error && !editor && !quick ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    {legacyText.trim() ? row("legacy", legacyText, !!((selected ? selected.noteId : journal?.mainNoteId)), () => open(undefined, true)) : null}
    {items.map((item) => row(item.id, item.text, !!item.noteId, () => open(item)))}
    {!legacyText.trim() && !items.length ? <Text style={styles.empty}>No entries for this {selected ? "section" : "day"}.</Text> : null}
    {logs.failed[day] ? <Text style={styles.error}>Section changes haven't saved yet. <Text onPress={() => void logs.save(day)}>Try again</Text></Text> : null}
    <Modal visible={!!editor || quick} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.backdrop}>
        {quick ? <View style={[styles.dialog, styles.quickDialog]} accessibilityViewIsModal>
          <View style={styles.header}><Text style={styles.modalTitle}>Quick inserts</Text><Pressable onPress={close} style={styles.icon} accessibilityRole="button" accessibilityLabel="Close quick inserts"><Icon name="close" size={17} tint={c.muted} /></Pressable></View>
          {LOG_PROMPTS.map((label) => <Pressable key={label} onPress={() => template(label)} style={styles.quickRow} accessibilityRole="button" accessibilityLabel={`Insert ${label}`}><Icon name="text-outline" size={16} tint={c.accent} /><Text style={styles.quickText}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text></Pressable>)}
          {sections.length < MAX_LOG_SECTIONS ? <Pressable onPress={() => { setQuick(false); setEditor({ kind: "section", text: "" }) }} style={[styles.quickRow, styles.quickSection]} accessibilityRole="button" accessibilityLabel="Add daily log section"><Icon name="albums-outline" size={16} tint={c.accent} /><Text style={styles.quickText}>Add section</Text></Pressable> : null}
        </View> : <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.header}><Text style={styles.modalTitle}>{editor?.kind === "section" ? editor.id ? "Rename section" : "Add section" : editor?.legacy || items.some((item) => item.id === editor?.id) ? "Edit entry" : "Add entry"}</Text><Pressable disabled={saving} onPress={close} style={styles.icon} accessibilityRole="button" accessibilityLabel="Close log editor"><Icon name="close" size={17} tint={c.muted} /></Pressable></View>
          <TextInput autoFocus value={editor?.text ?? ""} editable={!saving} onChangeText={(text) => setEditor((value) => value ? { ...value, text } : null)} maxLength={editor?.kind === "section" ? MAX_SECTION_TITLE : 1_000_000} multiline={editor?.kind === "entry"} textAlignVertical="top" placeholder={editor?.kind === "section" ? "Section name" : "What happened?"} placeholderTextColor={c.muted} style={[styles.input, editor?.kind === "entry" && styles.notes]} accessibilityLabel={editor?.kind === "section" ? "Section name" : "Log entry"} />
          {editor?.kind === "entry" ? <Pressable disabled={saving} onPress={() => setEditor((value) => value?.kind === "entry" ? { ...value, asNote: !value.asNote } : value)} style={styles.noteToggle} accessibilityRole="checkbox" accessibilityState={{ checked: editor.asNote }} accessibilityLabel="Also save as a Note"><Icon name={editor.asNote ? "checkbox-outline" : "square-outline"} size={17} tint={editor.asNote ? c.accent : c.muted} /><Text style={styles.tabText}>Also save as a Note</Text></Pressable> : null}
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={styles.actions}><Pressable disabled={saving} onPress={close} style={styles.pill} accessibilityRole="button"><Text style={styles.tabText}>Cancel</Text></Pressable><Pressable disabled={saving || !editor?.text.trim()} onPress={() => void save()} style={[styles.pill, styles.selected]} accessibilityRole="button" accessibilityState={{ disabled: saving || !editor?.text.trim() }}><Text style={styles.actionText}>{saving ? "Saving…" : editor?.kind === "section" && !editor.id ? "Add" : "Save"}</Text></Pressable></View>
        </View>}
      </KeyboardAvoidingView>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  composer: { minHeight: 86, maxHeight: 160, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, color: c.text, backgroundColor: c.panel, fontSize: 13, lineHeight: 18, includeFontPadding: false },
  composeActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, savePill: { backgroundColor: c.action }, saveText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  quickDialog: { maxWidth: 230, gap: 2 }, quickRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, quickText: { color: c.text2, fontSize: 12 }, quickSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, marginTop: 4, paddingTop: 4 },
  root: { gap: 6 }, header: { flexDirection: "row", alignItems: "center", gap: 7 }, heading: { flex: 1, color: c.text, fontSize: 14, fontWeight: "600" },
  icon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 }, pill: { minHeight: 28, justifyContent: "center", paddingHorizontal: 11, borderRadius: 15, backgroundColor: c.panel },
  tabsRow: { flexDirection: "row", alignItems: "center" }, tabs: { flexDirection: "row", gap: 5 }, tab: { minHeight: 28, justifyContent: "center", paddingHorizontal: 10, borderRadius: 15, backgroundColor: c.panel },
  selected: { backgroundColor: c.selected }, tabText: { color: c.text2, fontSize: 11 }, actionText: { color: c.accent, fontSize: 11, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", minHeight: 35, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, rowText: { flex: 1, color: c.text2, fontSize: 12, lineHeight: 17 }, empty: { color: c.muted, fontSize: 11, paddingVertical: 9 },
  error: { color: "#ffa8a8", fontSize: 11 }, backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" }, dialog: { alignSelf: "center", width: "100%", maxWidth: 350, maxHeight: "80%", padding: 12, borderRadius: 17, gap: 9, backgroundColor: c.raised },
  modalTitle: { flex: 1, color: c.text, fontSize: 14, fontWeight: "600" }, input: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 8, color: c.text, backgroundColor: c.panel, borderRadius: 10, fontSize: 12 }, notes: { height: 76, maxHeight: 120, lineHeight: 17 }, noteToggle: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 28 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 7 },
})
