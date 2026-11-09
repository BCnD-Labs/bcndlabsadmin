import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { TextInput } from "../../editing/keyboard.tsx"
import { defaultMakeId, type Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"
import { DatePicker } from "./DatePicker.tsx"
import { shortDay } from "./dates.ts"
import { TaskCheck } from "./TaskCheck.tsx"

type Step = NonNullable<Collections["tasks"][number]["subtasks"]>[number]

/** Small steps inside a task. A day on a step puts it on that day's plan in Today and Week. */
export function StepsSection({ steps, onChange, today, onPlanStudy }: { steps: Step[]; onChange: (next: Step[]) => void; today: string; onPlanStudy?: () => void }) {
  const [title, setTitle] = useState("")
  const [dayFor, setDayFor] = useState<string | null>(null)
  const patch = (id: string, change: Partial<Step>) => onChange(steps.map(s => s.id === id ? { ...s, ...change } : s))
  const add = () => { if (!title.trim() || steps.length >= 100) return; onChange([...steps, { id: defaultMakeId("sub"), title: title.trim().slice(0, 300), done: false }]); setTitle("") }
  return <View style={s.wrap}>
    {steps.map(step => <View key={step.id} style={s.block}>
      <View style={s.row}>
        <TaskCheck checked={step.done} onPress={() => patch(step.id, { done: !step.done })} label={`${step.title}: ${step.done ? "reopen" : "done"}`} compact />
        <TextInput style={[s.input, s.grow, step.done && s.done]} value={step.title} onChangeText={value => patch(step.id, { title: value })} accessibilityLabel="Step" maxLength={300} placeholderTextColor={c.muted} />
        <Pressable onPress={() => setDayFor(v => v === step.id ? null : step.id)} style={[s.day, !!step.date && s.dayOn]} accessibilityRole="button" accessibilityLabel={`Day for ${step.title}: ${step.date ? shortDay(step.date) : "none"}`}><Text style={s.dayText}>{step.date ? shortDay(step.date) : "+ Day"}</Text></Pressable>
        <Pressable onPress={() => onChange(steps.filter(x => x.id !== step.id))} style={s.trash} accessibilityRole="button" accessibilityLabel={`Remove ${step.title}`}><Icon name="trash-outline" size={17} tint={c.muted} /></Pressable>
      </View>
      {dayFor === step.id ? <View>
        <DatePicker value={step.date ?? ""} today={today} onChange={date => { patch(step.id, { date: date || undefined }); setDayFor(null) }} />
        {step.date ? <Pressable onPress={() => { patch(step.id, { date: undefined }); setDayFor(null) }} style={s.clear} accessibilityRole="button" accessibilityLabel="Clear day"><Text style={s.dayText}>Clear day</Text></Pressable> : null}
      </View> : null}
    </View>)}
    <View style={s.row}>
      <TextInput style={[s.input, s.grow]} value={title} onChangeText={setTitle} onSubmitEditing={add} placeholder="Add a step: outline, draft, proofread…" placeholderTextColor={c.muted} accessibilityLabel="New step" returnKeyType="done" maxLength={300} />
      <Pressable onPress={add} disabled={!title.trim()} style={[s.add, !title.trim() && s.off]} accessibilityRole="button" accessibilityLabel="Add step"><Text style={s.addText}>Add</Text></Pressable>
    </View>
    {onPlanStudy ? <Pressable onPress={onPlanStudy} style={s.study} accessibilityRole="button" accessibilityLabel="Plan my studying"><Icon name="book-outline" size={15} tint={c.accent} /><Text style={s.addText}>Plan my studying</Text></Pressable> : null}
  </View>
}

const s = StyleSheet.create({
  wrap: { gap: 6 }, block: { gap: 4 }, row: { flexDirection: "row", alignItems: "center", gap: 6 }, grow: { flex: 1 },
  input: { minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.ground, color: c.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 }, done: { color: c.muted, textDecorationLine: "line-through" },
  day: { minHeight: 34, paddingHorizontal: 9, borderRadius: 12, justifyContent: "center", backgroundColor: c.raised }, dayOn: { backgroundColor: c.selected, borderWidth: 1, borderColor: c.selectedBorder }, dayText: { color: c.accent, fontSize: 12 },
  trash: { width: 32, height: 34, alignItems: "center", justifyContent: "center" }, clear: { alignSelf: "flex-start", minHeight: 30, justifyContent: "center", paddingHorizontal: 6 },
  add: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12, justifyContent: "center", backgroundColor: c.raised }, off: { opacity: 0.45 }, addText: { color: c.accent, fontSize: 12, fontWeight: "600" },
  study: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.raised },
})
