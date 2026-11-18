import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { compareTasks, isForToday, saveJournalItem, type Collections } from "../../../../lib/shared.ts"
import { todayKey } from "../../../data/sync-view.ts"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import { CompactCheckIn } from "../../CompactCheckIn.tsx"
import { SLOTS, hasAnswers, readSlotCheckIn, reviewId, slotForm, writeSlotCheckIn, type Answers, type Slot } from "../../journal-review.ts"

/** The same guided daily questions, reachable from either day's Log. */
export function DailyCheckIns({ data, day, blocked }: { data: Collections; day: string; blocked?: string }) {
  const { mutate } = useWorkspace()
  const [target, setTarget] = useState<Slot | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Answers>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = target ? reviewId("daily", day, target) : ""
  const saved = data.journal.find(entry => entry.id === day)?.entries?.find(item => item.id === key)
  const answers = target ? drafts[key] ?? (saved ? readSlotCheckIn(target, saved.text) : {}) : {}
  const titles = data.tasks.filter(t => t.kind !== "event" && !t.done && isForToday(t, day)).sort(compareTasks).slice(0, 6).map(t => t.title.trim().replace(/\s+/g, " ")).filter(Boolean)
  const future = day > todayKey()

  async function save() {
    if (!target || !hasAnswers(answers) || blocked || saving || day > todayKey()) return
    const slot = target, id = key, value = answers, previous = saved
    setSaving(true); setError(null)
    const now = new Date().toISOString()
    try {
      const ok = await mutate(["journal"], current => saveJournalItem(current, day, { id, text: writeSlotCheckIn(slot, value), createdAt: previous?.createdAt ?? now, updatedAt: now }, false))
      if (!ok) { setError("Couldn't save. Your answers are still here."); return }
      setDrafts(current => { const next = { ...current }; delete next[id]; return next })
      setTarget(null)
    } catch { setError("Couldn't save. Your answers are still here.") }
    finally { setSaving(false) }
  }

  return <>
    <View style={s.row}>{SLOTS.map(slot => {
      const id = reviewId("daily", day, slot.key)
      const done = !!data.journal.find(entry => entry.id === day)?.entries?.find(item => item.id === id)
      return <Pressable key={slot.key} onPress={() => { setTarget(slot.key); setError(null) }} disabled={!!blocked || future} style={[s.button, done && s.done, future && s.disabled]} accessibilityRole="button" accessibilityState={{ disabled: !!blocked || future }} accessibilityLabel={`${slot.label} check-in, ${future ? "available on that day" : done ? "saved, tap to edit" : "not saved"}`}><Text style={[s.label, done && s.doneLabel]} numberOfLines={1}>{slot.label}</Text>{done ? <Icon name="checkmark" size={12} tint={c.accent} /> : null}</Pressable>
    })}</View>
    {target ? <CompactCheckIn key={key} slot={target} day={day} fields={slotForm(target, titles.length ? titles : answers.focus ? [answers.focus] : [])} answers={answers} onChange={(id, value) => { setError(null); setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? answers), [id]: value } })) }} onSave={() => void save()} onClose={() => setTarget(null)} saving={saving} blocked={blocked || (future ? "Check-ins open on their day." : undefined)} error={error} /> : null}
  </>
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }, button: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 7, borderRadius: 10, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, done: { backgroundColor: c.selected, borderColor: c.accent }, label: { color: c.text2, fontSize: 11, fontWeight: "600" }, doneLabel: { color: c.accent },
  disabled: { opacity: 0.45 },
})
