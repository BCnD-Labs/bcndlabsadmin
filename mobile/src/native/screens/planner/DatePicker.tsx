import { shape } from "../../../shape.ts"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Chip, Icon } from "../../ui.tsx"
import { WEEKDAY_SHORT } from "./dates.ts"
import { monthGrid, monthLabel, monthOf, quickDates, shiftMonth } from "./date-picker.ts"

/**
 * A date picker made of plain Pressables (no native date dialog, no extra package): quick chips
 * (Today, Tomorrow, Next week, No date) above a month grid. `value` is a due date key or "".
 */
export function DatePicker({ value, today, onChange }: { value: string; today: string; onChange: (key: string) => void }) {
  const [shown, setShown] = useState(() => monthOf(value) ?? monthOf(today) ?? { year: 2026, month: 1 })
  const weeks = monthGrid(shown)

  return (
    <View style={styles.box}>
      <View style={styles.quick}>
        {quickDates(today).map((q) => (
          <Chip
            key={q.label}
            label={q.label}
            active={(q.value ?? "") === value}
            onPress={() => {
              onChange(q.value ?? "")
              const m = q.value ? monthOf(q.value) : undefined
              if (m) setShown(m)
            }}
          />
        ))}
      </View>
      <View style={styles.head}>
        <Pressable onPress={() => setShown(shiftMonth(shown, -1))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Previous month">
          <Icon name="chevron-back" tint={color.text2} />
        </Pressable>
        <Text style={styles.month} accessibilityRole="header">
          {monthLabel(shown)}
        </Text>
        <Pressable onPress={() => setShown(shiftMonth(shown, 1))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Next month">
          <Icon name="chevron-forward" tint={color.text2} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAY_SHORT.map((d) => (
          <Text key={d} style={styles.dow}>
            {d.slice(0, 2)}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0].key} style={styles.week}>
          {w.map((c) => {
            const on = c.key === value
            return (
              <Pressable
                key={c.key}
                onPress={() => onChange(c.key)}
                style={[styles.cell, c.key === today && !on && styles.today, on && styles.on]}
                accessibilityRole="button"
                accessibilityLabel={c.key}
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.day, !c.inMonth && styles.out, on && styles.onText]}>{c.day}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 10, borderRadius: shape.card, backgroundColor: color.well, borderWidth: 1, borderColor: color.edge },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  month: { color: color.text, fontSize: 15, fontWeight: "700" },
  week: { flexDirection: "row" },
  dow: { flex: 1, textAlign: "center", color: color.muted, fontSize: 11, fontWeight: "600" },
  cell: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  today: { borderColor: color.border },
  on: { backgroundColor: color.red, borderColor: color.red },
  day: { color: color.text, fontSize: 14, fontWeight: "600" },
  out: { color: color.faint, fontWeight: "400" },
  onText: { color: "#fff" },
})

