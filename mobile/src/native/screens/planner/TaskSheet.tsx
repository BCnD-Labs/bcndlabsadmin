import { useState } from "react"
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { createTask, removeTask, updateTask, validDateKey, type Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { useReduceMotion } from "../../nav/useReduceMotion.ts"
import { Button, Icon, tone } from "../../ui.tsx"
import { CourseSection } from "./CourseSection.tsx"
import { DatePicker } from "./DatePicker.tsx"
import { LinksSection } from "./LinksSection.tsx"
import { RecordLinksSection } from "./RecordLinksSection.tsx"
import { ReflectionSection } from "./ReflectionSection.tsx"
import { ScheduleSection } from "./ScheduleSection.tsx"
import { formatDay } from "./dates.ts"
import { Section, ToggleRow, shared } from "./sheet-parts.tsx"
import { emptyExtras, errorSection, type Extras } from "./task-extras.ts"
import { buildNewTask, buildPatch, draftErrors, draftFromTask, emptyDraft, resolveWithin, type TaskDraft } from "./task-form.ts"
import { learningSummary, linksSummary, recordsSummary, reflectionSummary, scheduleSummary } from "./task-summary.ts"
import { undoDelete, type UndoAction } from "./task-undo.ts"
import { offerUndo } from "./undo-snack.ts"

/** What the sheet is doing: a new task (optionally pre-dated), or an existing task by id. */
export type Editor = { mode: "create"; due?: string; kind?: "task" | "event"; courseId?: string; learningType?: NonNullable<Collections["tasks"][number]["learningType"]> } | { mode: "edit"; id: string }
type SectionKey = "schedule" | "learning" | "reflection" | "links" | "records"

/**
 * A contextual dialog for adding and editing one task. The first block is the web
 * form's plain fields (title, details, due date, time, starred, done); below are collapsible
 * sections for the rest of what the web has: Schedule (planned date, time, duration, focus today),
 * Learning (course, type, score), Reflection, Linked documents and Linked records. Saving goes
 * through the shared createTask / updateTask / removeTask rules, and an edit writes only what you
 * changed. If the save is refused the sheet stays open with everything still typed and shows the
 * reason. Mount it only while open (it takes its starting values when it mounts).
 */
export function TaskSheet({ editor, data, today, onClose, embedded = false }: { editor: Editor; data: Collections; today: string; onClose: () => void; embedded?: boolean }) {
  const { mutate, message } = useWorkspace()
  const reduceMotion = useReduceMotion()
  const [expanded, setExpanded] = useState(false)
  const task = editor.mode === "edit" ? data.tasks.find((t) => t.id === editor.id) : undefined
  const [opened] = useState(() => !!task)
  const missing = editor.mode === "edit" && !opened
  const [start] = useState<TaskDraft>(() => (task ? draftFromTask(task) : editor.mode === "create" ? { ...emptyDraft(editor.due ?? (editor.kind === "event" ? today : ""), editor.kind), ...(editor.courseId && { extras: { ...emptyExtras(), courseId: editor.courseId, learningType: editor.learningType ?? "assignment" } }) } : emptyDraft()))
  const [draft, setDraft] = useState(start)
  const [showErrors, setShowErrors] = useState(false)
  const [compactDate, setCompactDate] = useState(false)
  const [compactTime, setCompactTime] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openSection, setOpenSection] = useState<SectionKey | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const set = (patch: Partial<TaskDraft>) => (setDraft((d) => ({ ...d, ...patch })), setFailed(false))
  const x = draft.extras ?? emptyExtras()
  const event = draft.kind === "event"
  const noun = event ? "event" : "task"
  const setX = (patch: Partial<Extras>) => set({ extras: { ...(draft.extras ?? emptyExtras()), ...patch } })
  const errors = showErrors ? draftErrors(draft, task ? start : undefined) : {}
  // Deleted elsewhere while the sheet was open (not by this sheet's own Delete, which is `busy`).
  const gone = editor.mode === "edit" && opened && !task && !busy
  const dirty = JSON.stringify(draft) !== JSON.stringify(start)
  const toggleSection = (key: SectionKey) => setOpenSection((s) => (s === key ? null : key))

  /** Runs one change; closes when it is on the phone (saved or queued), stays open if refused. A delete offers Undo. */
  async function run(change: (d: Collections) => Collections, undo?: UndoAction) {
    if (busy) return
    setBusy(true)
    // A refusal comes back at once; only the network part is slow, and offline edits are queued.
    const ok = await resolveWithin(mutate(["tasks"], change), 1500, true)
    setBusy(false)
    setFailed(!ok)
    if (!ok) return
    if (undo) offerUndo(undo, mutate)
    onClose()
  }

  function save() {
    setShowErrors(true)
    const found = draftErrors(draft, task ? start : undefined)
    if (Object.keys(found).length || gone) {
      const section = errorSection(found)
      if (section) { setOpenSection(section); setExpanded(true) }
      return
    }
    const now = new Date().toISOString()
    if (task) void run((d) => updateTask(d, task.id, buildPatch(draft, task, now)))
    else void run((d) => createTask(d, buildNewTask(draft, now)).data)
  }

  const content = (
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={() => !dirty && onClose()} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight: expanded ? "92%" : "62%" }]} accessibilityViewIsModal>
          <View style={styles.header}>
            {expanded ? <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{draft.title || `New ${noun}`}</Text> : <TextInput value={draft.title} onChangeText={title => set({ title })} placeholder={`New ${noun}`} placeholderTextColor={c.muted} accessibilityLabel="Title" multiline style={[styles.title, styles.compactTitle]} /> }
            <Pressable onPress={() => setExpanded(v => !v)} style={styles.close} accessibilityRole="button" accessibilityLabel={expanded ? "Compact editor" : "Expand editor"} accessibilityState={{ expanded }}>
              <Icon name={expanded ? "contract-outline" : "expand-outline"} size={19} tint={c.muted} />
            </Pressable>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} tint={c.muted} />
            </Pressable>
          </View>
          {missing ? (
            <View style={styles.body}>
              <Text style={styles.lead}>This task no longer exists. It may have been deleted on another device.</Text>
              <Button label="Close" onPress={onClose} />
            </View>
          ) : !expanded ? (
            <View style={styles.compactBody}>
              {errors.title ? <Text style={shared.error}>{errors.title}</Text> : null}
              <View style={styles.properties}>
                <Pressable style={styles.property} onPress={() => event ? setExpanded(true) : set({ done: !draft.done })} accessibilityRole="button" accessibilityLabel={event ? "Event properties" : draft.done ? "Reopen task" : "Complete task"}><Icon name={event ? "calendar-outline" : draft.done ? "checkbox-outline" : "square-outline"} size={16} tint={c.accent} /><Text style={styles.propertyText}>{event ? "Event" : draft.done ? "Done" : "To do"}</Text></Pressable>
                <Pressable style={[styles.property, { backgroundColor: c.dateFill }]} onPress={() => setCompactDate(v => !v)} accessibilityRole="button" accessibilityLabel={event ? "Event date" : "Due date"}><Icon name="calendar-clear-outline" size={15} tint={c.dateText} /><Text style={[styles.propertyText, { color: c.dateText }]}>{(event ? x.scheduledDate : draft.due) ? formatDay(event ? x.scheduledDate : draft.due) : "+ Date"}</Text></Pressable>
                {event ? <Pressable style={styles.property} onPress={() => setCompactTime(v => !v)} accessibilityRole="button" accessibilityLabel="Event start time"><Icon name="time-outline" size={15} tint={c.muted} /><Text style={styles.propertyText}>{x.scheduledTime || "+ Time"}</Text></Pressable> : null}
                {x.courseId ? <Pressable style={[styles.property, { backgroundColor: c.tagFill }]} onPress={() => { setExpanded(true); setOpenSection("learning") }} accessibilityRole="button" accessibilityLabel={`Learning link: ${learningSummary(x, data.courses)}`}><Icon name="school-outline" size={15} tint={c.tagText} /><Text style={[styles.propertyText, { color: c.tagText }]} numberOfLines={1}>{learningSummary(x, data.courses)}</Text></Pressable> : null}
                <Pressable style={styles.moreProperty} onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel="More properties"><Text style={styles.propertyText}>+ More</Text></Pressable>
              </View>
              {compactDate ? <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled"><DatePicker value={event ? x.scheduledDate : draft.due} today={today} onChange={date => { if (event) setX({ scheduledDate: date }); else set({ due: date }); setCompactDate(false) }} /></ScrollView> : null}
              {compactTime ? <TextInput value={x.scheduledTime} onChangeText={scheduledTime => setX({ scheduledTime })} placeholder="HH:mm" placeholderTextColor={c.muted} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Event start time" style={[shared.input, styles.input]} /> : null}
              <TextInput value={draft.details} onChangeText={details => set({ details })} placeholder="Add notes or details…" placeholderTextColor={c.muted} accessibilityLabel="Details" multiline textAlignVertical="top" style={styles.compactDetails} />
              {x.recordLinks.length ? <Pressable style={styles.linkedRow} onPress={() => { setExpanded(true); setOpenSection("records") }} accessibilityRole="button" accessibilityLabel="Open linked records"><Icon name="return-down-forward-outline" size={16} tint={c.muted} /><Text style={styles.propertyText}>{recordsSummary(x)}</Text></Pressable> : null}
              {failed || gone ? <Text style={shared.error}>{gone ? "This item was deleted on another device." : message ?? "That couldn't be saved. Your changes are still here."}</Text> : null}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.kinds} accessibilityRole="radiogroup">
                {(["task", "event"] as const).map(kind => <Pressable key={kind} style={[styles.kind, (draft.kind ?? "task") === kind && styles.kindOn]} onPress={() => set({ kind, ...(kind === "event" && { extras: { ...x, scheduledDate: x.scheduledDate || draft.due || today, scheduledTime: x.scheduledTime || draft.time } }) })} accessibilityRole="radio" accessibilityLabel={kind === "event" ? "Calendar event" : "Task"} accessibilityState={{ checked: (draft.kind ?? "task") === kind }}><Icon name={kind === "event" ? "calendar-outline" : "checkbox-outline"} size={17} tint={(draft.kind ?? "task") === kind ? c.accent : color.muted} /><Text style={[styles.kindText, (draft.kind ?? "task") === kind && styles.kindTextOn]}>{kind === "event" ? "Event" : "Task"}</Text></Pressable>)}
              </View>
              <Text style={shared.label}>Title</Text>
              <TextInput value={draft.title} onChangeText={(title) => set({ title })} placeholder={event ? "What's happening?" : "What needs doing?"} placeholderTextColor={c.muted} accessibilityLabel="Title" autoFocus={editor.mode === "create"} style={[shared.input, styles.input]} />
              {errors.title ? <Text style={shared.error}>{errors.title}</Text> : null}

              <Text style={shared.label}>Details</Text>
              <TextInput value={draft.details} onChangeText={(details) => set({ details })} placeholder="Add notes or details…" placeholderTextColor={c.muted} accessibilityLabel="Details" multiline style={[shared.input, shared.multi, styles.input, styles.details]} />

              {!event ? <><Text style={shared.label}>Due date</Text>
              <Pressable onPress={() => setPickerOpen((v) => !v)} style={[shared.input, styles.input]} accessibilityRole="button" accessibilityLabel={`Due date, ${validDateKey(draft.due) ? formatDay(draft.due) : "none"}`} accessibilityState={{ expanded: pickerOpen }}>
                <View style={shared.dateRow}>
                  <Text style={validDateKey(draft.due) ? shared.value : shared.placeholder}>{validDateKey(draft.due) ? formatDay(draft.due) : "No date"}</Text>
                  <Icon name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} tint={color.text2} />
                </View>
              </Pressable>
              {pickerOpen ? <DatePicker value={draft.due} today={today} onChange={(due) => set({ due })} /> : null}
              {errors.due ? <Text style={shared.error}>{errors.due}</Text> : null}

              {draft.due ? (
                <>
                  <Text style={shared.label}>Time (optional)</Text>
                  <TextInput value={draft.time} onChangeText={(time) => set({ time })} placeholder="HH:mm, like 18:30" placeholderTextColor={c.muted} accessibilityLabel="Time" keyboardType="numbers-and-punctuation" maxLength={5} style={[shared.input, styles.input]} />
                  {errors.time ? <Text style={shared.error}>{errors.time}</Text> : null}
                </>
              ) : null}</> : null}

              {!event ? <ToggleRow label="Starred" value={draft.starred} onChange={(starred) => set({ starred })} /> : null}
              {!event && editor.mode === "edit" ? <ToggleRow label="Done" value={draft.done} onChange={(done) => set({ done })} /> : null}

              <Section title={event ? "Event schedule" : "Schedule"} summary={scheduleSummary(x, today)} open={event || openSection === "schedule"} onToggle={() => toggleSection("schedule")} error={!!(errors.schedule || errors.duration)}>
                <ScheduleSection x={x} set={setX} today={today} errors={errors} event={event} />
              </Section>
              {!event && (data.courses.length || x.courseId) ? (
                <Section title="Learning" summary={learningSummary(x, data.courses)} open={openSection === "learning"} onToggle={() => toggleSection("learning")} error={!!errors.score}>
                  <CourseSection x={x} set={setX} courses={data.courses} errors={errors} />
                </Section>
              ) : null}
              {!event ? <Section title="Reflection" summary={reflectionSummary(x)} open={openSection === "reflection"} onToggle={() => toggleSection("reflection")} error={!!errors.reflection}>
                <ReflectionSection value={x.reflection} onChange={(reflection) => setX({ reflection })} error={errors.reflection} />
              </Section> : null}
              <Section title="Linked documents" summary={linksSummary(x)} open={openSection === "links"} onToggle={() => toggleSection("links")} error={!!errors.links}>
                <LinksSection links={x.links} onChange={(links) => setX({ links })} error={errors.links} />
              </Section>
              <Section title="Linked records" summary={recordsSummary(x)} open={openSection === "records"} onToggle={() => toggleSection("records")} error={!!errors.other}>
                <RecordLinksSection links={x.recordLinks} onChange={(recordLinks) => setX({ recordLinks })} data={data} selfId={task?.id} today={today} />
              </Section>
              {errors.other ? <Text style={shared.error}>{errors.other}</Text> : null}

              {gone ? <Text style={shared.error}>This task was deleted on another device, so it can't be saved. Close to discard your changes.</Text> : null}
              {failed ? <Text style={shared.error}>{message ?? "That couldn't be saved. Your changes are still here."}</Text> : null}
              {task && !confirming ? (
                <Pressable onPress={() => setConfirming(true)} style={styles.delete} accessibilityRole="button" accessibilityLabel={`Delete ${noun}`}>
                  <Text style={styles.deleteText}>Delete {noun}</Text>
                </Pressable>
              ) : null}
              {task && confirming ? (
                <View style={styles.confirm}>
                  <Text style={styles.lead}>Delete this {noun}? You can undo it right after.</Text>
                  <Pressable onPress={() => void run((d) => removeTask(d, task.id), undoDelete(task))} style={[styles.delete, styles.deleteSure]} accessibilityRole="button" accessibilityLabel="Yes, delete task">
                    <Text style={styles.deleteSureText}>Yes, delete</Text>
                  </Pressable>
                  <Button label="Keep it" onPress={() => setConfirming(false)} />
                </View>
              ) : null}
            </ScrollView>
          )}
          {!missing ? <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Close editor"><Text style={styles.cancelText}>Close</Text></Pressable>
            <Pressable disabled={busy || gone} onPress={save} style={({ pressed }) => [styles.save, pressed && styles.savePressed, (busy || gone) && styles.disabled]} accessibilityRole="button" accessibilityLabel={editor.mode === "edit" ? "Save changes" : `Add ${noun}`} accessibilityState={{ disabled: busy || gone }}><Icon name="checkmark" size={14} tint="#fff" /><Text style={styles.saveText}>{busy ? "Saving…" : editor.mode === "edit" ? "Save changes" : `Add ${noun}`}</Text></Pressable>
          </View> : null}
        </View>
      </KeyboardAvoidingView>
  )
  return embedded ? content : <Modal visible transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>{content}</Modal>
}

