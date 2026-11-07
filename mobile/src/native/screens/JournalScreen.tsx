import { useState } from "react"
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native"
import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { saveJournalItem } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { SyncStatus } from "../data/SyncStatus.tsx"
import { todayKey } from "../data/sync-view.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon, NAV_CLEARANCE } from "../ui.tsx"
import { TaskSheet } from "./planner/TaskSheet.tsx"
import { editAccess } from "./planner/task-form.ts"
import { formatDay, shortDay, weekRangeLabel } from "./planner/dates.ts"
import { LogView } from "./planner/log/LogView.tsx"
import { useLogDrafts } from "./planner/log/useLogDrafts.ts"
import { LearningReflectionSheet, ReflectionList, type LearningReflection } from "./LearningReflections.tsx"
import { CHECKS, EMPTY_CHECK_IN, hasCheckIn, nextPeriod, periodStart, readCheckIn, reviewId, writeCheckIn, type CheckIn, type Period } from "./journal-review.ts"

const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"]
const MOODS = ["Great", "Okay", "Low", "Rough"]
const ENERGY = ["High", "Medium", "Low"]
const QUESTIONS: Record<Period, { win: string; hard: string; grateful: string }> = {
  daily: { win: "A win today", hard: "A hard part", grateful: "Grateful for" },
  weekly: { win: "Best part this week", hard: "What got in the way", grateful: "Worth remembering" },
  monthly: { win: "This month's progress", hard: "What to change", grateful: "Worth remembering" },
  yearly: { win: "What grew this year", hard: "What I learned the hard way", grateful: "What mattered" },
}

