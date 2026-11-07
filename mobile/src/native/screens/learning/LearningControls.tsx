import { Pressable, StyleSheet, Text } from "react-native"
import { shape } from "../../../shape.ts"
import { plannerColor as c } from "../../planner-theme.ts"

/** A filter or switch chip: blocky, thin line, filled blue when selected. Matches the Tabs bar. */
export function Pill({ label, selected, onPress, tab = false }: { label: string; selected: boolean; onPress: () => void; tab?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.pill, tab && s.tab, selected && s.pillOn, pressed && s.pressed]} accessibilityRole={tab ? "tab" : "button"} accessibilityState={{ selected }}><Text style={[s.pillText, selected && s.pillTextOn]}>{label}</Text></Pressable>
}
export function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.smallButton, pressed && s.pressed]} accessibilityRole="button"><Text style={s.smallButtonText}>{label}</Text></Pressable>
}
const s = StyleSheet.create({
  pressed: { opacity: 0.72 }, tab: { flex: 1 }, pill: { minHeight: 32, paddingHorizontal: 10, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, justifyContent: "center", alignItems: "center" }, pillOn: { backgroundColor: c.selected, borderColor: c.selectedBorder }, pillText: { color: c.text2, fontSize: 12, fontWeight: "500" }, pillTextOn: { color: c.accent, fontWeight: "600" },
  smallButton: { minHeight: 32, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }, smallButtonText: { color: c.accent, fontSize: 12, fontWeight: "600" },
})