const styles = StyleSheet.create({
  compactTitle: { minHeight: 28, maxHeight: 60, paddingVertical: 0, paddingHorizontal: 0, lineHeight: 22, includeFontPadding: false, textAlignVertical: "center" },
  compactBody: { paddingHorizontal: 14, paddingTop: 4, gap: 8 },
  properties: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 6 },
  property: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.raised },
  propertyText: { color: c.text2, fontSize: 12 }, moreProperty: { minHeight: 28, justifyContent: "center", paddingHorizontal: 8, borderRadius: 16 },
  compactDetails: { minHeight: 54, maxHeight: 110, paddingTop: 10, paddingBottom: 8, color: c.text, fontSize: 13, lineHeight: 19, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  linkedRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  fill: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.48)" },
  sheet: { width: "92%", maxWidth: 560, backgroundColor: c.panel, borderRadius: 17, borderWidth: 1, borderColor: c.border, overflow: "hidden", elevation: 18, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 14, paddingRight: 8, paddingVertical: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  title: { flex: 1, color: c.text, fontSize: 17, fontWeight: "600" },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 7 },
  input: { minHeight: 40, fontSize: 14, color: c.text, borderColor: c.line, backgroundColor: c.ground, paddingHorizontal: 12, paddingVertical: 8 },
  details: { minHeight: 76, lineHeight: 20 },
  footer: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.panel },
  cancel: { minHeight: 28, paddingHorizontal: 10, justifyContent: "center", borderRadius: 16, backgroundColor: c.raised }, cancelText: { color: c.muted, fontSize: 12 },
  save: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.action }, savePressed: { backgroundColor: c.actionPressed }, saveText: { color: "#fff", fontSize: 12, fontWeight: "600" }, disabled: { opacity: 0.45 },
  kinds: { flexDirection: "row", gap: 6, alignSelf: "flex-start", padding: 3, borderRadius: 24, backgroundColor: c.ground },
  kind: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 20 },
  kindOn: { backgroundColor: c.selected }, kindText: { color: color.muted, fontSize: 13 }, kindTextOn: { color: c.accent },
  lead: { color: color.text2, fontSize: 14, lineHeight: 20 },
  confirm: { gap: 8 },
  delete: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  deleteText: { color: tone.red, fontSize: 15, fontWeight: "700" },
  deleteSure: { backgroundColor: color.red, borderColor: color.red },
  deleteSureText: { color: color.text, fontSize: 15, fontWeight: "700" },
})
