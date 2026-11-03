import { useState } from "react"
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { createTask, removeTask, updateTask, validDateKey, type Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Button, Icon, tone } from "../../ui.tsx"
import { DatePicker } from "./DatePicker.tsx"
import { formatDay } from "./dates.ts"
import { buildNewTask, buildPatch, draftErrors, draftFromTask, emptyDraft, resolveWithin, type TaskDraft } from "./task-form.ts"

/** What the sheet is doing: a new task (optionally pre-dated), or an existing task by id. */
export type Editor = { mode: "create"; due?: string } | { mode: "edit"; id: string }

/**
 * The task editor: a bottom sheet for adding and editing one task with the same fields as the
 * web's task form (title, details, due date, time, starred, done) and Delete with an in-sheet
 * confirm. Saving goes through the shared createTask / updateTask / removeTask rules. If the
 * save is refused the sheet stays open with everything still typed and shows the reason.
 * Mount it only while open (it takes its starting values when it mounts).
 */
export function TaskSheet({ editor, data, today, onClose }: { editor: Editor; data: Collections; today: string; onClose: () => void }) {
  const { mutate, message } = useWorkspace()
  const task = editor.mode === "edit" ? data.tasks.find((t) => t.id === editor.id) : undefined
  const [opened] = useState(() => !!task)
  const missing = editor.mode === "edit" && !opened
  const [start] = useState<TaskDraft>(() => (task ? draftFromTask(task) : emptyDraft(editor.mode === "create" ? (editor.due ?? "") : "")))
  const [draft, setDraft] = useState(start)
  const [showErrors, setShowErrors] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const set = (patch: Partial<TaskDraft>) => (setDraft((d) => ({ ...d, ...patch })), setFailed(false))
  const errors = showErrors ? draftErrors(draft) : {}
  // Deleted elsewhere while the sheet was open (not by this sheet's own Delete, which is `busy`).
  const gone = editor.mode === "edit" && opened && !task && !busy
  const dirty = JSON.stringify(draft) !== JSON.stringify(start)

  /** Runs one change; closes when it is on the phone (saved or queued), stays open if refused. */
  async function run(change: (d: Collections) => Collections) {
    if (busy) return
    setBusy(true)
    // A refusal comes back at once; only the network part is slow, and offline edits are queued.
    const ok = await resolveWithin(mutate(["tasks"], change), 1500, true)
    setBusy(false)
    setFailed(!ok)
    if (ok) onClose()
  }

  function save() {
    setShowErrors(true)
    if (Object.keys(draftErrors(draft)).length || gone) return
    const now = new Date().toISOString()
    if (task) void run((d) => updateTask(d, task.id, buildPatch(draft, task, now)))
    else void run((d) => createTask(d, buildNewTask(draft, now)).data)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={() => !dirty && onClose()} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {editor.mode === "edit" ? "Edit task" : "New task"}
            </Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} tint={color.text2} />
            </Pressable>
          </View>
          {missing ? (
            <View style={styles.body}>
              <Text style={styles.lead}>This task no longer exists. It may have been deleted on another device.</Text>
              <Button label="Close" onPress={onClose} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title</Text>
              <TextInput value={draft.title} onChangeText={(title) => set({ title })} placeholder="What needs doing?" placeholderTextColor={color.faint} accessibilityLabel="Title" autoFocus={editor.mode === "create"} style={styles.input} />
              {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

              <Text style={styles.label}>Details</Text>
              <TextInput value={draft.details} onChangeText={(details) => set({ details })} placeholder="Optional" placeholderTextColor={color.faint} accessibilityLabel="Details" multiline textAlignVertical="top" style={[styles.input, styles.multi]} />

              <Text style={styles.label}>Due date</Text>
              <Pressable onPress={() => setPickerOpen((v) => !v)} style={styles.input} accessibilityRole="button" accessibilityLabel={`Due date, ${validDateKey(draft.due) ? formatDay(draft.due) : "none"}`} accessibilityState={{ expanded: pickerOpen }}>
                <View style={styles.dateRow}>
                  <Text style={validDateKey(draft.due) ? styles.value : styles.placeholder}>{validDateKey(draft.due) ? formatDay(draft.due) : "No date"}</Text>
                  <Icon name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} tint={color.text2} />
                </View>
              </Pressable>
              {pickerOpen ? <DatePicker value={draft.due} today={today} onChange={(due) => set({ due })} /> : null}
              {errors.due ? <Text style={styles.error}>{errors.due}</Text> : null}

              {draft.due ? (
                <>
                  <Text style={styles.label}>Time (optional)</Text>
                  <TextInput value={draft.time} onChangeText={(time) => set({ time })} placeholder="HH:mm, like 18:30" placeholderTextColor={color.faint} accessibilityLabel="Time" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.input} />
                  {errors.time ? <Text style={styles.error}>{errors.time}</Text> : null}
                </>
              ) : null}

              <ToggleRow label="Starred" value={draft.starred} onChange={(starred) => set({ starred })} />
              {editor.mode === "edit" ? <ToggleRow label="Done" value={draft.done} onChange={(done) => set({ done })} /> : null}

              {gone ? <Text style={styles.error}>This task was deleted on another device, so it can't be saved. Close to discard your changes.</Text> : null}
              {failed ? <Text style={styles.error}>{message ?? "That couldn't be saved. Your changes are still here."}</Text> : null}
              <Button label={busy ? "Saving…" : editor.mode === "edit" ? "Save changes" : "Add task"} primary onPress={save} />
              {task && !confirming ? (
                <Pressable onPress={() => setConfirming(true)} style={styles.delete} accessibilityRole="button" accessibilityLabel="Delete task">
                  <Text style={styles.deleteText}>Delete task</Text>
                </Pressable>
              ) : null}
              {task && confirming ? (
                <View style={styles.confirm}>
                  <Text style={styles.lead}>Delete this task? This can't be undone.</Text>
                  <Pressable onPress={() => void run((d) => removeTask(d, task.id))} style={[styles.delete, styles.deleteSure]} accessibilityRole="button" accessibilityLabel="Yes, delete task">
                    <Text style={styles.deleteSureText}>Yes, delete</Text>
                  </Pressable>
                  <Button label="Keep it" onPress={() => setConfirming(false)} />
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.value}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: color.border, true: color.red }} thumbColor="#fff" />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "92%", backgroundColor: color.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: color.edge },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: color.border },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 4 },
  title: { color: color.text, fontSize: 18, fontWeight: "700" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
  label: { color: color.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.well, color: color.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, justifyContent: "center" },
  multi: { minHeight: 88 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { color: color.text, fontSize: 15 },
  placeholder: { color: color.faint, fontSize: 15 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  error: { color: color.errorText, fontSize: 13 },
  lead: { color: color.text2, fontSize: 14, lineHeight: 20 },
  confirm: { gap: 8 },
  delete: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  deleteText: { color: tone.red, fontSize: 15, fontWeight: "700" },
  deleteSure: { backgroundColor: color.red, borderColor: color.red },
  deleteSureText: { color: "#fff", fontSize: 15, fontWeight: "700" },
})
