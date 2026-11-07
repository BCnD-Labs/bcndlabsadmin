import { shape } from "../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { compareTasks, isForToday, toggleStar, toggleTask } from "../../lib/shared.ts"
import { mono } from "../../theme.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { BlockStreak, MiniBar, Sparkline, StatCell, StatStrip } from "../kit/charts.tsx"
import { PropChip } from "../kit/PropChip.tsx"
import { dateParts, doneCounts, lastDays, percent, streak } from "../kit/stats.ts"
import { chipTone, kit, type ChipKind } from "../kit/tokens.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { formatDay, shortDay } from "./planner/dates.ts"
import { typeLabel } from "./planner/learning-types.ts"
import { plannerRow } from "./planner/rows.ts"
import { eventChips, taskChips, type RowChip } from "./row-chips.ts"
import { NoteSheet, type NoteEditor } from "./planner/notes/NoteSheet.tsx"
import { TaskCheck } from "./planner/TaskCheck.tsx"
import { learningGroups } from "./home-groups.ts"
import { kindInfo, learningProgress } from "./learning/learning-view.ts"

/** The property kind a row chip is drawn as. */
const chipKind: Record<RowChip["kind"], ChipKind> = { date: "date", overdue: "overdue", course: "course", focus: "neutral", star: "date", plain: "neutral" }
interface DueCell { text: string; tone: "today" | "overdue" | "plain" }
interface TagCell { kind: ChipKind; text: string }

