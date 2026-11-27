import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { FAB, FAB_EDGE } from "./layout.ts"
import { sidebarSections, SIDEBAR_WIDTH } from "./orientation.ts"
import type { ScreenKey } from "./destinations.ts"

const SECTIONS = sidebarSections()

/** Landscape navigation: the bottom bar's job as a left sidebar. Every screen is one tap away; quick add floats at its foot. */
export function SideNav({ current, onSelect }: { current: ScreenKey; onSelect: (key: ScreenKey) => void }) {
  return <View style={s.side} accessibilityRole="tablist">
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
      {SECTIONS.map(({ group, items }) => <View key={group}>
        {group ? <Text style={s.group} accessibilityRole="header">{group}</Text> : null}
        {items.map((d) => {
          const active = d.key === current
          return <Pressable key={d.key} onPress={() => onSelect(d.key)} accessibilityRole="tab" accessibilityLabel={d.label} accessibilityState={{ selected: active }}
            style={({ pressed }) => [s.row, active && s.rowOn, pressed && s.pressed]}>
            <Icon name={active ? d.activeIcon : d.icon} size={17} tint={active ? c.accent : c.text2} />
            <Text style={[s.label, active && s.labelOn]} numberOfLines={1}>{d.label}</Text>
          </Pressable>
        })}
      </View>)}
    </ScrollView>
  </View>
}

const s = StyleSheet.create({
  side: { width: SIDEBAR_WIDTH, backgroundColor: c.panel, borderRightWidth: 1, borderRightColor: c.line },
  // The quick-add button sits over the bottom of the sidebar, so the list ends above it.
  list: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: FAB + FAB_EDGE * 2 + 4 },
  group: { color: c.muted, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 3 },
  row: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: "transparent" },
  rowOn: { backgroundColor: c.selected, borderColor: c.selectedBorder }, pressed: { backgroundColor: c.raised },
  label: { flexShrink: 1, color: c.text2, fontSize: 12.5 }, labelOn: { color: c.accent, fontWeight: "600" },
})
