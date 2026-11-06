import { shape } from "../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { compareTasks, isForToday, toggleTask } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { formatDay, shortDay } from "./planner/dates.ts"
import { plannerRow } from "./planner/rows.ts"
import { eventChips, taskChips, type RowChip } from "./row-chips.ts"
import { NoteSheet, type NoteEditor } from "./planner/notes/NoteSheet.tsx"
import { TaskCheck } from "./planner/TaskCheck.tsx"

/** A compact live overview; every count and row comes from the current workspace. */
export function HomeScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [showToday, setShowToday] = useState(false)
  const [showLearning, setShowLearning] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [sel, setSel] = useState<string | null>(null)
  const today = todayKey()
  const blocked = status === "conflict"
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const due = tasks.filter(t => isForToday(t, today)).sort(compareTasks)
  const learning = tasks.filter(t => !t.done && t.courseId && !isForToday(t, today)).sort(compareTasks)
  const events = (data?.tasks ?? []).filter(t => t.kind === "event" && t.scheduledDate && t.scheduledDate >= today).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")).slice(0, 4)
  const pinned = (data?.notes ?? []).filter(n => n.pinned).slice(0, 3)
  async function complete(id: string) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleTask(d, id))) setNotice(message ?? "Could not save this task.")
  }
  const open = (show: () => void) => { setSel(null); show() }
  const add = <Pressable onPress={() => data && !blocked ? setEditor({ mode: "create" }) : setNotice(blocked ? "Resolve the sync conflict before editing." : "Load your workspace first.")} accessibilityRole="button" accessibilityLabel="Add task" style={s.add}><Icon name="add" size={20} tint={c.accent} /></Pressable>
  return <WorkspacePage page="Home" onOpenSettings={onOpenSettings} action={add} onRefresh={() => void refresh()} refreshing={refreshing}>
    {!data ? <View style={s.empty}><Text style={s.title}>{status === "signed-out" ? "Sign in to use Blackwall" : "Loading your workspace"}</Text><Text style={s.meta}>{status === "signed-out" ? "Your records will appear here after sign-in." : message ?? "Pull down to try again."}</Text>{status === "signed-out" ? <MiniAction label="Sign in" onPress={onOpenSettings} /> : null}</View> : null}
    {notice || (data && status !== "ok" && message) ? <Text style={s.error}>{notice ?? message}</Text> : null}
    {data ? <>
      <Text style={s.day}>{formatDay(today)}</Text>
      <View style={s.instrument}><Instrument count={tasks.filter(t => !t.done).length} label="open tasks" /><Instrument count={data.courses.length} label="learning" /><Instrument count={data.projects.length} label="projects" /></View>
      <WorkspaceSection title="Today" icon="checkmark-circle-outline" count={`${due.length} open`}>
        {(showToday ? due : due.slice(0, 5)).map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} title={t.title} subtitle={t.due && t.due < today ? `Overdue · ${shortDay(t.due)}` : t.due ? "Due today" : "Starred"} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => open(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} /> })}
        {!due.length ? <Text style={s.emptyText}>Nothing due or starred today.</Text> : null}
        {due.length > 5 ? <MiniAction label={showToday ? "Show less" : `Show ${due.length - 5} more`} onPress={() => setShowToday(v => !v)} /> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Learning next" icon="school-outline" tint="#b39ddb" count={`${learning.length} open`}>
        {(showLearning ? learning : learning.slice(0, 5)).map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} title={t.title} subtitle={[data.courses.find(x => x.id === t.courseId)?.title, t.due ? shortDay(t.due) : ""].filter(Boolean).join(" · ")} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => open(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} /> })}
        {!learning.length ? <Text style={s.emptyText}>No upcoming learning work.</Text> : null}
        {learning.length > 5 ? <MiniAction label={showLearning ? "Show less" : `Show ${learning.length - 5} more`} onPress={() => setShowLearning(v => !v)} /> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Upcoming events" icon="calendar-outline" tint={c.amber} count={events.length ? `${events.length} next` : undefined}>
        {events.map(t => <Line key={t.id} icon="calendar-outline" title={t.title} subtitle={[t.scheduledDate ? shortDay(t.scheduledDate) : "", t.scheduledTime].filter(Boolean).join(" · ")} chips={eventChips(t.scheduledDate, t.scheduledTime)} detail={t.details?.trim().split("\n")[0]} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => open(() => setEditor({ mode: "edit", id: t.id }))} />)}
        {!events.length ? <Text style={s.emptyText}>No upcoming events.</Text> : null}
      </WorkspaceSection>
      {pinned.length ? <WorkspaceSection title="Pinned notes" icon="document-text-outline" tint={c.blue} count={`${pinned.length} pinned`}>{pinned.map(n => <Line key={n.id} icon="document-text-outline" title={n.text.trim().split("\n")[0] || "Untitled note"} subtitle={n.text.trim().split("\n").slice(1).join(" ").slice(0, 80)} selected={sel === n.id} onSelect={() => setSel(n.id)} onOpen={() => open(() => setNoteEditor({ mode: "edit", id: n.id }))} />)}</WorkspaceSection> : null}
    </> : null}
    {data && editor ? <TaskSheet key={editor.mode === "edit" ? editor.id : "new"} editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
    {data && noteEditor ? <NoteSheet key={noteEditor.mode === "edit" ? noteEditor.id : "new"} editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} compact /> : null}
  </WorkspacePage>
}

