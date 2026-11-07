import { useEditorClose } from "../../../editing/useEditorClose.ts"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../../../editing/keyboard.tsx"
import { shape } from "../../../../shape.ts"
import { useRef, useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { saveJournalItem, saveJournalLegacyText, saveJournalSections, type Collections } from "../../../../lib/shared.ts"
import { MAX_LOG_SECTIONS, MAX_SECTION_TITLE } from "../../../../../../blackwall-admin/shared/journal-sections.ts"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import { formatDay } from "../dates.ts"
import { appendPrompt, LOG_PROMPTS, shownText } from "./log-rules.ts"
import type { EntryDraft, LogDrafts } from "./useLogDrafts.ts"

type Item = NonNullable<Collections["journal"][number]["entries"]>[number]
type Compose = { kind: "entry"; day: string; id: string; text: string; sectionId?: string; legacy?: boolean; initialAsNote: boolean; asNote: boolean; noteId: string; createdAt: string; initialText: string }
type Naming = { kind: "section"; id?: string; text: string; initialText: string }
type Editor = Compose | Naming
const newId = () => `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** Compact dated entry list. Legacy main/section text remains editable without a migration. */
export function DailyLogEditor({ data, day, logs, blocked, heading = "Log", embedded = false }: { data: Collections; day: string; logs: LogDrafts; blocked?: string; heading?: string; /** Inside a panel that already shows the title: only the quick-insert button remains. */ embedded?: boolean }) {
  const { mutate } = useWorkspace()
  const active = logs.activeSections[day] ?? null
  const setActive = (id: string | null) => logs.setActiveSections(current => ({ ...current, [day]: id }))
  const [editor, setEditor] = useState<Editor | null>(null)
  const [quick, setQuick] = useState(false)
  const [closed, setClosed] = useState<Record<string, true>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const sections = logs.shownSections(day)
  const selected = sections.find((section) => section.id === active)
  const journal = data.journal.find((entry) => entry.id === day)
  const legacyText = selected ? selected.text : shownText(logs.drafts, data.journal, day)
  const items = (journal?.entries ?? []).filter((entry) => (entry.sectionId ?? null) === active && !entry.id.startsWith("journal-") && !entry.courseId && !entry.taskId)
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
    setEditor({ kind: "entry", day, id, text: item?.text ?? (legacy ? legacyText : ""), sectionId: selected?.id, legacy, asNote: !!(item?.noteId ?? (legacy ? (selected ? selected.noteId : journal?.mainNoteId) : undefined)), initialAsNote: !!(item?.noteId ?? (legacy ? (selected ? selected.noteId : journal?.mainNoteId) : undefined)), noteId, createdAt: item?.createdAt ?? new Date().toISOString(), initialText: item?.text ?? (legacy ? legacyText : "") })
  }
  function dismiss() { setEditor(null); setQuick(false); setError(null) }
  async function save(closeAfter = true): Promise<boolean> {
    if (!editor?.text.trim() || busy.current) return false
    if (blocked) { setError(blocked); return false }
    const value = editor
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      if (value.kind === "section") {
        if (!value.id && sections.length >= MAX_LOG_SECTIONS) return false
        const id = value.id ?? newId(), title = value.text.trim()
        const ok = await mutate(["journal"], current => { const stored = current.journal.find(entry => entry.id === day)?.sections ?? []; if (value.id && !stored.some(section => section.id === id)) throw Error("Section removed"); if (!value.id && stored.length >= MAX_LOG_SECTIONS) throw Error("Section limit reached"); return saveJournalSections(current, day, value.id ? stored.map(section => section.id === id ? { ...section, title } : section) : [...stored, { id, title, text: "" }]) })
        if (!ok) { setError("Couldn't save this section. Try again."); return false }
        setActive(id)
      } else {
        if (value.sectionId && !data.journal.find(entry => entry.id === value.day)?.sections?.some(section => section.id === value.sectionId)) {
          setError("This section has not saved yet. Try again in a moment."); return false
        }
        const ok = await mutate(["journal", "notes"], current => value.legacy
          ? saveJournalLegacyText(current, value.day, value.sectionId, value.text, value.asNote, value.noteId)
          : saveJournalItem(current, value.day, { id: value.id, text: value.text, sectionId: value.sectionId, noteId: value.asNote ? value.noteId : undefined, createdAt: value.createdAt, updatedAt: new Date().toISOString() }, value.asNote))
        if (!ok) { setError("Couldn't save. Your entry is kept here; try again."); return false }
        if (value.legacy) logs.acknowledgeLegacy(value.day, value.sectionId, value.initialText, value.text, value.asNote ? value.noteId : undefined)
      }
      if (closeAfter) dismiss()
      return true
    } catch { setError("Couldn't save. Your entry is kept here; try again."); return false }
    finally { busy.current = false; setSaving(false) }
  }
  const dirty = !!editor && (editor.text !== editor.initialText || (editor.kind === "entry" && editor.asNote !== editor.initialAsNote))
  const close = useEditorClose(dirty, saving, dismiss, () => save(false))

  const row = (key: string, text: string, note: boolean, onPress: () => void) => <Pressable key={key} onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`Edit reflection: ${text}`}>
    <Icon name={note ? "document-text-outline" : "ellipse-outline"} size={13} tint={c.muted} />
    <Text style={styles.rowText} numberOfLines={2}>{text}</Text>
  </Pressable>

  function toggleSection(id: string | null) {
    const key = `${day}/${id ?? ""}`
    if (active === id && !closed[key]) setClosed(current => ({ ...current, [key]: true }))
    else { setClosed(current => { const next = { ...current }; delete next[key]; return next }); setActive(id) }
  }

  return <View style={styles.root}>
    <View style={styles.header}>{embedded ? <Text style={styles.heading}>Entries for this day</Text> : <><Icon name="create-outline" tint={c.text2} size={17} /><Text style={styles.heading} accessibilityRole="header">{heading}</Text></>}
      <Pressable disabled={!!blocked || saving} onPress={() => { setError(null); setQuick(true) }} style={styles.icon} accessibilityRole="button" accessibilityLabel="Reflection quick inserts"><Icon name="add" tint={c.accent} size={19} /></Pressable>
    </View>
    {error && !editor && !quick ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    {[{ id: null, title: embedded ? "Entries" : heading, text: shownText(logs.drafts, data.journal, day), noteId: journal?.mainNoteId }, ...sections].map(section => {
      const entries = (journal?.entries ?? []).filter(entry => (entry.sectionId ?? null) === section.id && !entry.id.startsWith("journal-") && !entry.courseId && !entry.taskId)
      const expanded = active === section.id && !closed[`${day}/${section.id ?? ""}`]
      const count = entries.length + Number(!!section.text.trim())
      return <View key={section.id ?? "main"} style={styles.group}>
        <View style={styles.groupHeader}>
          <Pressable onPress={() => toggleSection(section.id)} style={styles.groupButton} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${section.title}, ${count} entries`}>
            <Text style={styles.groupTitle} numberOfLines={2}>{section.title}</Text><Text style={styles.groupCount}>{count}</Text><Icon name={expanded ? "chevron-up" : "chevron-down"} size={17} tint={c.muted} />
          </Pressable>
          {section.id ? <Pressable disabled={!!blocked} onPress={() => { setActive(section.id); setError(null); setEditor({ kind: "section", id: section.id!, text: section.title, initialText: section.title }) }} style={styles.icon} accessibilityRole="button" accessibilityLabel={`Rename ${section.title}`}><Icon name="pencil-outline" tint={c.muted} size={14} /></Pressable> : null}
        </View>
        {expanded ? <>
          <TextInput value={draft?.text ?? ""} editable={!saving && !blocked} onChangeText={(text) => changeDraft((value) => ({ ...value, text }))} multiline textAlignVertical="top" maxLength={1_000_000} placeholder="What happened today?" placeholderTextColor={c.muted} style={styles.composer} accessibilityLabel={`New ${section.title} entry`} />
          {draft?.text.trim() ? <View style={styles.composeActions}>
            <Pressable disabled={saving} onPress={() => changeDraft((value) => ({ ...value, asNote: !value.asNote }))} style={styles.noteToggle} accessibilityRole="checkbox" accessibilityState={{ checked: draft.asNote }} accessibilityLabel="Also save as a Note"><Icon name={draft.asNote ? "checkbox-outline" : "square-outline"} size={17} tint={draft.asNote ? c.accent : c.muted} /><Text style={styles.tabText}>Save as Note</Text></Pressable>
            <Pressable disabled={saving || !!blocked} onPress={() => void saveInline()} style={[styles.pill, styles.savePill]} accessibilityRole="button" accessibilityLabel="Save entry"><Text style={styles.saveText}>{saving ? "Saving…" : "Save entry"}</Text></Pressable>
          </View> : null}
          {section.text.trim() ? row("legacy", section.text, !!section.noteId, () => open(undefined, true)) : null}
          {entries.map(item => row(item.id, item.text, !!item.noteId, () => open(item)))}
          {!count ? <Text style={styles.empty}>No entries for this {section.id ? "section" : "day"}.</Text> : null}
        </> : null}
      </View>
    })}
    {logs.failed[day] ? <Text style={styles.error}>Section changes haven't saved yet. <Text onPress={() => void logs.save(day)}>Try again</Text></Text> : null}
    <Modal visible={!!editor || quick} transparent animationType="fade" onRequestClose={() => close()}>
      <KeyboardFrame style={styles.backdrop}>
        {quick ? <View style={[styles.dialog, styles.quickDialog]} accessibilityViewIsModal>
          <View style={styles.header}><Text style={[styles.modalTitle, styles.grow]}>Quick inserts</Text><Pressable onPress={() => close()} style={styles.icon} accessibilityRole="button" accessibilityLabel="Close quick inserts"><Icon name="close" size={17} tint={c.muted} /></Pressable></View>
          {LOG_PROMPTS.map((label) => <Pressable key={label} onPress={() => template(label)} style={styles.quickRow} accessibilityRole="button" accessibilityLabel={`Insert ${label}`}><Icon name="text-outline" size={16} tint={c.accent} /><Text style={styles.quickText}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text></Pressable>)}
          {sections.length < MAX_LOG_SECTIONS ? <Pressable onPress={() => { setQuick(false); setEditor({ kind: "section", text: "", initialText: "" }) }} style={[styles.quickRow, styles.quickSection]} accessibilityRole="button" accessibilityLabel="Add reflection section"><Icon name="albums-outline" size={16} tint={c.accent} /><Text style={styles.quickText}>Add section</Text></Pressable> : null}
        </View> : <View style={[styles.dialog, editor?.kind === "entry" && styles.entryDialog]} accessibilityViewIsModal>
          <View style={styles.header}><View style={styles.titleBox}><Text style={styles.modalTitle}>{editor?.kind === "section" ? editor.id ? "Rename section" : "Add section" : editor?.legacy || items.some((item) => item.id === editor?.id) ? "Edit entry" : "Add entry"}</Text>{editor?.kind === "entry" ? <Text style={styles.modalSub} numberOfLines={1}>{`${formatDay(editor.day)} · ${sections.find((section) => section.id === editor.sectionId)?.title ?? "Reflections"}`}</Text> : null}</View><Pressable disabled={saving} onPress={() => close()} style={styles.icon} accessibilityRole="button" accessibilityLabel="Close reflection editor"><Icon name="close" size={17} tint={c.muted} /></Pressable></View>
          <KeyboardScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 9 }}>
          <TextInput value={editor?.text ?? ""} editable={!saving} onChangeText={(text) => setEditor((value) => value ? { ...value, text } : null)} maxLength={editor?.kind === "section" ? MAX_SECTION_TITLE : 1_000_000} multiline={editor?.kind === "entry"} textAlignVertical="top" placeholder={editor?.kind === "section" ? "Section name" : "What happened?"} placeholderTextColor={c.muted} style={[styles.input, editor?.kind === "entry" && styles.notes]} accessibilityLabel={editor?.kind === "section" ? "Section name" : "Log entry"} />
          {editor?.kind === "entry" ? <Pressable disabled={saving} onPress={() => setEditor((value) => value?.kind === "entry" ? { ...value, asNote: !value.asNote } : value)} style={styles.noteToggle} accessibilityRole="checkbox" accessibilityState={{ checked: editor.asNote }} accessibilityLabel="Also save as a Note"><Icon name={editor.asNote ? "checkbox-outline" : "square-outline"} size={17} tint={editor.asNote ? c.accent : c.muted} /><Text style={styles.tabText}>Also save as a Note</Text></Pressable> : null}
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          </KeyboardScrollView>
          <View style={styles.actions}><Pressable disabled={saving} onPress={() => close()} style={styles.pill} accessibilityRole="button"><Text style={styles.tabText}>Cancel</Text></Pressable><Pressable disabled={saving || !editor?.text.trim()} onPress={() => void save()} style={[styles.pill, styles.selected]} accessibilityRole="button" accessibilityState={{ disabled: saving || !editor?.text.trim() }}><Text style={styles.actionText}>{saving ? "Saving…" : editor?.kind === "section" && !editor.id ? "Add" : "Save"}</Text></Pressable></View>
        </View>}
      </KeyboardFrame>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  composer: { minHeight: 86, maxHeight: 160, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, color: c.text, backgroundColor: c.panel, fontSize: 13, lineHeight: 18, includeFontPadding: false },
  composeActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, savePill: { backgroundColor: c.action }, saveText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  quickDialog: { maxWidth: 230, gap: 2 }, quickRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, quickText: { color: c.text2, fontSize: 12 }, quickSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, marginTop: 4, paddingTop: 4 },
  root: { gap: 6 }, header: { flexDirection: "row", alignItems: "center", gap: 7 }, heading: { flex: 1, color: c.text, fontSize: 14, fontWeight: "600" },
  icon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 14 }, pill: { minHeight: 32, justifyContent: "center", paddingHorizontal: 11, borderRadius: 15, backgroundColor: c.panel },
  group: { gap: 5 }, groupHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, groupButton: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }, groupTitle: { flex: 1, color: c.text, fontSize: 13, fontWeight: "700" }, groupCount: { color: c.muted, fontSize: 11 },
  selected: { backgroundColor: c.selected }, tabText: { color: c.text2, fontSize: 11 }, actionText: { color: c.accent, fontSize: 11, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", minHeight: 35, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, rowText: { flex: 1, color: c.text2, fontSize: 12, lineHeight: 17 }, empty: { color: c.muted, fontSize: 11, paddingVertical: 9 },
  error: { color: "#ffa8a8", fontSize: 11 }, backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" }, dialog: { alignSelf: "center", width: "100%", maxWidth: 350, maxHeight: "80%", padding: 12, borderRadius: shape.dialog, gap: 9, backgroundColor: c.raised },
  modalTitle: { color: c.text, fontSize: 14, fontWeight: "600" }, input: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 8, color: c.text, backgroundColor: c.panel, borderRadius: 10, fontSize: 12 }, notes: { minHeight: 220, maxHeight: 360, lineHeight: 19, fontSize: 13, paddingTop: 10 }, entryDialog: { maxWidth: 520 }, titleBox: { flex: 1, gap: 1 }, grow: { flex: 1 }, modalSub: { color: c.muted, fontSize: 11 }, noteToggle: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 32 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 7 },
})

