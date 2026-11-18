import { useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { compareTasks, isForToday, saveJournalItem, type Collections } from "../../../../lib/shared.ts"
import { shape } from "../../../../shape.ts"
import { KeyboardFrame, KeyboardScrollView } from "../../../editing/keyboard.tsx"
import { useWorkspace } from "../../../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import { CheckInForm } from "../../CheckInForm.tsx"
import { SLOTS, hasAnswers, readSlotCheckIn, reviewId, slotForm, writeSlotCheckIn, type Answers, type Slot } from "../../journal-review.ts"
import { formatDay } from "../dates.ts"

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

  async function save() {
    if (!target || !hasAnswers(answers) || blocked || saving) return
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
      return <Pressable key={slot.key} onPress={() => { setTarget(slot.key); setError(null) }} disabled={!!blocked} style={[s.button, done && s.done]} accessibilityRole="button" accessibilityLabel={`${slot.label} check-in, ${done ? "saved, tap to edit" : "not saved"}`}><Text style={[s.label, done && s.doneLabel]} numberOfLines={1}>{slot.label}</Text>{done ? <Icon name="checkmark" size={12} tint={c.accent} /> : null}</Pressable>
    })}</View>
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
      <KeyboardFrame style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
        <View style={s.head}><View style={s.grow}><Text style={s.title}>{target ? `${target[0].toUpperCase()}${target.slice(1)} check-in` : "Check-in"}</Text><Text style={s.hint}>{formatDay(day)}</Text></View><Pressable onPress={() => setTarget(null)} style={s.close} accessibilityRole="button" accessibilityLabel="Close check-in"><Icon name="close" tint={c.text2} /></Pressable></View>
        <KeyboardScrollView style={s.scroll} contentContainerStyle={s.fields} keyboardShouldPersistTaps="handled">{target ? <CheckInForm fields={slotForm(target, titles)} answers={answers} onChange={(id, value) => { setError(null); setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? answers), [id]: value } })) }} /> : null}{error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}</KeyboardScrollView>
        <Pressable onPress={() => void save()} disabled={!hasAnswers(answers) || !!blocked || saving} style={[s.save, (!hasAnswers(answers) || !!blocked || saving) && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{saving ? "Saving…" : "Save check-in"}</Text></Pressable>
      </View></KeyboardFrame>
    </Modal>
  </>
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }, button: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 7, borderRadius: 10, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, done: { backgroundColor: c.selected, borderColor: c.accent }, label: { color: c.text2, fontSize: 11, fontWeight: "600" }, doneLabel: { color: c.accent },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }, dialog: { maxHeight: "88%", padding: 14, borderRadius: shape.dialog, backgroundColor: c.raised, gap: 12 }, head: { flexDirection: "row", alignItems: "center", gap: 10 }, grow: { flex: 1 }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, hint: { color: c.muted, fontSize: 12 }, close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" }, scroll: { flexShrink: 1 }, fields: { gap: 10, paddingBottom: 10 }, save: { minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: c.action }, saveText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.45 }, error: { color: c.errorText, fontSize: 11 },
})