/** A compact live overview; every count and row comes from the current workspace. */
export function HomeScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [showToday, setShowToday] = useState(false)
  const [showLearning, setShowLearning] = useState(false)
  const [closedLearning, setClosedLearning] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<string>()
  const [sel, setSel] = useState<string | null>(null)
  const today = todayKey()
  const blocked = status === "conflict"
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const due = tasks.filter(t => isForToday(t, today)).sort(compareTasks)
  const learning = tasks.filter(t => !t.done && t.courseId && !isForToday(t, today)).sort(compareTasks)
  const visibleLearning = showLearning ? learning : learning.slice(0, 5)
  const events = (data?.tasks ?? []).filter(t => t.kind === "event" && t.scheduledDate && t.scheduledDate >= today).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")).slice(0, 4)
  const pinned = (data?.notes ?? []).filter(n => n.pinned).slice(0, 3)
  const open = tasks.filter(t => !t.done)
  const overdue = open.filter(t => t.due && t.due < today).length
  const week = doneCounts(tasks, lastDays(today, 7))
  const run = streak(tasks, today)
  async function complete(id: string) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleTask(d, id))) setNotice(message ?? "Could not save this task.")
  }
  async function star(id: string) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleStar(d, id))) setNotice(message ?? "Could not save this task.")
  }
  const dueCell = (t: { due?: string }, focused: boolean): DueCell => t.due && t.due < today ? { text: shortDay(t.due), tone: "overdue" } : t.due === today ? { text: "Today", tone: "today" } : t.due ? { text: shortDay(t.due), tone: "plain" } : { text: focused ? "Focus" : "Star", tone: "today" }
  const openRow = (show: () => void) => { setSel(null); show() }
  return <WorkspacePage page="Home" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {!data ? <View style={s.empty}><Text style={s.title}>{status === "signed-out" ? "Sign in to use Blackwall" : "Loading your workspace"}</Text><Text style={s.meta}>{status === "signed-out" ? "Your records will appear here after sign-in." : message ?? "Pull down to try again."}</Text>{status === "signed-out" ? <MiniAction label="Sign in" onPress={onOpenSettings} /> : null}</View> : null}
    {notice || (data && status !== "ok" && message) ? <Text style={s.error}>{notice ?? message}</Text> : null}
    {data ? <>
      <Text style={s.day}>{formatDay(today)} · {open.length} open · {data.courses.length} learning · {data.projects.length} projects</Text>
      <StatStrip>
        <StatCell label="Done 7d" value={week.reduce((n, x) => n + x, 0)} tint={kit.good}><Sparkline values={week} tint={kit.good} /></StatCell>
        <StatCell label="Today" value={due.length} tint={chipTone.date.ink}><View style={s.cellGap} /></StatCell>
        <StatCell label="Overdue" value={overdue} tint={overdue ? chipTone.overdue.ink : c.text}><View style={s.cellGap} /></StatCell>
        <StatCell label="Streak" value={`${run.length}d`} tint={run.length ? chipTone.status.ink : c.text}><BlockStreak days={run.last7} /></StatCell>
      </StatStrip>
      <WorkspaceSection title="Today" icon="checkmark-circle-outline" count={`${due.length} open`} collapsible flush>
        <ColumnHead />
        {(showToday ? due : due.slice(0, 5)).map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} title={t.title} due={dueCell(t, row.focused)} tag={row.course ? { kind: "course", text: row.course } : undefined} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} onStar={() => void star(t.id)} starred={t.starred} /> })}
        {!due.length ? <Text style={s.emptyText}>Nothing due or starred today.</Text> : null}
        {due.length > 5 ? <MiniAction label={showToday ? "Show less" : `Show ${due.length - 5} more`} onPress={() => setShowToday(v => !v)} /> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Learning next" icon="school-outline" tint={kit.hue.learning} count={`${learning.length} open`} collapsible flush>
        {learning.length ? <ColumnHead /> : null}
        {learningGroups(visibleLearning, data.courses).map(group => {
          const course = data.courses.find(x => x.id === group.id)
          const progress = course ? learningProgress(course, data.tasks.filter(t => t.courseId === course.id)) : undefined
          return <View key={group.id} style={s.learningGroup}>
            <Pressable onPress={() => setClosedLearning(value => ({ ...value, [group.id]: !value[group.id] }))} style={s.groupHead} accessibilityRole="button" accessibilityState={{ expanded: !closedLearning[group.id] }} accessibilityLabel={`${group.title}, ${group.tasks.length} items${progress?.measured ? `, ${percent(progress.value)} percent done` : ""}`}>
              <Icon name={closedLearning[group.id] ? "chevron-forward" : "chevron-down"} size={16} tint={c.muted} />
              <Text style={s.groupTitle} numberOfLines={1}>{group.title}</Text>
              {course ? <PropChip kind="course" value={kindInfo(course).label.toUpperCase()} /> : null}
              {progress?.measured ? <><MiniBar value={progress.value} width={40} /><Text style={s.groupPct}>{percent(progress.value)}%</Text></> : null}
              <Text style={s.groupCount}>{group.tasks.length}</Text>
            </Pressable>
            {!closedLearning[group.id] ? group.tasks.map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} title={t.title} due={t.due ? dueCell(t, false) : undefined} tag={t.learningType ? { kind: "tag", text: typeLabel(t.learningType, course?.kind) } : undefined} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} onStar={() => void star(t.id)} starred={t.starred} /> }) : null}
          </View>
        })}
        {!learning.length ? <Text style={s.emptyText}>No upcoming learning work.</Text> : null}
        {learning.length > 5 ? <MiniAction label={showLearning ? "Show less" : `Show ${learning.length - 5} more`} onPress={() => setShowLearning(v => !v)} /> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Upcoming events" icon="calendar-outline" tint={c.amber} count={events.length ? `${events.length} next` : undefined} collapsible flush>
        {events.map(t => <Line key={t.id} date={t.scheduledDate} title={t.title} tag={t.scheduledTime ? { kind: "date", text: t.scheduledTime } : undefined} chips={eventChips(t.scheduledDate, t.scheduledTime)} detail={t.details?.trim().split("\n")[0]} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} />)}
        {!events.length ? <Text style={s.emptyText}>No upcoming events.</Text> : null}
      </WorkspaceSection>
      {pinned.length ? <WorkspaceSection title="Pinned notes" icon="document-text-outline" tint={c.blue} count={`${pinned.length} pinned`} collapsible flush>{pinned.map(n => <Line key={n.id} icon="document-text-outline" title={n.text.trim().split("\n")[0] || "Untitled note"} subtitle={n.text.trim().split("\n").slice(1).join(" ").slice(0, 80)} selected={sel === n.id} onSelect={() => setSel(n.id)} onOpen={() => openRow(() => setNoteEditor({ mode: "edit", id: n.id }))} />)}</WorkspaceSection> : null}
    </> : null}
    {data && editor ? <TaskSheet key={editor.mode === "edit" ? editor.id : "new"} editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
    {data && noteEditor ? <NoteSheet key={noteEditor.mode === "edit" ? noteEditor.id : "new"} editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} compact /> : null}
  </WorkspacePage>
}

