import { useState } from "react"
import { shape } from "../../shape.ts"
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
import { CHECKS, CHECK_LABELS, EMPTY_CHECK_IN, SLOTS, checkInSummary, formWording, hasAnswers, hasCheckIn, nextPeriod, periodStart, readCheckIn, readSlotCheckIn, reviewId, slotForHour, slotForm, slotLabel, slotSummary, writeCheckIn, writeSlotCheckIn, type Answers, type CheckIn, type Period, type Slot } from "./journal-review.ts"
import { CheckInForm } from "./CheckInForm.tsx"
import { compareTasks, isForToday } from "../../lib/shared.ts"
import { chipTone, kit } from "../kit/tokens.ts"
import { PropChip } from "../kit/PropChip.tsx"
import { WorkspaceSection } from "../WorkspacePage.tsx"

const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"]
const MOODS = ["Great", "Okay", "Low", "Rough"]
const ENERGY = ["High", "Medium", "Low"]

/** Journal entries share the existing workspace with the web and Mac apps. Review text stays readable there. */
export function JournalScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [period, setPeriod] = useState<Period>("daily")
  const [reflections, setReflections] = useState(false)
  const [learningEditor, setLearningEditor] = useState<LearningReflection | "new" | null>(null)
  const [day, setDay] = useState(() => todayKey())
  /** The check-in being answered. No slot means the whole period (a review) or the earlier one-per-day check-in. */
  const [target, setTarget] = useState<{ slot?: Slot } | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CheckIn>>({})
  const [slotDrafts, setSlotDrafts] = useState<Record<string, Answers>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayKey(), access = editAccess(status, true)
  const logs = useLogDrafts(data?.journal, mutate, access.ok)
  const anchor = periodStart(period, day)
  const day0 = data?.journal.find(entry => entry.id === anchor)
  const savedFor = (slot?: Slot) => day0?.entries?.find(item => item.id === reviewId(period, anchor, slot))
  const key = reviewId(period, anchor, target?.slot)
  const saved = target ? savedFor(target.slot) : undefined
  const form = drafts[key] ?? (saved ? readCheckIn(saved.text) : EMPTY_CHECK_IN)
  const words = formWording(period)
  const slot = period === "daily" ? target?.slot : undefined
  const slotAnswers = slot ? slotDrafts[key] ?? (saved ? readSlotCheckIn(slot, saved.text) : {}) : {}
  const todayTitles = (data?.tasks ?? []).filter(t => t.kind !== "event" && !t.done && isForToday(t, today)).sort(compareTasks).slice(0, 6).map(t => t.title.trim().replace(/\s+/g, " ")).filter(Boolean)
  const canSave = slot ? hasAnswers(slotAnswers) : hasCheckIn(form)
  const nowSlot = day === today ? slotForHour(new Date().getHours()) : undefined
  const end = nextPeriod(period, anchor, 1)
  const entries = data?.journal.filter(entry => entry.id >= anchor && entry.id < end && (entry.text.trim() || entry.sections?.length || entry.entries?.some(item => !item.courseId && !item.taskId))) ?? []
  const label = period === "daily" ? formatDay(anchor) : period === "weekly" ? weekRangeLabel(anchor) : period === "monthly" ? new Date(`${anchor}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }) : anchor.slice(0, 4)

  function answer(id: string, value: string) { setError(null); setSlotDrafts(current => ({ ...current, [key]: { ...(current[key] ?? slotAnswers), [id]: value } })) }
  function update(patch: Partial<CheckIn>) { setError(null); setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? form), ...patch } })) }
  function open(slot?: Slot) { setError(null); setTarget({ slot }) }
  async function save() {
    if (!data || !access.ok || !target || !canSave || saving) return
    setSaving(true); setError(null)
    const now = new Date().toISOString(), value = { id: key, text: slot ? writeSlotCheckIn(slot, slotAnswers) : writeCheckIn(period, form), createdAt: saved?.createdAt ?? now, updatedAt: now }
    try {
      const ok = await mutate(["journal"], current => saveJournalItem(current, anchor, value, false))
      if (!ok) { setError("Couldn't save. Your answers are still here."); return }
      setDrafts(current => { const next = { ...current }; delete next[key]; return next })
      setSlotDrafts(current => { const next = { ...current }; delete next[key]; return next })
      setTarget(null)
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
        {period === "daily" ? <WorkspaceSection title="Check-ins" icon="checkmark-circle-outline" tint={chipTone.status.ink} count={`${SLOTS.filter(x => savedFor(x.key)).length} of 3 done`}>
          <View style={s.slots}>
            <Text style={s.hint}>Three quick check-ins a day, mostly taps. Tap one to answer. It turns green once it is saved.</Text>
            {SLOTS.map(x => <CheckInButton key={x.key} title={x.label} blurb={x.blurb} icon={x.key === "morning" ? "sunny-outline" : x.key === "afternoon" ? "partly-sunny-outline" : "moon-outline"} summary={savedFor(x.key) ? slotSummary(x.key, readSlotCheckIn(x.key, savedFor(x.key)!.text)) : undefined} saved={!!savedFor(x.key)} draft={!!slotDrafts[reviewId(period, anchor, x.key)]} now={nowSlot === x.key} disabled={!access.ok} onPress={() => open(x.key)} />)}
            {savedFor() ? <CheckInButton title="Earlier check-in" blurb="Saved before the three daily check-ins" icon="time-outline" summary={savedFor() ? checkInSummary(readCheckIn(savedFor()!.text)) : undefined} saved={!!savedFor()} draft={!!drafts[reviewId(period, anchor)]} disabled={!access.ok} onPress={() => open()} /> : null}
          </View>
        </WorkspaceSection> : <WorkspaceSection title={formWording(period).title} icon="checkmark-circle-outline" tint={chipTone.status.ink}>
          <View style={s.slots}>
            <CheckInButton title={formWording(period).title} blurb={`A short look back at the ${period.slice(0, -2)}`} icon="create-outline" summary={savedFor() ? checkInSummary(readCheckIn(savedFor()!.text)) : undefined} saved={!!savedFor()} draft={!!drafts[reviewId(period, anchor)]} disabled={!access.ok} onPress={() => open()} />
          </View>
        </WorkspaceSection>}
        {period === "daily" ? <WorkspaceSection title="Log" icon="book-outline" tint={c.accent}><View style={s.slots}><Text style={s.hint}>Type anything, any time of day. Entries are saved under the day shown above.</Text><LogView data={data} today={today} day={day} onDay={setDay} logs={logs} blocked={access.reason} onEditTask={setTaskId} hideNav heading="Log" /></View></WorkspaceSection> : <>
          <Text style={s.sectionTitle}>Entries in this {period.slice(0, -2) || "day"} · {entries.length}</Text>
          {entries.length ? entries.slice().reverse().slice(0, 20).map(entry => <View key={entry.id} style={s.entry}><Text style={s.entryDay}>{shortDay(entry.id)}</Text><Text style={s.preview} numberOfLines={3}>{[entry.text, ...(entry.entries ?? []).filter(item => !item.courseId && !item.taskId).map(item => item.text)].filter(Boolean).join("\n") || "Section entries"}</Text></View>) : <Text style={s.hint}>No entries in this period yet.</Text>}
        </>}</>}
      </>}
    </KeyboardScrollView>
    {data && learningEditor ? <LearningReflectionSheet key={learningEditor === "new" ? "new" : learningEditor.item.id} data={data} entry={learningEditor === "new" ? undefined : learningEditor} onClose={() => setLearningEditor(null)} /> : null}
    {data && taskId ? <TaskSheet key={taskId} editor={{ mode: "edit", id: taskId }} data={data} today={today} onClose={() => setTaskId(null)} /> : null}
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
      <KeyboardFrame style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal><View style={s.cardHead}><View style={s.flex}><Text style={s.cardTitle}>{slot ? `${slotLabel(slot)} check-in` : words.title}</Text><Text style={s.hint}>{label}</Text></View><Pressable onPress={() => setTarget(null)} accessibilityRole="button" accessibilityLabel="Close check-in"><Icon name="close" tint={c.text2} /></Pressable></View>
        <KeyboardScrollView style={s.formScroll} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          {slot ? <CheckInForm fields={slotForm(slot, todayTitles)} answers={slotAnswers} onChange={answer} /> : <>
          <View style={s.field}><Text style={s.question}>{words.mood}</Text><Text style={s.qhint}>Pick one</Text><View style={s.choices}>{MOODS.map(value => <Choice key={value} label={value} selected={form.mood === value} onPress={() => update({ mood: form.mood === value ? "" : value })} />)}</View></View>
          <View style={s.field}><Text style={s.question}>{words.energy}</Text><Text style={s.qhint}>Pick one</Text><View style={s.choices}>{ENERGY.map(value => <Choice key={value} label={value} selected={form.energy === value} onPress={() => update({ energy: form.energy === value ? "" : value })} />)}</View></View>
          <View style={s.field}><Text style={s.question}>{words.checks}</Text><Text style={s.qhint}>Pick any</Text><View style={s.choices}>{CHECKS.map(value => <Choice key={value} label={CHECK_LABELS[value]} selected={form.checks.includes(value)} onPress={() => update({ checks: form.checks.includes(value) ? form.checks.filter(x => x !== value) : [...form.checks, value] })} />)}</View></View>
          {words.prompts.map(prompt => <View key={prompt.key} style={s.field}><Text style={s.question}>{prompt.question}</Text><Text style={s.qhint}>Optional</Text><TextInput value={form[prompt.key]} onChangeText={value => update({ [prompt.key]: value })} placeholder="A few words is plenty" placeholderTextColor={c.muted} style={s.input} accessibilityLabel={prompt.question} /></View>)}
          <View style={s.field}><Text style={s.question}>{words.notes}</Text><TextInput value={form.notes} onChangeText={value => update({ notes: value })} multiline textAlignVertical="top" placeholder="Write as much or as little as you like…" placeholderTextColor={c.muted} style={[s.input, s.notes]} accessibilityLabel={words.notes} /></View>
          </>}
          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </KeyboardScrollView><Pressable onPress={() => void save()} disabled={!canSave || !access.ok || saving} style={[s.save, (!canSave || saving) && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{saving ? "Saving…" : slot ? `Save ${slot} check-in` : words.save}</Text></Pressable>
      </View></KeyboardFrame>
    </Modal>
  </KeyboardFrame>
}

/** One check-in as a full-width button. Grey while empty; green with a check once it has been saved. */
function CheckInButton({ title, blurb, icon, saved, summary, draft, now, disabled, onPress }: { title: string; blurb: string; icon: "sunny-outline" | "partly-sunny-outline" | "moon-outline" | "time-outline" | "create-outline"; saved: boolean; summary?: string; draft: boolean; now?: boolean; disabled: boolean; onPress: () => void }) {
  const done = saved
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.slot, done && s.slotDone, pressed && s.slotPressed, disabled && s.disabled]} accessibilityRole="button" accessibilityLabel={`${title}, ${done ? "done. Tap to edit" : "not done yet. Tap to add"}`}>
    <View style={[s.slotIcon, done && s.slotIconDone]}><Icon name={icon} size={18} tint={done ? chipTone.status.ink : c.accent} /></View>
    <View style={s.flex}>
      <Text style={[s.slotTitle, done && { color: chipTone.status.ink }]}>{title}</Text>
      <Text style={[s.hint, draft && { color: c.amber }]} numberOfLines={2}>{draft ? "Unsaved answers kept on this screen" : done ? summary || "Saved" : blurb}</Text>
    </View>
    {now && !done ? <PropChip kind="date" value="NOW" /> : null}
    {done ? <Icon name="checkmark-circle" size={24} tint={kit.good} /> : <Icon name="chevron-forward" size={16} tint={c.muted} />}
  </Pressable>
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.choice, selected && s.choiceOn]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={[s.tabText, selected && s.accent]}>{selected ? "✓ " : ""}{label}</Text></Pressable>
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 }, breadcrumb: { color: c.text, fontSize: 13, fontWeight: "600" }, muted: { color: c.muted, fontWeight: "400" }, accent: { color: c.accent, fontWeight: "600" },
  flex: { flex: 1, minWidth: 0 }, slots: { gap: 8, paddingVertical: 8 }, slot: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: shape.card, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line }, slotDone: { backgroundColor: chipTone.status.fill, borderColor: "#2f6b3f" }, slotPressed: { opacity: 0.8 }, slotIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, slotIconDone: { backgroundColor: "#173022", borderColor: "#2f6b3f" }, slotTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, qhint: { color: c.muted, fontSize: 11 },
  tabs: { flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingBottom: 8 }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 32, borderRadius: 16, backgroundColor: c.panel }, tabOn: { backgroundColor: c.selected }, tabText: { color: c.text2, fontSize: 12 }, content: { padding: 14, paddingBottom: NAV_CLEARANCE, gap: 12 },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 }, arrow: { width: 34, height: 42, alignItems: "center", justifyContent: "center" }, title: { flex: 1, color: c.text, fontSize: 16, fontWeight: "700" }, today: { padding: 9, borderRadius: 16, backgroundColor: c.panel }, card: { padding: 12, borderRadius: shape.card, backgroundColor: c.panel, gap: 8 }, cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, cardTitle: { flex: 1, color: c.text, fontSize: 15, fontWeight: "700" }, action: { minHeight: 32, justifyContent: "center" }, hint: { color: c.muted, fontSize: 12, lineHeight: 18 }, preview: { color: c.text2, fontSize: 12, lineHeight: 19 }, sectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" }, entry: { borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 8, gap: 3 }, entryDay: { color: c.accent, fontSize: 12, fontWeight: "600" },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }, dialog: { maxHeight: "88%", padding: 14, borderRadius: shape.dialog, backgroundColor: c.raised, gap: 12 }, formScroll: { flexShrink: 1 }, form: { gap: 10, paddingBottom: 10 }, question: { color: c.text, fontSize: 13, fontWeight: "600" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, choice: { minHeight: 32, justifyContent: "center", borderRadius: 16, paddingHorizontal: 10, backgroundColor: c.panel }, choiceOn: { backgroundColor: c.selected }, field: { gap: 5 }, input: { color: c.text, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 40, fontSize: 13 }, notes: { minHeight: 92, paddingTop: 10 }, error: { color: "#ff8787", fontSize: 12 }, save: { alignItems: "center", justifyContent: "center", minHeight: 40, borderRadius: 8, backgroundColor: c.action }, saveText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.45 },
})