function Instrument({ count, label }: { count: number; label: string }) { return <View style={s.instrumentCell}><Text style={s.instrumentCount}>{count}</Text><Text style={s.instrumentLabel}>{label}</Text></View> }
function MiniAction({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.miniAction} accessibilityRole="button"><Text style={s.actionText}>{label}</Text></Pressable> }
/**
 * One selectable row. The first tap selects it (highlighted bar, a strip of its properties and Open/Done pills opens
 * under it); a second tap on the selected row, or "Open", opens its editor. No chevrons: the row says what it is.
 */
function Line({ title, subtitle, icon, chips = [], detail, selected, onSelect, onOpen, onComplete }: { title: string; subtitle?: string; icon?: "calendar-outline" | "document-text-outline"; chips?: RowChip[]; detail?: string; selected: boolean; onSelect: () => void; onOpen: () => void; onComplete?: () => void }) {
  return <View style={[s.item, selected && s.itemOn]}>
    <View style={s.row}>
      {onComplete ? <TaskCheck checked={false} compact onPress={onComplete} label={`Complete ${title}`} /> : <View style={s.simpleIcon}><Icon name={icon ?? "document-text-outline"} size={17} tint={c.accent} /></View>}
      <Pressable onPress={selected ? onOpen : onSelect} style={s.rowBody} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={selected ? `Open ${title}` : `Select ${title}`}><Text style={s.rowTitle} numberOfLines={2}>{title}</Text>{subtitle ? <Text style={s.meta} numberOfLines={1}>{subtitle}</Text> : null}</Pressable>
    </View>
    {selected ? <View style={s.strip}>
      {chips.length ? <View style={s.chips}>{chips.map(chip => <View key={chip.key} style={[s.chip, chipFill[chip.kind]]}><Text style={[s.chipText, { color: chipInk[chip.kind] }]} numberOfLines={1}>{chip.label}</Text></View>)}</View> : null}
      {detail ? <Text style={s.detail} numberOfLines={2}>{detail}</Text> : null}
      <View style={s.stripActions}>
        <Pressable onPress={onOpen} style={s.pill} accessibilityRole="button" accessibilityLabel={`Open ${title}`}><Icon name="open-outline" size={12} tint={c.accent} /><Text style={s.pillText}>Open</Text></Pressable>
        {onComplete ? <Pressable onPress={onComplete} style={s.pill} accessibilityRole="button" accessibilityLabel={`Complete ${title}`}><Icon name="checkmark" size={12} tint={c.accent} /><Text style={s.pillText}>Done</Text></Pressable> : null}
      </View>
    </View> : null}
  </View>
}
const chipFill: Record<RowChip["kind"], { backgroundColor: string }> = { date: { backgroundColor: c.dateFill }, overdue: { backgroundColor: c.dateFill }, course: { backgroundColor: c.tagFill }, focus: { backgroundColor: c.panel }, star: { backgroundColor: c.dateFill }, plain: { backgroundColor: c.panel } }
const chipInk: Record<RowChip["kind"], string> = { date: c.dateText, overdue: "#ff8787", course: c.tagText, focus: c.accent, star: c.amber, plain: c.text2 }
const s = StyleSheet.create({
  add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, day: { color: c.muted, fontSize: 12 }, instrument: { flexDirection: "row", gap: 7 }, instrumentCell: { flex: 1, minHeight: 48, borderRadius: shape.card, backgroundColor: c.panel, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "baseline", gap: 6 }, instrumentCount: { color: c.text, fontSize: 17, fontWeight: "700" }, instrumentLabel: { color: c.muted, fontSize: 11, flexShrink: 1 },
  item: { borderBottomWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: "transparent" }, itemOn: { backgroundColor: c.selected, borderLeftColor: c.accent, paddingRight: 6 }, row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 }, strip: { gap: 6, paddingLeft: 36, paddingBottom: 8 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, chip: { minHeight: 20, justifyContent: "center", paddingHorizontal: 7, borderRadius: 10 }, chipText: { fontSize: 11 }, detail: { color: c.text2, fontSize: 12, lineHeight: 17 }, stripActions: { flexDirection: "row", gap: 6 }, pill: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: 14, backgroundColor: c.panel }, pillText: { color: c.accent, fontSize: 11, fontWeight: "600" }, rowBody: { flex: 1, minWidth: 0, paddingVertical: 5 }, rowTitle: { color: c.text, fontSize: 14, fontWeight: "600", lineHeight: 19 }, simpleIcon: { width: 30, alignItems: "center" }, meta: { color: c.muted, fontSize: 11, lineHeight: 16 }, emptyText: { color: c.muted, fontSize: 12, paddingVertical: 6 }, empty: { gap: 8, paddingVertical: 16 }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, error: { color: "#ffa8a8", fontSize: 12 }, miniAction: { minHeight: 28, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 8 }, actionText: { color: c.accent, fontSize: 12, fontWeight: "600" },
})

