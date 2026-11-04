import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { plannerColor as color } from "../../../planner-theme.ts"
import { tone } from "../../../ui.tsx"
import { dayNumber, longDay, weekdayHeaders } from "./format.ts"
import { sameMonth, type WeekStart } from "./grid.ts"
import { CARD_PAD, WEEKDAY_ROW, monthChips } from "./month-density.ts"
import { dayDots, type DayDot, type Task } from "./schedule.ts"

const DOT: Record<DayDot, string> = { done: tone.green, overdue: tone.amber, open: color.accent }

/**
 * The month as a grid of whole weeks. Each day shows its number and up to three dots (open, overdue,
 * done) plus a count of the rest; tap a day to select it and read its agenda below. Today has a ring,
 * the selected day a fill, and the neighbouring months' days are faded. The weeks share the height the
 * calendar is given, so dragging the calendar taller gives each day room for event titles instead of dots.
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
  const [height, setHeight] = useState(0)
  const chips = monthChips(weeks.length ? (height - WEEKDAY_ROW - CARD_PAD) / weeks.length : 0)
  return (
    <View style={styles.card} onLayout={(e) => setHeight(e.nativeEvent.layout.height)} accessibilityRole="grid" accessibilityLabel="Month calendar">
      <View style={styles.row}>
        {weekdayHeaders(weekStart).map((h) => (
          <Text key={h} style={styles.head}>
            {h}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={[styles.row, styles.week]}>
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
                style={[styles.cell, chips > 0 && styles.cellTall]}
                accessibilityRole="button"
                accessibilityLabel={`${longDay(day)}${isToday ? ", today" : ""}${items.length ? `, ${items.length} ${items.length === 1 ? "item" : "items"}` : ""}`}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.num, isToday && !on && styles.numToday, on && styles.numOn]}>
                  <Text style={[styles.numText, outside && styles.outside, on && styles.numTextOn]}>{dayNumber(day)}</Text>
                </View>
                {chips > 0 ? (
                  <View style={[styles.chipCol, outside && styles.outside]}>
                    {items.slice(0, chips).map((t) => (
                      <View key={t.id} style={[styles.chip, { borderLeftColor: DOT[t.done ? "done" : t.due && t.due < today ? "overdue" : "open"] }]}>
                        <Text style={[styles.chipText, t.done && styles.chipDone]} numberOfLines={1}>{t.title}</Text>
                      </View>
                    ))}
                    {items.length > chips ? <Text style={styles.more}>+{items.length - chips}</Text> : null}
                  </View>
                ) : (
                  <View style={[styles.dots, outside && styles.outside]}>
                    {dots.map((kind, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: DOT[kind] }]} />
                    ))}
                    {more > 0 ? <Text style={styles.more}>+{more}</Text> : null}
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: color.ground, padding: 4 },
  row: { flexDirection: "row" },
  week: { flex: 1 },
  head: { flex: 1, textAlign: "center", color: color.muted, fontSize: 12, fontWeight: "700", paddingVertical: 6 },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  cellTall: { justifyContent: "flex-start", paddingTop: 3, paddingHorizontal: 1 },
  chipCol: { alignSelf: "stretch", gap: 2, paddingHorizontal: 1 },
  chip: { minHeight: 16, justifyContent: "center", borderLeftWidth: 2, borderRadius: 3, backgroundColor: color.selected, paddingHorizontal: 3 },
  chipText: { color: color.text, fontSize: 9, fontWeight: "600" },
  chipDone: { color: color.muted, textDecorationLine: "line-through" },
  num: { minWidth: 26, height: 26, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  numToday: { borderColor: color.accent },
  numOn: { backgroundColor: color.accent, borderColor: color.accent },
  numText: { color: color.text, fontSize: 13, fontWeight: "600" },
  numTextOn: { fontWeight: "800", color: color.ground },
  outside: { opacity: 0.4 },
  dots: { flexDirection: "row", alignItems: "center", gap: 3, height: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  more: { color: color.muted, fontSize: 9, fontWeight: "700" },
})
