import { Fragment, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { compareTasks, isForToday, toggleStar, toggleTask } from "../../lib/shared.ts"
import { mono } from "../../theme.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { MiniBar, StatCell, StatStrip } from "../kit/charts.tsx"
import { PropChip } from "../kit/PropChip.tsx"
import { dateParts, doneCounts, lastDays, percent, streak } from "../kit/stats.ts"
import { chipTone, kit, statusKind, type ChipKind } from "../kit/tokens.ts"
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
import { learningProgress } from "./learning/learning-view.ts"
import { completedOn } from "./planner/log/log-rules.ts"
import { SLOTS, hasAnswers, readSlotCheckIn, reviewId } from "./journal-review.ts"
import type { ScreenProps } from "../nav/screens.tsx"
import { HOME_LABELS, moveHomePanel, toggleItem, type HomePanel } from "./home-prefs.ts"
import { useHomePrefs } from "./useHomePrefs.ts"

/** The property kind a row chip is drawn as. */
const chipKind: Record<RowChip["kind"], ChipKind> = { date: "date", overdue: "overdue", course: "course", focus: "neutral", star: "date", plain: "neutral" }
interface DueCell { text: string; tone: "today" | "overdue" | "plain" }
interface TagCell { kind: ChipKind; text: string }

/** A compact live overview; every count and row comes from the current workspace. */
export function HomeScreen({ onOpenSettings, onNavigate }: ScreenProps) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const { width, fontScale } = useWindowDimensions()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null)
  const [prefs, updatePrefs] = useHomePrefs()
  const [arranging, setArranging] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [sel, setSel] = useState<string | null>(null)
  const today = todayKey()
  const blocked = status === "conflict"
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const due = tasks.filter(t => isForToday(t, today)).sort(compareTasks)
  const learning = tasks.filter(t => !t.done && t.courseId && !isForToday(t, today)).sort(compareTasks)
  const events = (data?.tasks ?? []).filter(t => t.kind === "event" && t.scheduledDate && t.scheduledDate >= today).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")).slice(0, 4)
  const pinned = (data?.notes ?? []).filter(n => n.pinned).slice(0, 3)
  const overdue = tasks.filter(t => !t.done && t.due && t.due < today).length
  const week = doneCounts(tasks, lastDays(today, 7))
  const run = streak(tasks, today)
  const recentDone = lastDays(today, 7).flatMap(day => completedOn(tasks, day).filter(t => t.kind !== "event").map(task => ({ task, day }))).reverse().slice(0, 2)
  const todayJournal = data?.journal.find(entry => entry.id === today)
  const projects = (data?.projects ?? []).filter(project => project.status !== "done").sort((a, b) => Number(b.status === "active") - Number(a.status === "active")).slice(0, 2)
  const activeProjects = data?.projects.filter(project => project.status === "active").length ?? 0
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
  const collapseProps = (panel: HomePanel) => ({ collapsed: prefs.collapsed.includes(panel), onCollapsedChange: () => updatePrefs({ collapsed: toggleItem(prefs.collapsed, panel) }) })
  return <WorkspacePage page="Home" compact center={width / fontScale >= 420 ? <Text style={s.headerDate}>{formatDay(today)}</Text> : undefined} action={<Pressable onPress={() => setArranging(true)} style={s.arrangeTrigger} accessibilityRole="button" accessibilityLabel="Arrange Home sections"><Icon name="options-outline" size={17} tint={c.text2} /></Pressable>} onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {width / fontScale < 420 ? <Text style={s.headerDate}>{formatDay(today)}</Text> : null}
    {!data ? <View style={s.empty}><Text style={s.title}>{status === "signed-out" ? "Sign in to use Blackwall" : "Loading your workspace"}</Text><Text style={s.meta}>{status === "signed-out" ? "Your records will appear here after sign-in." : message ?? "Pull down to try again."}</Text>{status === "signed-out" ? <MiniAction label="Sign in" onPress={onOpenSettings} /> : null}</View> : null}
    {notice || (data && status !== "ok" && message) ? <Text style={s.error}>{notice ?? message}</Text> : null}
    {data ? <>
      <StatStrip compact>
        <StatCell compact labelSize={11} label="Done 7d" value={week.reduce((n, x) => n + x, 0)} tint={kit.good} />
        <StatCell compact labelSize={11} label="Today" value={due.length} tint={chipTone.date.ink} />
        <StatCell compact labelSize={11} label="Overdue" value={overdue} tint={overdue ? chipTone.overdue.ink : c.text} />
        <StatCell compact labelSize={11} label="Streak" value={`${run.length}d`} tint={run.length ? chipTone.status.ink : c.text} />
      </StatStrip>
      {prefs.order.map(panel => <Fragment key={panel}>
      {panel === "today" ? <WorkspaceSection compact title="Today" icon="checkmark-circle-outline" tint={kit.hue.productivity} count={`${due.length} open`} collapsible flush {...collapseProps("today")}>
        {(prefs.expandedToday ? due : due.slice(0, 5)).map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} title={t.title} due={dueCell(t, row.focused)} tag={row.course ? { kind: "course", text: row.course } : undefined} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} onStar={() => void star(t.id)} starred={t.starred} /> })}
        {!due.length ? <Text style={s.emptyText}>Nothing due or starred today.</Text> : null}
        {due.length > 5 ? <MiniAction label={prefs.expandedToday ? "Show less" : `Show ${due.length - 5} more`} onPress={() => updatePrefs({ expandedToday: !prefs.expandedToday })} /> : null}
      </WorkspaceSection> : null}
      {panel === "learning" ? <WorkspaceSection compact title="Learning next" icon="school-outline" tint={kit.hue.learning} count={`${learning.length} open`} collapsible flush {...collapseProps("learning")}>
        {learningGroups(learning, data.courses).map(group => {
          const course = data.courses.find(x => x.id === group.id)
          const progress = course ? learningProgress(course, data.tasks.filter(t => t.courseId === course.id)) : undefined
          const closed = prefs.closedGroups.includes(group.id)
          const expanded = prefs.expandedGroups.includes(group.id)
          return <View key={group.id} style={s.learningGroup}>
            <Pressable onPress={() => updatePrefs({ closedGroups: toggleItem(prefs.closedGroups, group.id) })} style={s.groupHead} accessibilityRole="button" accessibilityState={{ expanded: !closed }} accessibilityLabel={`${group.title}, ${group.tasks.length} items${progress?.measured ? `, ${percent(progress.value)} percent done` : ""}`}>
              <Icon name={closed ? "chevron-forward" : "chevron-down"} size={13} tint={kit.hue.learning} />
              <Text style={s.groupTitle} >{group.title}</Text>
              {progress?.measured ? <><MiniBar value={progress.value} width={38} /><Text style={s.groupPct}>{percent(progress.value)}%</Text></> : null}
              <Text style={s.groupCount}>{group.tasks.length}</Text>
            </Pressable>
            {!closed ? <View style={s.courseBody}>{(expanded ? group.tasks : group.tasks.slice(0, 3)).map(t => { const row = plannerRow(t, data.courses, today); return <Line key={t.id} nested title={t.title} due={t.due ? dueCell(t, false) : undefined} tag={t.learningType ? { kind: "tag", text: typeLabel(t.learningType, course?.kind) } : undefined} chips={taskChips(row)} detail={row.details} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} onComplete={() => void complete(t.id)} onStar={() => void star(t.id)} starred={t.starred} /> })}{group.tasks.length > 3 ? <MiniAction label={expanded ? "Show less" : `Show ${group.tasks.length - 3} more`} onPress={() => updatePrefs({ expandedGroups: toggleItem(prefs.expandedGroups, group.id) })} /> : null}</View> : null}
          </View>
        })}
        {!learning.length ? <Text style={s.emptyText}>No upcoming learning work.</Text> : null}
      </WorkspaceSection> : null}
      {panel === "recent" && recentDone.length ? <WorkspaceSection compact title="Recently done" icon="checkmark-circle-outline" tint={kit.good} count={`${week.reduce((n, x) => n + x, 0)} in 7d`} collapsible flush {...collapseProps("recent")}>
        {recentDone.map(({ task, day }) => <Pressable key={task.id} onPress={() => setEditor({ mode: "edit", id: task.id })} style={s.recentRow} accessibilityRole="button" accessibilityLabel={`Open completed task ${task.title}`}><Icon name="checkmark-circle" size={17} tint={kit.good} /><Text style={s.recentTitle} >{task.title}</Text><Text style={s.recentDate}>{shortDay(day)}</Text></Pressable>)}
      </WorkspaceSection> : null}
      {panel === "journal" ? <WorkspaceSection compact title="Journal" icon="book-outline" tint={kit.hue.journal} count="Check-ins" flush right={<Pressable onPress={() => onNavigate?.("journal")} disabled={!onNavigate} style={s.sectionLink} accessibilityRole="button" accessibilityLabel="Open Journal"><Icon name="arrow-forward" size={15} tint={kit.hue.journal} /></Pressable>}>
        <View style={s.journalRow}>{SLOTS.map(slot => { const saved = todayJournal?.entries?.find(item => item.id === reviewId("daily", today, slot.key)); const done = !!saved && hasAnswers(readSlotCheckIn(slot.key, saved.text)); return <Pressable key={slot.key} onPress={() => onNavigate?.("journal", { screen: "journal", day: today, slot: slot.key })} disabled={!onNavigate} style={[s.journalChip, done && s.journalChipDone]} accessibilityRole="button" accessibilityLabel={`${slot.label} check-in ${done ? "complete" : "not complete"}. Open this check-in`}><Text style={[s.journalChipText, done && s.journalChipDoneText]}>{done ? "✓ " : ""}{slot.label}</Text></Pressable> })}</View>
      </WorkspaceSection> : null}
      {panel === "projects" && projects.length ? <WorkspaceSection compact title="Projects" icon="folder-outline" tint={kit.hue.projects} count={`${activeProjects} active`} flush right={<Pressable onPress={() => onNavigate?.("dev")} disabled={!onNavigate} style={s.sectionLink} accessibilityRole="button" accessibilityLabel="Open Projects"><Icon name="arrow-forward" size={15} tint={kit.hue.projects} /></Pressable>}>
        {projects.map(project => <Pressable key={project.id} onPress={() => onNavigate?.("dev", { screen: "dev", projectId: project.id })} disabled={!onNavigate} style={s.projectRow} accessibilityRole="button" accessibilityLabel={`Open Projects to view ${project.name}`}><View style={s.projectMark} /><Text style={s.projectTitle} >{project.name}</Text><PropChip readable kind={statusKind(project.status)} value={project.status.toUpperCase()} /></Pressable>)}
      </WorkspaceSection> : null}
      {panel === "events" ? <WorkspaceSection compact title="Upcoming events" icon="calendar-outline" tint={c.amber} count={events.length ? `${events.length} next` : undefined} collapsible flush {...collapseProps("events")}>
        {events.map(t => <Line key={t.id} date={t.scheduledDate} title={t.title} tag={t.scheduledTime ? { kind: "date", text: t.scheduledTime } : undefined} chips={eventChips(t.scheduledDate, t.scheduledTime)} detail={t.details?.trim().split("\n")[0]} selected={sel === t.id} onSelect={() => setSel(t.id)} onOpen={() => openRow(() => setEditor({ mode: "edit", id: t.id }))} />)}
        {!events.length ? <Text style={s.emptyText}>No upcoming events.</Text> : null}
      </WorkspaceSection> : null}
      {panel === "pinned" && pinned.length ? <WorkspaceSection compact title="Pinned notes" icon="document-text-outline" tint={c.blue} count={`${pinned.length} pinned`} collapsible flush {...collapseProps("pinned")}>{pinned.map(n => <Line key={n.id} icon="document-text-outline" title={n.text.trim().split("\n")[0] || "Untitled note"} subtitle={n.text.trim().split("\n").slice(1).join(" ").slice(0, 80)} selected={sel === n.id} onSelect={() => setSel(n.id)} onOpen={() => openRow(() => setNoteEditor({ mode: "edit", id: n.id }))} />)}</WorkspaceSection> : null}
      </Fragment>)}
    </> : null}
    {data && editor ? <TaskSheet key={editor.mode === "edit" ? editor.id : "new"} editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
    {data && noteEditor ? <NoteSheet key={noteEditor.mode === "edit" ? noteEditor.id : "new"} editor={noteEditor} data={data} onClose={() => setNoteEditor(null)} compact /> : null}
    <Modal visible={arranging} transparent animationType="fade" onRequestClose={() => setArranging(false)}>
      <View style={s.arrangeBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setArranging(false)} accessibilityRole="button" accessibilityLabel="Close Home arrangement" />
        <View style={s.arrangeSheet} accessibilityViewIsModal>
          <View style={s.arrangeHead}><Text style={s.arrangeTitle}>Arrange Home</Text><Pressable onPress={() => setArranging(false)} style={s.arrangeButton} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={17} tint={c.text2} /></Pressable></View>
          <Text style={s.arrangeHint}>Move sections up or down. Saved on this phone.</Text>
          <ScrollView>
            {prefs.order.map((panel, index) => <View key={panel} style={s.arrangeRow}>
              <Text style={s.arrangeLabel}>{HOME_LABELS[panel]}</Text>
              {([-1, 1] as const).map(direction => <Pressable key={direction} onPress={() => updatePrefs({ order: moveHomePanel(prefs.order, panel, direction) })} disabled={direction === -1 ? index === 0 : index === prefs.order.length - 1} style={[s.arrangeButton, (direction === -1 ? index === 0 : index === prefs.order.length - 1) && s.arrangeDisabled]} accessibilityRole="button" accessibilityLabel={`Move ${HOME_LABELS[panel]} ${direction === -1 ? "up" : "down"}`}><Icon name={direction === -1 ? "chevron-up" : "chevron-down"} size={17} tint={c.text2} /></Pressable>)}
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </WorkspacePage>
}

function MiniAction({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.miniAction} accessibilityRole="button"><Text style={s.actionText}>{label}</Text></Pressable> }
/**
 * One selectable row: a Title / Due / Tag table row. The first tap selects it (highlighted bar, labelled property chips, a note
 * preview and Open / Done / Star pills open under it); a second tap on the selected row, or "Open", opens its editor.
 */
function Line({ title, subtitle, icon, date, due, tag, chips = [], detail, selected, starred, nested = false, onSelect, onOpen, onComplete, onStar }: { title: string; subtitle?: string; icon?: "calendar-outline" | "document-text-outline"; date?: string; due?: DueCell; tag?: TagCell; chips?: RowChip[]; detail?: string; selected: boolean; starred?: boolean; nested?: boolean; onSelect: () => void; onOpen: () => void; onComplete?: () => void; onStar?: () => void }) {
  const { width, fontScale } = useWindowDimensions()
  const narrow = width / fontScale < 380
  const parts = date ? dateParts(date) : undefined
  return <View style={[s.item, selected && s.itemOn, nested && s.itemNested]}>
    <View style={[s.row, narrow && s.rowWrap]}>
      {onComplete ? <TaskCheck checked={false} compact onPress={onComplete} label={`Complete ${title}`} /> : parts ? <View style={s.dateBlock} accessible accessibilityLabel={`${parts.month} ${parts.day}`}><Text style={s.dateMonth}>{parts.month}</Text><Text style={s.dateDay}>{parts.day}</Text></View> : <View style={s.simpleIcon}><Icon name={icon ?? "document-text-outline"} size={17} tint={c.accent} /></View>}
      <Pressable onPress={selected ? onOpen : onSelect} style={[s.rowBody, narrow && s.rowBodyNarrow]} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={selected ? `Open ${title} to edit` : `Preview ${title}`}><Text style={s.rowTitle} >{title}</Text>{subtitle ? <Text style={s.meta} numberOfLines={1}>{subtitle}</Text> : null}</Pressable>
      {due ? <Text style={[s.dueText, due.tone === "today" && s.dueToday, due.tone === "overdue" && s.dueOver]} >{due.text}</Text> : null}
      {tag ? <View style={s.tagCol}><PropChip readable kind={tag.kind} value={tag.text} /></View> : null}
    </View>
    {selected ? <View style={[s.strip, nested && s.stripNested]}>
      {chips.length ? <View style={s.chips}>{chips.map(chip => <PropChip readable key={chip.key} kind={chipKind[chip.kind]} label={chip.tag} value={chip.value ?? chip.label} />)}</View> : null}
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
  headerDate: { color: kit.hue.journal, fontFamily: mono, fontSize: 11, fontWeight: "700" },
  arrangeTrigger: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  arrangeBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: 20 },
  arrangeSheet: { width: "100%", maxWidth: 330, maxHeight: "80%", backgroundColor: c.panel, borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  arrangeHead: { minHeight: 39, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: c.line },
  arrangeTitle: { flex: 1, color: c.text, fontSize: 14, fontWeight: "700" },
  arrangeHint: { color: c.muted, fontSize: 11, paddingHorizontal: 12, paddingVertical: 8 },
  arrangeRow: { minHeight: 38, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 4, borderTopWidth: 1, borderTopColor: c.line },
  arrangeLabel: { flex: 1, color: c.text2, fontSize: 12 },
  arrangeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  arrangeDisabled: { opacity: 0.25 },
  learningGroup: { marginTop: 5, backgroundColor: kit.courseGroup.surface },
  groupHead: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 7, backgroundColor: kit.courseGroup.header, borderBottomWidth: 1, borderColor: kit.courseGroup.line },
  groupTitle: { flex: 1, minWidth: 0, color: c.text, fontSize: 12, fontWeight: "700" },
  groupPct: { minWidth: 30, textAlign: "right", color: kit.hue.learning, fontFamily: mono, fontSize: 11, fontWeight: "700" },
  groupCount: { minWidth: 18, minHeight: 18, borderRadius: 9, paddingHorizontal: 4, textAlign: "center", backgroundColor: c.raised, color: c.text2, fontFamily: mono, fontSize: 11, fontWeight: "700", paddingVertical: 2 },
  courseBody: { marginLeft: 14, borderLeftWidth: 2, borderLeftColor: kit.courseGroup.rail },
  item: { borderBottomWidth: 1, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: "transparent" },
  itemOn: { backgroundColor: c.selected, borderLeftColor: c.accent },
  itemNested: { borderLeftWidth: 0 },
  row: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 4 },
  rowWrap: { flexWrap: "wrap", paddingBottom: 4 },
  rowBodyNarrow: { flexBasis: "75%" },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: 3 },
  rowTitle: { color: c.text, fontSize: 14, fontWeight: "600", lineHeight: 17 },
  simpleIcon: { width: 32, alignItems: "center" },
  strip: { gap: 5, paddingLeft: 31, paddingRight: 7, paddingBottom: 6 },
  stripNested: { paddingLeft: 27 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detail: { color: c.text2, fontSize: 11, lineHeight: 15 },
  stripActions: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pill: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, borderRadius: 8, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border },
  pillText: { color: c.accent, fontSize: 11, fontWeight: "600" },
  pillPrimary: { backgroundColor: c.action, borderColor: c.selectedBorder },
  pillPrimaryText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  dateBlock: { minWidth: 34, minHeight: 34, padding: 2, marginLeft: 2, borderRadius: 5, backgroundColor: chipTone.date.fill, alignItems: "center", justifyContent: "center" },
  dateMonth: { color: chipTone.date.ink, fontFamily: mono, fontSize: 11, fontWeight: "700" },
  dateDay: { color: chipTone.date.ink, fontSize: 13, fontWeight: "700", lineHeight: 15 },
  dueText: { minWidth: 53, flexShrink: 1, color: c.muted, fontFamily: mono, fontSize: 11 },
  dueToday: { color: chipTone.date.ink },
  dueOver: { color: chipTone.overdue.ink },
  tagCol: { maxWidth: "40%", paddingRight: 5 },
  meta: { color: c.muted, fontSize: 11, lineHeight: 14 },
  recentRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: c.line },
  recentTitle: { flex: 1, minWidth: 0, color: c.text2, fontSize: 14, textDecorationLine: "line-through" },
  recentDate: { color: c.muted, fontFamily: mono, fontSize: 11 },
  sectionLink: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  journalRow: { minHeight: 38, flexDirection: "row", flexWrap: "wrap", paddingVertical: 3, alignItems: "center", gap: 5, paddingHorizontal: 7 },
  journalChip: { minHeight: 32, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line },
  journalChipDone: { backgroundColor: chipTone.status.fill, borderColor: kit.goodBorder },
  journalChipText: { color: c.text2, fontSize: 11, fontWeight: "700" },
  journalChipDoneText: { color: chipTone.status.ink },
  projectRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: c.line },
  projectMark: { width: 7, height: 7, borderRadius: 2, backgroundColor: kit.hue.projects },
  projectTitle: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, fontWeight: "600" },
  emptyText: { color: c.muted, fontSize: 11, paddingVertical: 8, paddingHorizontal: 9 },
  empty: { gap: 8, paddingVertical: 16 },
  title: { color: c.text, fontSize: 15, fontWeight: "700" },
  error: { color: c.errorText, fontSize: 12 },
  miniAction: { minHeight: 32, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 9 },
  actionText: { color: c.accent, fontSize: 11, fontWeight: "600" },
})
