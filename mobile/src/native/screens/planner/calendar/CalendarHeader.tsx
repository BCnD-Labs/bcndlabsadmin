import { useRef, type ComponentRef } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import { kit } from "../../../kit/tokens.ts"
import type { CalendarView } from "./grid.ts"
const VIEWS = [{ key: "month", label: "Month" }, { key: "week", label: "7-day" }, { key: "day", label: "Day" }] as const
export function CalendarHeader({ title, view, onView, onStep, onToday, onSettings, compact = false }: {
  compact?: boolean; title: string; view: CalendarView; onView: (v: CalendarView) => void; onStep: (d: -1 | 1) => void; onToday: () => void; onSettings: (anchor?: { top: number; right: number }) => void
}) {
  const button = useRef<ComponentRef<typeof View>>(null)
  const { width } = useWindowDimensions()
  return <View style={styles.wrap}>
    <View style={styles.row}>
      <Pressable style={styles.icon} onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel={`Previous ${view === "week" ? "seven days" : view}`}><Icon name="chevron-back" tint={c.text2} /></Pressable>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <Pressable style={styles.icon} onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`Next ${view === "week" ? "seven days" : view}`}><Icon name="chevron-forward" tint={c.text2} /></Pressable>
      <Pressable style={styles.today} onPress={onToday} accessibilityRole="button"><Text style={styles.todayText}>Today</Text></Pressable>
    </View>
    {!compact ? <View style={styles.row}>
      <View style={styles.track} accessibilityRole="tablist">{VIEWS.map(v => <Pressable key={v.key} style={[styles.tab, v.key === view && styles.on]} onPress={() => onView(v.key)} accessibilityRole="tab" accessibilityLabel={v.label} accessibilityState={{ selected: v.key === view }}><Text style={[styles.label, v.key === view && { color: c.text }]}>{v.label}</Text></Pressable>)}</View>
      <Pressable ref={button} style={styles.icon} onPress={() => button.current ? button.current.measureInWindow((x, y, w, h) => onSettings({ top: y + h + 6, right: Math.max(12, width - x - w) })) : onSettings()} accessibilityRole="button" accessibilityLabel="Planner settings"><Icon name="options-outline" tint={c.text2} /></Pressable>
    </View> : null}
  </View>
}
const styles = StyleSheet.create({
  wrap: { padding: 6, gap: 2, backgroundColor: kit.titlebar }, row: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { flex: 1, color: c.text, fontSize: 14, fontWeight: "600", textAlign: "center" }, icon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  today: { paddingHorizontal: 10, minHeight: 32, justifyContent: "center", borderRadius: 6, backgroundColor: c.selected }, todayText: { color: c.accent, fontSize: 12, fontWeight: "700" },
  track: { flex: 1, flexDirection: "row", borderRadius: 6, padding: 2, backgroundColor: c.ground }, tab: { flex: 1, minHeight: 30, alignItems: "center", justifyContent: "center", borderRadius: 5 },
  on: { backgroundColor: c.selected, borderBottomWidth: 2, borderBottomColor: c.accent }, label: { color: c.muted, fontSize: 12, fontWeight: "500" },
})