function MiniAction({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.miniAction} accessibilityRole="button"><Text style={s.actionText}>{label}</Text></Pressable> }
function ColumnHead() { return <View style={s.colHead} accessible={false} importantForAccessibility="no-hide-descendants"><View style={s.colCheck} /><Text style={[s.colText, s.colTitle]}>TITLE</Text><Text style={[s.colText, s.colDue]}>DUE</Text><Text style={[s.colText, s.colTag]}>TAG</Text></View> }
/**
 * One selectable row: a Title / Due / Tag table row. The first tap selects it (highlighted bar, labelled property chips, a note
 * preview and Open / Done / Star pills open under it); a second tap on the selected row, or "Open", opens its editor.
 */
function Line({ title, subtitle, icon, date, due, tag, chips = [], detail, selected, starred, onSelect, onOpen, onComplete, onStar }: { title: string; subtitle?: string; icon?: "calendar-outline" | "document-text-outline"; date?: string; due?: DueCell; tag?: TagCell; chips?: RowChip[]; detail?: string; selected: boolean; starred?: boolean; onSelect: () => void; onOpen: () => void; onComplete?: () => void; onStar?: () => void }) {
  const parts = date ? dateParts(date) : undefined
  return <View style={[s.item, selected && s.itemOn]}>
    <View style={s.row}>
      {onComplete ? <TaskCheck checked={false} compact onPress={onComplete} label={`Complete ${title}`} /> : parts ? <View style={s.dateBlock} accessible accessibilityLabel={`${parts.month} ${parts.day}`}><Text style={s.dateMonth}>{parts.month}</Text><Text style={s.dateDay}>{parts.day}</Text></View> : <View style={s.simpleIcon}><Icon name={icon ?? "document-text-outline"} size={17} tint={c.accent} /></View>}
      <Pressable onPress={onSelect} style={s.rowBody} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={selected ? `Selected ${title}. Use Open to edit` : `Preview ${title}`}><Text style={s.rowTitle} numberOfLines={2}>{title}</Text>{subtitle ? <Text style={s.meta} numberOfLines={1}>{subtitle}</Text> : null}</Pressable>
      {due ? <Text style={[s.dueText, due.tone === "today" && s.dueToday, due.tone === "overdue" && s.dueOver]} numberOfLines={1}>{due.text}</Text> : null}
      {tag ? <View style={s.tagCol}><PropChip kind={tag.kind} value={tag.text} /></View> : null}
    </View>
    {selected ? <View style={s.strip}>
      {chips.length ? <View style={s.chips}>{chips.map(chip => <PropChip key={chip.key} kind={chipKind[chip.kind]} label={chip.tag} value={chip.value ?? chip.label} />)}</View> : null}
      {detail ? <Text style={s.detail} numberOfLines={2} ellipsizeMode="tail">{detail.length > 120 ? `${detail.slice(0, 120).trimEnd()}…` : detail}</Text> : null}
      <View style={s.stripActions}>
        <Pressable onPress={onOpen} style={[s.pill, s.pillPrimary]} accessibilityRole="button" accessibilityLabel={`Open ${title}`}><Icon name="open-outline" size={12} tint="#fff" /><Text style={s.pillPrimaryText}>Open</Text></Pressable>
        {onComplete ? <Pressable onPress={onComplete} style={s.pill} accessibilityRole="button" accessibilityLabel={`Complete ${title}`}><Icon name="checkmark" size={12} tint={c.accent} /><Text style={s.pillText}>Done</Text></Pressable> : null}
        {onStar ? <Pressable onPress={onStar} style={s.pill} accessibilityRole="button" accessibilityLabel={starred ? `Unstar ${title}` : `Star ${title}`}><Icon name={starred ? "star" : "star-outline"} size={12} tint={starred ? c.amber : c.accent} /><Text style={s.pillText}>{starred ? "Starred" : "Star"}</Text></Pressable> : null}
      </View>
    </View> : null}
  </View>
}
const s = StyleSheet.create({
  add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, day: { color: c.muted, fontSize: 12 }, cellGap: { height: 14 },
  colHead: { height: 20, flexDirection: "row", alignItems: "center", backgroundColor: "#2a2b2d", borderBottomWidth: 1, borderColor: c.line }, colCheck: { width: 37 }, colText: { color: kit.mutedInk, fontFamily: mono, fontSize: 8.5, fontWeight: "700", letterSpacing: 1 }, colTitle: { flex: 1 }, colDue: { width: 58 }, colTag: { width: 84 },
  learningGroup: {}, groupHead: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, backgroundColor: "#2b2c2e", borderBottomWidth: 1, borderColor: c.line }, groupTitle: { flex: 1, minWidth: 0, color: c.text, fontSize: 12.5, fontWeight: "700" }, groupPct: { width: 30, textAlign: "right", color: c.text2, fontFamily: mono, fontSize: 10, fontWeight: "700" }, groupCount: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, textAlign: "center", backgroundColor: c.raised, color: c.text2, fontFamily: mono, fontSize: 10, fontWeight: "700", lineHeight: 18, overflow: "hidden" },
  item: { borderBottomWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: "transparent" }, itemOn: { backgroundColor: c.selected, borderLeftColor: c.accent }, row: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 5 },
  strip: { gap: 7, paddingLeft: 36, paddingRight: 8, paddingBottom: 10 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, detail: { color: c.text2, fontSize: 12, lineHeight: 17 }, stripActions: { flexDirection: "row", gap: 6 },
  pill: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderRadius: 15, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border }, pillText: { color: c.accent, fontSize: 11.5, fontWeight: "600" }, pillPrimary: { backgroundColor: c.action, borderColor: c.selectedBorder }, pillPrimaryText: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 5 }, rowTitle: { color: c.text, fontSize: 14, fontWeight: "600", lineHeight: 19 }, simpleIcon: { width: 32, alignItems: "center" },
  dateBlock: { width: 34, height: 34, marginLeft: 3, borderRadius: 6, backgroundColor: chipTone.date.fill, alignItems: "center", justifyContent: "center" }, dateMonth: { color: chipTone.date.ink, fontFamily: mono, fontSize: 8, fontWeight: "700", letterSpacing: 0.8 }, dateDay: { color: chipTone.date.ink, fontSize: 14, fontWeight: "700", lineHeight: 16 },
  dueText: { width: 56, color: c.muted, fontFamily: mono, fontSize: 10.5 }, dueToday: { color: chipTone.date.ink }, dueOver: { color: chipTone.overdue.ink }, tagCol: { width: 80, paddingRight: 6 },
  meta: { color: c.muted, fontSize: 11, lineHeight: 16 }, emptyText: { color: c.muted, fontSize: 12, paddingVertical: 8, paddingHorizontal: 10 }, empty: { gap: 8, paddingVertical: 16 }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, error: { color: "#ffa8a8", fontSize: 12 }, miniAction: { minHeight: 32, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 10 }, actionText: { color: c.accent, fontSize: 12, fontWeight: "600" },
})
void shape
