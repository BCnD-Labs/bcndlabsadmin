import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { shape } from "../../shape.ts"
import { mono } from "../../theme.ts"
import { plannerColor as c } from "../planner-theme.ts"

export interface TabItem<K extends string> { key: K; label: string; /** A small count after the label. */ count?: number }

/**
 * The one tab bar: equal blocky segments with a thin line, the selected one filled blue with an accent edge.
 * Used by the Planner, Learning and Journal so their tabs look the same.
 */
export function Tabs<K extends string>({ items, value, onChange, label, tint = c.accent, scrollable = false }: { items: readonly TabItem<K>[]; value: K | null; onChange: (key: K) => void; label?: string; tint?: string; scrollable?: boolean }) {
  const tabs = <View style={[s.row, scrollable && s.scrollRow]} accessibilityRole="tablist" accessibilityLabel={label}>
    {items.map(item => {
      const on = item.key === value
      return <Pressable key={item.key} onPress={() => onChange(item.key)} style={({ pressed }) => [s.tab, scrollable && s.scrollTab, on && s.on, on && { borderColor: tint }, pressed && !on && s.pressed]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.count != null ? `${item.label}, ${item.count}` : item.label}>
        <Text style={[s.text, on && s.textOn, on && { color: tint }]} numberOfLines={1}>{item.label}</Text>
        {item.count != null ? <Text style={[s.count, on && s.textOn, on && { color: tint }]}>{item.count}</Text> : null}
        {on ? <View style={[s.edge, { backgroundColor: tint }]} /> : null}
      </Pressable>
    })}
  </View>
  return scrollable ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{tabs}</ScrollView> : tabs
}

const s = StyleSheet.create({
  // Full width on purpose: inside a row parent the bar would shrink to nothing and leave unreadable slits.
  row: { flexDirection: "row", gap: 4, width: "100%" },
  scrollRow: { width: undefined },
  tab: { flex: 1, minWidth: 0, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 4, borderRadius: shape.card, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, overflow: "hidden" },
  scrollTab: { flex: 0, minWidth: 72, paddingHorizontal: 12 },
  on: { backgroundColor: c.selected, borderColor: c.selectedBorder }, pressed: { backgroundColor: c.raised },
  text: { flexShrink: 1, color: c.text2, fontSize: 12, fontWeight: "600" }, textOn: { color: c.accent },
  count: { color: c.muted, fontFamily: mono, fontSize: 10 },
  edge: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: c.accent },
})
