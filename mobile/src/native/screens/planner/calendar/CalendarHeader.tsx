import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../../theme.ts"
import { Chip, Icon } from "../../../ui.tsx"
import type { CalendarView } from "./grid.ts"
import type { CalendarPrefs } from "./prefs.ts"

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

/**
 * Title, Today, previous / next, the Day / Week / Month switch, and a small "Display" row for the
 * two per-phone choices (week start, 12 / 24-hour clock).
 */
export function CalendarHeader({ title, view, prefs, onView, onStep, onToday, onPrefs }: {
  title: string
  view: CalendarView
  prefs: CalendarPrefs
  onView: (view: CalendarView) => void
  onStep: (direction: 1 | -1) => void
  onToday: () => void
  onPrefs: (change: Partial<CalendarPrefs>) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <Pressable onPress={onToday} style={styles.today} accessibilityRole="button" accessibilityLabel="Go to today">
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
        <Round icon="chevron-back" label={`Previous ${view}`} onPress={() => onStep(-1)} />
        <Round icon="chevron-forward" label={`Next ${view}`} onPress={() => onStep(1)} />
      </View>
      <View style={styles.top}>
        <View style={styles.views}>
          {VIEWS.map((v) => (
            <Chip key={v.key} label={v.label} active={view === v.key} onPress={() => onView(v.key)} />
          ))}
        </View>
        <Pressable onPress={() => setOpen(!open)} style={[styles.round, open && styles.roundOn]} accessibilityRole="button" accessibilityLabel="Calendar display options" accessibilityState={{ expanded: open }}>
          <Icon name="options-outline" tint={open ? color.text : color.text2} />
        </Pressable>
      </View>
      {open ? (
        <View style={styles.options}>
          <Text style={styles.optionLabel}>Week starts</Text>
          <View style={styles.chips}>
            <Chip label="Sunday" active={prefs.weekStartsOn === 0} onPress={() => onPrefs({ weekStartsOn: 0 })} />
            <Chip label="Monday" active={prefs.weekStartsOn === 1} onPress={() => onPrefs({ weekStartsOn: 1 })} />
          </View>
          <Text style={styles.optionLabel}>Clock</Text>
          <View style={styles.chips}>
            <Chip label="12-hour" active={prefs.timeFormat === "12h"} onPress={() => onPrefs({ timeFormat: "12h" })} />
            <Chip label="24-hour" active={prefs.timeFormat === "24h"} onPress={() => onPrefs({ timeFormat: "24h" })} />
          </View>
          <Text style={styles.hint}>Saved on this phone only.</Text>
        </View>
      ) : null}
    </View>
  )
}

function Round({ icon, label, onPress }: { icon: "chevron-back" | "chevron-forward"; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.round} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} tint={color.text2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: color.text, fontSize: 17, fontWeight: "700" },
  today: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.border },
  todayText: { color: color.text, fontSize: 13, fontWeight: "700" },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.edge },
  roundOn: { backgroundColor: color.selected, borderColor: color.border },
  chips: { flexDirection: "row", gap: 8 },
  views: { flexDirection: "row", gap: 8, flex: 1 },
  options: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: color.well, borderWidth: 1, borderColor: color.edge },
  optionLabel: { color: color.faint, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { color: color.muted, fontSize: 12 },
})
