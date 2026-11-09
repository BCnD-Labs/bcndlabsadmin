import { useEditorClose } from "../../../editing/useEditorClose.ts"
import { TextInput } from "../../../editing/keyboard.tsx"
import { useState } from "react"
import { Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { createNote, removeNote, setNoteTaskLinks, tasksOfNote, updateNote, type Collections } from "../../../../lib/shared.ts"
import { color, noteInk, notePaper } from "../../../../theme.ts"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { Button, Chip, Icon, tone } from "../../../ui.tsx"
import { resolveWithin } from "../task-form.ts"
import { CoursePicker } from "./CoursePicker.tsx"
import { SheetFrame } from "./SheetFrame.tsx"
import { buildNewNote, buildNotePatch, draftFromNote, emptyNoteDraft, noteDirty, noteErrors, type NoteDraft } from "./note-form.ts"
import { NOTE_COLORS, colorOf } from "./note-rules.ts"
import { plannerColor as c } from "../../../planner-theme.ts"

/** What the sheet is doing: a new note, or an existing note by id. */
export type NoteEditor = { mode: "create"; courseId?: string } | { mode: "edit"; id: string }

/**
 * The note editor: a bottom sheet with the web note form's fields (text, colour, pinned, course) and
 * Delete with an in-sheet confirm. Saving goes through the shared createNote / updateNote / removeNote
 * rules. If the save is refused the sheet stays open with everything still typed and shows the reason.
 * Links are listed read-only. Mount it only while open (it takes its starting values when it mounts).
 */
export function NoteSheet({ editor, data, onClose, compact = false }: { editor: NoteEditor; data: Collections; onClose: () => void; compact?: boolean }) {
  const { mutate, message } = useWorkspace()
  const note = editor.mode === "edit" ? data.notes.find((n) => n.id === editor.id) : undefined
  const [opened] = useState(() => !!note)
  const [start] = useState<NoteDraft>(() => (note ? draftFromNote(note, tasksOfNote({ tasks: data.tasks }, note.id).map(t => t.id)) : { ...emptyNoteDraft(), ...(editor.mode === "create" && editor.courseId && { courseId: editor.courseId }) }))
  const [draft, setDraft] = useState(start)
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(false)
  const set = (patch: Partial<NoteDraft>) => (setDraft((d) => ({ ...d, ...patch })), setFailed(false))
  const errors = showErrors ? noteErrors(draft) : {}
  const missing = editor.mode === "edit" && !opened
  // Deleted elsewhere while the sheet was open (not by this sheet's own Delete, which is `busy`).
  const gone = editor.mode === "edit" && opened && !note && !busy
  const dirty = noteDirty(draft, start)

  /** Runs one change; closes when it is on the phone (saved or queued), stays open if refused. */
  async function run(change: (d: Collections) => Collections, closeAfter = true, withTasks = false): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    let ok = false
    try { ok = await resolveWithin(mutate(withTasks ? ["notes", "tasks"] : ["notes"], change), 1500, true) } catch { ok = false }
    setBusy(false)
    setFailed(!ok)
    if (ok && closeAfter) onClose()
    return ok
  }

  async function save(closeAfter = true): Promise<boolean> {
    setShowErrors(true)
    if (Object.keys(noteErrors(draft)).length || gone) return false
    const now = new Date().toISOString()
    // The links live on the tasks, so a save that changes them edits those tasks in the same step.
    const touchesTasks = JSON.stringify(draft.taskIds) !== JSON.stringify(start.taskIds)
    if (note) return run((d) => { const next = updateNote(d, note.id, buildNotePatch(draft, start)); return touchesTasks ? { ...next, ...setNoteTaskLinks(next, note.id, draft.taskIds, now) } : next }, closeAfter, touchesTasks)
    return run((d) => { const made = createNote(d, buildNewNote(draft)); return draft.taskIds.length ? { ...made.data, ...setNoteTaskLinks(made.data, made.record.id, draft.taskIds, now) } : made.data }, closeAfter, draft.taskIds.length > 0)
  }

  const close = useEditorClose(dirty, busy, onClose, () => save(false))
  return (
    <SheetFrame title={editor.mode === "edit" ? "Edit note" : "New note"} onClose={() => close()} onBackdrop={() => close()} compact={compact}>
      {(expanded) => <>
      {missing ? (
        <>
          <Text style={styles.lead}>This note no longer exists. It may have been deleted on another device.</Text>
          <Button label="Close" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={styles.label}>Note</Text>
          <TextInput value={draft.text} onChangeText={(text) => set({ text })} placeholder="Jot something down…" placeholderTextColor={color.faint} accessibilityLabel="Note" multiline textAlignVertical="top" style={[styles.input, compact ? styles.compactMulti : styles.multi, compact && (expanded || editor.mode === "edit") && styles.largeMulti, expanded && styles.expandedMulti]} />
          {errors.text ? <Text style={styles.error}>{errors.text}</Text> : null}

          {compact ? <Pressable onPress={() => setMore(v => !v)} style={styles.more} accessibilityRole="button" accessibilityLabel={more ? "Fewer note properties" : "More note properties"} accessibilityState={{ expanded: more }}><Text style={styles.moreText}>{more ? "− Fewer properties" : "+ More properties"}</Text></Pressable> : null}
          {!compact || more ? <>
          <Text style={styles.label}>Colour</Text>
          <View style={styles.swatches}>
            {NOTE_COLORS.map((c) => {
              const on = colorOf(draft.color) === c.value
              return (
                <Pressable key={c.value} onPress={() => set({ color: c.value })} style={[styles.swatchHit, on && styles.swatchOn]} accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ selected: on }}>
                  <View style={[styles.swatch, { backgroundColor: notePaper[c.value] }]}>{on ? <Icon name="checkmark" size={18} tint={noteInk} /> : null}</View>
                </Pressable>
              )
            })}
          </View>

          {data.courses.length > 0 || draft.courseId ? (
            <>
              <Text style={styles.label}>Course</Text>
              <CoursePicker courses={data.courses} value={draft.courseId} onChange={(courseId) => set({ courseId })} />
            </>
          ) : null}

          {data.courses.find(x => x.id === draft.courseId)?.topics?.length ? <>
            <Text style={styles.label}>Module</Text>
            <View style={styles.chips}>{data.courses.find(x => x.id === draft.courseId)!.topics!.map(m => <Chip key={m.id} label={m.title} active={draft.topicIds.includes(m.id)} onPress={() => set({ topicIds: draft.topicIds.includes(m.id) ? draft.topicIds.filter(x => x !== m.id) : [...draft.topicIds, m.id] })} />)}</View>
          </> : null}

          <Text style={styles.label}>Linked work</Text>
          <Text style={styles.hint}>Assignments, quizzes, exams or tasks this note is for. They show the note too.</Text>
          <View style={styles.chips}>
            {draft.taskIds.map(id => <Chip key={id} label={`${data.tasks.find(t => t.id === id)?.title ?? "Deleted task"} ✕`} active onPress={() => set({ taskIds: draft.taskIds.filter(x => x !== id) })} />)}
            {data.tasks.filter(t => t.kind !== "event" && !draft.taskIds.includes(t.id)).sort((a, b) => Number(b.courseId === draft.courseId) - Number(a.courseId === draft.courseId) || Number(a.done) - Number(b.done)).slice(0, 10).map(t => <Chip key={t.id} label={`+ ${t.title}`} active={false} onPress={() => set({ taskIds: [...draft.taskIds, t.id] })} />)}
          </View>

          <View style={styles.toggle}>
            <Text style={styles.value}>Pin to Home</Text>
            <Switch value={draft.pinned} onValueChange={(pinned) => set({ pinned })} accessibilityLabel="Pin to Home" trackColor={{ false: color.border, true: compact ? c.action : color.red }} thumbColor={color.text} />
          </View>

          {note?.links?.length ? (
            <>
              <Text style={styles.label}>Linked documents</Text>
              {note.links.map((l, i) => (
                <View key={`${l.url}${i}`} style={styles.link}>
                  <Icon name="link-outline" size={16} tint={color.muted} />
                  <Text style={styles.linkText} numberOfLines={1}>
                    {l.label || l.url}
                  </Text>
                </View>
              ))}
              <Text style={styles.hint}>Links open from the web app.</Text>
            </>
          ) : null}
          </> : null}

          {gone ? <Text style={styles.error}>This note was deleted on another device, so it can't be saved. Close to discard your changes.</Text> : null}
          {failed ? <Text style={styles.error}>{message ?? "That couldn't be saved. Your changes are still here."}</Text> : null}
          {compact ? <Pressable onPress={() => void save()} disabled={busy || gone} style={[styles.compactSave, (busy || gone) && styles.disabled]} accessibilityRole="button" accessibilityLabel={editor.mode === "edit" ? "Save changes" : "Add note"}><Icon name="checkmark" size={14} tint="#fff" /><Text style={styles.compactSaveText}>{busy ? "Saving…" : editor.mode === "edit" ? "Save changes" : "Add note"}</Text></Pressable> : <Button label={busy ? "Saving…" : editor.mode === "edit" ? "Save changes" : "Add note"} primary onPress={() => void save()} />}
          {note && (!compact || more) && !confirming ? (
            <Pressable onPress={() => setConfirming(true)} style={styles.delete} accessibilityRole="button" accessibilityLabel="Delete note">
              <Text style={styles.deleteText}>Delete note</Text>
            </Pressable>
          ) : null}
          {note && confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.lead}>Delete this note? This can't be undone.</Text>
              <Pressable onPress={() => void run((d) => removeNote(d, note.id))} style={[styles.delete, styles.deleteSure]} accessibilityRole="button" accessibilityLabel="Yes, delete note">
                <Text style={styles.deleteSureText}>Yes, delete</Text>
              </Pressable>
              <Button label="Keep it" onPress={() => setConfirming(false)} />
            </View>
          ) : null}
        </>
      )}
      </>}
    </SheetFrame>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  label: { color: color.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, color: color.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  multi: { minHeight: 140 },
  compactMulti: { minHeight: 88, maxHeight: 180, borderRadius: 0, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, backgroundColor: c.panel, paddingHorizontal: 2, paddingTop: 8, fontSize: 13, lineHeight: 19 },
  largeMulti: { minHeight: 200, maxHeight: 300 }, expandedMulti: { minHeight: 280, maxHeight: 460 },
  more: { minHeight: 32, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 }, moreText: { color: c.accent, fontSize: 12 }, compactSave: { minHeight: 32, borderRadius: 15, backgroundColor: c.action, alignSelf: "flex-end", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5 }, compactSaveText: { color: "#fff", fontSize: 12, fontWeight: "600" }, disabled: { opacity: 0.45 },
  swatches: { flexDirection: "row", gap: 10 },
  swatchHit: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  swatchOn: { borderColor: color.text },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  value: { color: color.text, fontSize: 15 },
  link: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  linkText: { flex: 1, color: color.text2, fontSize: 14 },
  hint: { color: color.faint, fontSize: 12 },
  error: { color: color.errorText, fontSize: 13 },
  lead: { color: color.text2, fontSize: 14, lineHeight: 20 },
  confirm: { gap: 8 },
  delete: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  deleteText: { color: tone.red, fontSize: 15, fontWeight: "700" },
  deleteSure: { backgroundColor: color.red, borderColor: color.red },
  deleteSureText: { color: color.text, fontSize: 15, fontWeight: "700" },
})

