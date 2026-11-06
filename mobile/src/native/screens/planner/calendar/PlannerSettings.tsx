import { shape } from "../../../../shape.ts"
import { useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { plannerColor as c } from "../../../planner-theme.ts"
import { Icon } from "../../../ui.tsx"
import type { CalendarPrefs } from "./prefs.ts"
import { moveSection, type Section, type WorkspacePrefs } from "./workspace-prefs.ts"
const LABEL: Record<Section, string> = { agenda: "Agenda", log: "Daily log", notes: "Notes" }
type Anchor = { top: number; right: number }

/** Small settings popover attached to the calendar's options button. */
export function PlannerSettings({ onClose, prefs, onChange, calendar, onCalendar, anchor }: {
  onClose: () => void; prefs: WorkspacePrefs; onChange: (p: Partial<WorkspacePrefs>) => void
  calendar: CalendarPrefs; onCalendar: (p: Partial<CalendarPrefs>) => void; anchor?: Anchor
}) {
  const [tab, setTab] = useState<"sections" | "display">("sections")
  const { width, height } = useWindowDimensions()
  const inset = useSafeAreaInsets()
  const popupWidth = Math.min(280, width - inset.left - inset.right - 24)
  const top = Math.max(inset.top + 8, Math.min(anchor?.top ?? inset.top + 124, height - inset.bottom - 160))
  const right = Math.max(inset.right + 12, Math.min(anchor?.right ?? inset.right + 12, width - popupWidth - inset.left - 12))
  const maxHeight = Math.max(80, Math.min(420, height - inset.bottom - top - 12))
  return <Modal transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close planner settings" />
      <View style={[styles.sheet, { top, right, width: popupWidth, maxHeight }]} accessibilityViewIsModal>
        <View style={styles.head}><Icon name="options-outline" size={16} tint={c.muted} /><Text style={styles.title}>Planner settings</Text><Pressable style={styles.button} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={18} tint={c.text2} /></Pressable></View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["sections", "display"] as const).map(value => <Pressable key={value} style={[styles.tab, tab === value && styles.tabOn]} onPress={() => setTab(value)} accessibilityRole="tab" accessibilityLabel={value === "sections" ? "Sections" : "Display"} accessibilityState={{ selected: tab === value }}><Text style={[styles.tabText, tab === value && styles.activeText]}>{value === "sections" ? "Sections" : "Display"}</Text></Pressable>)}
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {tab === "sections" ? <>
            <Text style={styles.hint}>Below the calendar</Text>
            {prefs.order.map((s, i) => <View key={s} style={styles.row}>
              <Check label={LABEL[s]} value={!prefs.hidden.includes(s)} onPress={() => onChange({ hidden: prefs.hidden.includes(s) ? prefs.hidden.filter(v => v !== s) : [...prefs.hidden, s] })} />
              {([-1, 1] as const).map(dir => <Pressable key={dir} disabled={dir === -1 ? i === 0 : i === prefs.order.length - 1} style={[styles.button, (dir === -1 ? i === 0 : i === prefs.order.length - 1) && styles.disabled]} onPress={() => onChange({ order: moveSection(prefs.order, s, dir) })} accessibilityRole="button" accessibilityLabel={`Move ${LABEL[s]} ${dir === -1 ? "up" : "down"}`}><Icon size={15} name={dir === -1 ? "chevron-up" : "chevron-down"} tint={c.text2} /></Pressable>)}
            </View>)}
          </> : <>
            <Text style={styles.hint}>Agenda</Text>
            <Check label="Times" value={prefs.showTimes} onPress={() => onChange({ showTimes: !prefs.showTimes })} />
            <Check label="Course labels" value={prefs.showCourses} onPress={() => onChange({ showCourses: !prefs.showCourses })} />
            <Check label="Completed tasks" value={prefs.showCompleted} onPress={() => onChange({ showCompleted: !prefs.showCompleted })} />
            <Text style={styles.hint}>Calendar</Text>
            <Check label="Week starts Monday" value={calendar.weekStartsOn === 1} onPress={() => onCalendar({ weekStartsOn: calendar.weekStartsOn === 1 ? 0 : 1 })} />
            <Check label="24-hour clock" value={calendar.timeFormat === "24h"} onPress={() => onCalendar({ timeFormat: calendar.timeFormat === "24h" ? "12h" : "24h" })} />
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>
}
function Check({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return <Pressable style={styles.check} onPress={onPress} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }}>
    <Icon name={value ? "checkbox" : "square-outline"} size={17} tint={value ? c.accent : c.muted} /><Text style={styles.label}>{label}</Text>
  </Pressable>
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.16)" },
  sheet: { position: "absolute", backgroundColor: c.panel, borderRadius: shape.menu, borderWidth: 1, borderColor: c.border, overflow: "hidden", elevation: 14, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  head: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 36, paddingLeft: 11, paddingRight: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  title: { flex: 1, color: c.text, fontSize: 13, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 4, padding: 6, paddingBottom: 0 }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 28, borderRadius: 14 }, tabOn: { backgroundColor: c.selected }, tabText: { color: c.muted, fontSize: 11, fontWeight: "600" }, activeText: { color: c.accent },
  body: { paddingHorizontal: 11, paddingTop: 5, paddingBottom: 9, gap: 1 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 32 }, check: { flexDirection: "row", alignItems: "center", minHeight: 32, gap: 8, flexGrow: 1, flexShrink: 1 },
  label: { color: c.text2, fontSize: 12, flexShrink: 1 }, button: { width: 28, height: 28, justifyContent: "center", alignItems: "center", borderRadius: 14 }, disabled: { opacity: 0.25 },
  hint: { color: c.muted, fontSize: 10, marginTop: 5, marginBottom: 2 },
})

