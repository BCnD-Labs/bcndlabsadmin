import { Pressable, StyleSheet, Text, View } from "react-native"
import { TextInput } from "../../editing/keyboard.tsx"
import { defaultMakeId, MEETING_KINDS, WEEKDAY_LABELS, type ClassMeeting, type MeetingKind } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { plannerColor as p } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"

const WEEK = [1, 2, 3, 4, 5, 6, 0]

/** Weekly class and office-hour times. They repeat between the start and end dates and show on the calendar and in Today. */
export function MeetingsEditor({ value, onChange }: { value: ClassMeeting[]; onChange: (next: ClassMeeting[]) => void }) {
  const patch = (id: string, change: Partial<ClassMeeting>) => onChange(value.map(m => m.id === id ? { ...m, ...change } : m))
  const add = (kind: MeetingKind) => onChange([...value, { id: defaultMakeId("mtg"), kind, days: kind === "office" ? [3] : [1, 3], start: kind === "office" ? "14:00" : "10:00", end: kind === "office" ? "15:00" : "11:15" }])
  return <View style={s.wrap}>
    <Text style={s.label}>Class and office-hour times</Text>
    {value.map(m => <View key={m.id} style={s.row}>
      <View style={s.line}>{MEETING_KINDS.filter(k => k.value !== "other").map(k => <Pressable key={k.value} onPress={() => patch(m.id, { kind: k.value })} style={[s.chip, m.kind === k.value && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: m.kind === k.value }}><Text style={[s.chipText, m.kind === k.value && s.chipTextOn]}>{k.label}</Text></Pressable>)}<View style={s.grow} /><Pressable onPress={() => onChange(value.filter(x => x.id !== m.id))} accessibilityRole="button" accessibilityLabel="Remove this time" style={s.trash}><Icon name="trash-outline" size={17} tint={p.muted} /></Pressable></View>
      <View style={s.line}>{WEEK.map(d => { const on = m.days.includes(d); return <Pressable key={d} onPress={() => { const days = on ? m.days.filter(x => x !== d) : [...m.days, d]; if (days.length) patch(m.id, { days }) }} style={[s.day, on && s.chipOn]} accessibilityRole="button" accessibilityLabel={WEEKDAY_LABELS[d]} accessibilityState={{ selected: on }}><Text style={[s.chipText, on && s.chipTextOn]}>{WEEKDAY_LABELS[d][0]}</Text></Pressable> })}</View>
      <View style={s.line}>
        <TextInput style={[s.input, s.time]} value={m.start} onChangeText={start => patch(m.id, { start })} placeholder="10:00" placeholderTextColor={color.muted} accessibilityLabel="Starts" maxLength={5} />
        <Text style={s.to}>to</Text>
        <TextInput style={[s.input, s.time]} value={m.end} onChangeText={end => patch(m.id, { end })} placeholder="11:15" placeholderTextColor={color.muted} accessibilityLabel="Ends" maxLength={5} />
        <TextInput style={[s.input, s.grow]} value={m.location ?? ""} onChangeText={location => patch(m.id, { location: location || undefined })} placeholder="Room" placeholderTextColor={color.muted} accessibilityLabel="Room" />
      </View>
    </View>)}
    <View style={s.line}><Pressable onPress={() => add("class")} style={s.add} accessibilityRole="button"><Text style={s.addText}>+ Class time</Text></Pressable><Pressable onPress={() => add("office")} style={s.add} accessibilityRole="button"><Text style={s.addText}>+ Office hours</Text></Pressable></View>
  </View>
}

const s = StyleSheet.create({
  wrap: { gap: 6 }, label: { color: color.muted, fontSize: 11 }, row: { gap: 6, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: p.line }, line: { flexDirection: "row", alignItems: "center", gap: 5 }, grow: { flex: 1 },
  chip: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, justifyContent: "center", backgroundColor: p.raised }, day: { width: 34, minHeight: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: p.raised },
  chipOn: { backgroundColor: p.selected, borderWidth: 1, borderColor: p.selectedBorder }, chipText: { color: p.muted, fontSize: 12 }, chipTextOn: { color: p.accent },
  input: { minHeight: 34, borderRadius: 12, borderWidth: 1, borderColor: p.line, backgroundColor: p.ground, color: p.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13 }, time: { width: 64, textAlign: "center" }, to: { color: p.muted, fontSize: 12 },
  trash: { width: 32, height: 32, alignItems: "center", justifyContent: "center" }, add: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: p.raised }, addText: { color: p.accent, fontSize: 12, fontWeight: "600" },
})
