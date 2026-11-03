import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../../theme.ts"
import { tone } from "../../../ui.tsx"
import { dayNumber, longDay, weekdayHeaders } from "./format.ts"
import { sameMonth, type WeekStart } from "./grid.ts"
import { dayDots, type DayDot, type Task } from "./schedule.ts"

const DOT: Record<DayDot, string> = { done: tone.green, overdue: tone.amber, open: color.red }

/**
 * The month as a grid of whole weeks. Each day shows its number and up to three dots (open, overdue,
 * done) plus a count of the rest; tap a day to select it and read its agenda below. Today has a red
 * ring, the selected day a red fill, and the neighbouring months' days are faded.
 */
export function MonthGrid({ weeks, month, selected, today, byDay, weekStart, onSelect }: {
  weeks: string[][]
  month: string
  selected: string
  today: string
  byDay: Map<string, Task[]>
  weekStart: WeekStart
  onSelect: (day: string) => void
}) {
  return (
    <View style={styles.card} accessibilityRole="grid" accessibilityLabel="Month calendar">
      <View style={styles.row}>
        {weekdayHeaders(weekStart).map((h) => (
          <Text key={h} style={styles.head}>
            {h}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.row}>
          {week.map((day) => {
            const items = byDay.get(day) ?? []
            const { dots, more } = dayDots(items, today)
            const on = day === selected
            const isToday = day === today
            const outside = !sameMonth(day, month)
            return (
              <Pressable
                key={day}
                onPress={() => onSelect(day)}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={`${longDay(day)}${isToday ? ", today" : ""}${items.length ? `, ${items.length} ${items.length === 1 ? "item" : "items"}` : ""}`}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.num, isToday && !on && styles.numToday, on && styles.numOn]}>
                  <Text style={[styles.numText, outside && styles.outside, on && styles.numTextOn]}>{dayNumber(day)}</Text>
                </View>
                <View style={[styles.dots, outside && styles.outside]}>
                  {dots.map((kind, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: DOT[kind] }]} />
                  ))}
                  {more > 0 ? <Text style={styles.more}>+{more}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, padding: 6 },
  row: { flexDirection: "row" },
  head: { flex: 1, textAlign: "center", color: color.muted, fontSize: 12, fontWeight: "700", paddingVertical: 6 },
  cell: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
  num: { minWidth: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  numToday: { borderColor: color.red },
  numOn: { backgroundColor: color.red, borderColor: color.red },
  numText: { color: color.text, fontSize: 15, fontWeight: "600" },
  numTextOn: { fontWeight: "800" },
  outside: { opacity: 0.4 },
  dots: { flexDirection: "row", alignItems: "center", gap: 3, height: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  more: { color: color.muted, fontSize: 9, fontWeight: "700" },
})