/** Journal entries share the existing workspace with the web and Mac apps. Review text stays readable there. */
export function JournalScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [period, setPeriod] = useState<Period>("daily")
  const [reflections, setReflections] = useState(false)
  const [learningEditor, setLearningEditor] = useState<LearningReflection | "new" | null>(null)
  const [day, setDay] = useState(() => todayKey())
  const [editing, setEditing] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CheckIn>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayKey(), access = editAccess(status, true)
  const logs = useLogDrafts(data?.journal, mutate, access.ok)
  const anchor = periodStart(period, day), key = reviewId(period, anchor)
  const saved = data?.journal.find(entry => entry.id === anchor)?.entries?.find(item => item.id === key)
  const form = drafts[key] ?? (saved ? readCheckIn(saved.text) : EMPTY_CHECK_IN)
  const end = nextPeriod(period, anchor, 1)
  const entries = data?.journal.filter(entry => entry.id >= anchor && entry.id < end && (entry.text.trim() || entry.sections?.length || entry.entries?.some(item => !item.courseId && !item.taskId))) ?? []
  const label = period === "daily" ? formatDay(anchor) : period === "weekly" ? weekRangeLabel(anchor) : period === "monthly" ? new Date(`${anchor}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }) : anchor.slice(0, 4)

  function update(patch: Partial<CheckIn>) { setError(null); setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? form), ...patch } })) }
  function open() { setError(null); setEditing(true) }
  async function save() {
    if (!data || !access.ok || !hasCheckIn(form) || saving) return
    setSaving(true); setError(null)
    const now = new Date().toISOString(), value = { id: key, text: writeCheckIn(period, form), createdAt: saved?.createdAt ?? now, updatedAt: now }
    try {
      const ok = await mutate(["journal"], current => saveJournalItem(current, anchor, value, false))
      if (!ok) { setError("Couldn't save. Your answers are still here."); return }
      setDrafts(current => { const next = { ...current }; delete next[key]; return next })
      setEditing(false)
    } catch { setError("Couldn't save. Your answers are still here.") }
    finally { setSaving(false) }
  }

  return <KeyboardFrame style={s.fill}>
    <View style={s.header}><Text style={s.breadcrumb}>Blackwall <Text style={s.muted}>/ Journal</Text></Text><SyncStatus onOpenSettings={onOpenSettings} /></View>
    <View style={s.tabs} accessibilityRole="tablist">{PERIODS.map(p => <Pressable key={p} onPress={() => { setPeriod(p); setReflections(false); setError(null) }} style={[s.tab, period === p && !reflections && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: period === p && !reflections }}><Text style={[s.tabText, period === p && !reflections && s.accent]}>{p[0].toUpperCase() + p.slice(1)}</Text></Pressable>)}<Pressable onPress={() => setReflections(true)} style={[s.tab, reflections && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: reflections }}><Text style={[s.tabText, reflections && s.accent]}>Reflections</Text></Pressable></View>
    <KeyboardScrollView style={s.fill} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} colors={[c.accent]} />}>
      {!data ? <Text style={s.hint}>{status === "signed-out" ? "Sign in from Settings to use Journal." : message ?? "Loading Journal…"}</Text> : <>
        {message && status !== "ok" ? <Text style={s.hint}>{message}</Text> : null}
        {reflections ? <><View style={s.cardHead}><Text style={s.sectionTitle}>Learning reflections</Text><Pressable onPress={() => setLearningEditor("new")} disabled={!access.ok} accessibilityRole="button"><Text style={s.accent}>+ Reflect</Text></Pressable></View><ReflectionList data={data} onEdit={setLearningEditor} /></> : <><View style={s.nav}><Pressable onPress={() => setDay(nextPeriod(period, anchor, -1))} style={s.arrow} accessibilityRole="button" accessibilityLabel={`Previous ${period}`}><Icon name="chevron-back" tint={c.text2} /></Pressable><Text style={s.title} accessibilityRole="header">{label}</Text><Pressable onPress={() => setDay(nextPeriod(period, anchor, 1))} style={s.arrow} accessibilityRole="button" accessibilityLabel={`Next ${period}`}><Icon name="chevron-forward" tint={c.text2} /></Pressable><Pressable onPress={() => setDay(today)} style={s.today} accessibilityRole="button"><Text style={s.accent}>Today</Text></Pressable></View>
        <View style={s.card}><View style={s.cardHead}><Text style={s.cardTitle}>{period === "daily" ? "Daily check-in" : `${period[0].toUpperCase()}${period.slice(1)} review`}</Text><Pressable disabled={!access.ok} onPress={open} style={s.action} accessibilityRole="button" accessibilityLabel={saved ? "Edit guided check-in" : "Add guided check-in"}><Text style={s.accent}>{saved ? "Edit" : "+ Check in"}</Text></Pressable></View>
          {saved ? <Text style={s.preview}>{saved.text}</Text> : <Text style={s.hint}>A few taps or one word is enough. Writing more is optional.</Text>}
          {drafts[key] ? <Text style={s.hint}>Unsaved answers kept on this screen.</Text> : null}
        </View>
        {period === "daily" ? <LogView data={data} today={today} day={day} onDay={setDay} logs={logs} blocked={access.reason} onEditTask={setTaskId} /> : <>
          <Text style={s.sectionTitle}>Entries in this {period.slice(0, -2) || "day"} · {entries.length}</Text>
          {entries.length ? entries.slice().reverse().slice(0, 20).map(entry => <View key={entry.id} style={s.entry}><Text style={s.entryDay}>{shortDay(entry.id)}</Text><Text style={s.preview} numberOfLines={3}>{[entry.text, ...(entry.entries ?? []).filter(item => !item.courseId && !item.taskId).map(item => item.text)].filter(Boolean).join("\n") || "Section entries"}</Text></View>) : <Text style={s.hint}>No entries in this period yet.</Text>}
        </>}</>}
      </>}
    </KeyboardScrollView>
    {data && learningEditor ? <LearningReflectionSheet key={learningEditor === "new" ? "new" : learningEditor.item.id} data={data} entry={learningEditor === "new" ? undefined : learningEditor} onClose={() => setLearningEditor(null)} /> : null}
    {data && taskId ? <TaskSheet key={taskId} editor={{ mode: "edit", id: taskId }} data={data} today={today} onClose={() => setTaskId(null)} /> : null}
    <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
      <KeyboardFrame style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal><View style={s.cardHead}><Text style={s.cardTitle}>Your {period} check-in</Text><Pressable onPress={() => setEditing(false)} accessibilityRole="button" accessibilityLabel="Close check-in"><Icon name="close" tint={c.text2} /></Pressable></View>
        <KeyboardScrollView style={s.formScroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.question}>How did it feel?</Text><View style={s.choices}>{MOODS.map(value => <Choice key={value} label={value} selected={form.mood === value} onPress={() => update({ mood: form.mood === value ? "" : value })} />)}</View>
          <Text style={s.question}>Energy</Text><View style={s.choices}>{ENERGY.map(value => <Choice key={value} label={value} selected={form.energy === value} onPress={() => update({ energy: form.energy === value ? "" : value })} />)}</View>
          <Text style={s.question}>What happened?</Text><View style={s.choices}>{CHECKS.map(value => <Choice key={value} label={value} selected={form.checks.includes(value)} onPress={() => update({ checks: form.checks.includes(value) ? form.checks.filter(x => x !== value) : [...form.checks, value] })} />)}</View>
          {(["win", "hard", "grateful"] as const).map(field => <View key={field} style={s.field}><Text style={s.question}>{QUESTIONS[period][field]}</Text><TextInput value={form[field]} onChangeText={value => update({ [field]: value })} placeholder="A word or short phrase" placeholderTextColor={c.muted} style={s.input} accessibilityLabel={QUESTIONS[period][field]} /></View>)}
          <Text style={s.question}>Anything else? (optional)</Text><TextInput value={form.notes} onChangeText={value => update({ notes: value })} multiline textAlignVertical="top" placeholder="Write as much or as little as you like…" placeholderTextColor={c.muted} style={[s.input, s.notes]} accessibilityLabel="Optional journal writing" />
          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </KeyboardScrollView><Pressable onPress={() => void save()} disabled={!hasCheckIn(form) || !access.ok || saving} style={[s.save, (!hasCheckIn(form) || saving) && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{saving ? "Saving…" : "Save check-in"}</Text></Pressable>
      </View></KeyboardFrame>
    </Modal>
  </KeyboardFrame>
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.choice, selected && s.choiceOn]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={[s.tabText, selected && s.accent]}>{selected ? "✓ " : ""}{label}</Text></Pressable>
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 }, breadcrumb: { color: c.text, fontSize: 13, fontWeight: "600" }, muted: { color: c.muted, fontWeight: "400" }, accent: { color: c.accent, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingBottom: 8 }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: 18, backgroundColor: c.panel }, tabOn: { backgroundColor: c.selected }, tabText: { color: c.text2, fontSize: 12 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE, gap: 12 },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 }, arrow: { width: 34, height: 42, alignItems: "center", justifyContent: "center" }, title: { flex: 1, color: c.text, fontSize: 16, fontWeight: "700" }, today: { padding: 9, borderRadius: 16, backgroundColor: c.panel }, card: { padding: 14, borderRadius: 14, backgroundColor: c.panel, gap: 8 }, cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, cardTitle: { flex: 1, color: c.text, fontSize: 15, fontWeight: "700" }, action: { minHeight: 32, justifyContent: "center" }, hint: { color: c.muted, fontSize: 12, lineHeight: 18 }, preview: { color: c.text2, fontSize: 12, lineHeight: 19 }, sectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, entry: { borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 8, gap: 3 }, entryDay: { color: c.accent, fontSize: 12, fontWeight: "600" },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }, dialog: { maxHeight: "88%", padding: 16, borderRadius: 18, backgroundColor: c.raised, gap: 12 }, formScroll: { flexShrink: 1 }, form: { gap: 10, paddingBottom: 10 }, question: { color: c.text, fontSize: 13, fontWeight: "600" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, choice: { borderRadius: 17, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, choiceOn: { backgroundColor: c.selected, borderColor: c.accent }, field: { gap: 5 }, input: { color: c.text, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 40, fontSize: 13 }, notes: { minHeight: 92, paddingTop: 10 }, error: { color: "#ff8787", fontSize: 12 }, save: { alignItems: "center", justifyContent: "center", minHeight: 42, borderRadius: 12, backgroundColor: c.action }, saveText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.45 },
})
