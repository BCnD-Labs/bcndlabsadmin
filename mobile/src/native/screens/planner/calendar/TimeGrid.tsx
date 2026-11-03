import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { plannerColor as color } from "../../../planner-theme.ts"
import { Empty, tone } from "../../../ui.tsx"
import { dayNumber, formatTime, hourLabel, longDay, weekdayShort, type TimeFormat } from "./format.ts"
import { axisHeight, blockBox, hourRange, minuteToTime } from "./layout.ts"
import { allDayOn, chipOverflow, isDeadlineOn, timedLanes, type Lane, type Task } from "./schedule.ts"
import { isOverdue } from "../../../../lib/shared.ts"

const GUTTER = 40

/** Edge colour of an item: done green, overdue amber, otherwise the app red (the same meaning as the month dots). */
const edge = (task: Task, today: string) => (task.done ? tone.green : isOverdue(task, today) ? tone.amber : color.accent)

/**
 * The Day view (one column) and the Week view (seven): a day header, an all-day / due row, and a
 * time axis with timed tasks placed by start time and length. Overlapping tasks sit side by side.
 * Tap a header or an empty part of a column to pick that day; tap a task to open it.
 */
export function TimeGrid({ days, byDay, today, selected, format, compact, onSelectDay, onEdit }: {
  days: string[]
  byDay: Map<string, Task[]>
  today: string
  selected: string
  format: TimeFormat
  /** Week layout: narrow columns, smaller type, short chips. */
  compact: boolean
  onSelectDay: (day: string) => void
  onEdit: (id: string) => void
}) {
  const hourHeight = compact ? 44 : 56
  const lanes = days.map((d) => timedLanes(byDay.get(d) ?? [], d))
  const range = hourRange(lanes.flat())
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i)
  const allDay = days.map((d) => allDayOn(byDay.get(d) ?? [], d))
  const nothing = lanes.every((l) => l.length === 0) && allDay.every((a) => a.length === 0)
  const fontSize = compact ? 10 : 12

  return (
    <View style={styles.card} accessibilityLabel={days.length === 1 ? "Day calendar" : days.length === 3 ? "Three-day calendar" : "Week calendar"}>
      <View style={styles.row}>
        <View style={{ width: GUTTER }} />
        {days.map((d) => {
          const on = d === selected
          const isToday = d === today
          return (
            <Pressable key={d} onPress={() => onSelectDay(d)} style={styles.headCell} accessibilityRole="button" accessibilityLabel={`${longDay(d)}${isToday ? ", today" : ""}`} accessibilityState={{ selected: on }}>
              <Text style={styles.dow}>{weekdayShort(d)}</Text>
              <View style={[styles.num, isToday && !on && styles.numToday, on && styles.numOn]}>
                <Text style={[styles.numText, on && { color: color.ground }]}>{dayNumber(d)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <ScrollView nestedScrollEnabled style={{ maxHeight: 90, flexGrow: 0 }}><View style={[styles.row, styles.allDayRow]}>
        <Text style={[styles.gutterText, { width: GUTTER }]}>{"All-day / due"}</Text>
        {days.map((d, i) => {
          const { shown, more } = compact ? chipOverflow(allDay[i]) : { shown: allDay[i], more: 0 }
          return (
            <View key={d} style={[styles.allDayCell, d === selected && styles.selectedCol]}>
              {shown.map((t) => {
                const due = isDeadlineOn(t, d)
                return (
                  <Pressable key={t.id} onPress={() => onEdit(t.id)} style={[styles.chip, { borderLeftColor: edge(t, today) }]} accessibilityRole="button" accessibilityLabel={`${due ? "Due: " : ""}${t.title}`}>
                    <Text style={[styles.chipText, { fontSize }, t.done && styles.done]} numberOfLines={1}>
                      {due && !compact ? "Due: " : ""}
                      {t.title}
                    </Text>
                  </Pressable>
                )
              })}
              {more > 0 ? (
                <Pressable onPress={() => onSelectDay(d)} accessibilityRole="button" accessibilityLabel={`${more} more on ${longDay(d)}`}>
                  <Text style={styles.more}>+{more}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
      </View>

      </ScrollView>
      {nothing && !compact ? <Empty>Nothing is scheduled or due on this day.</Empty> : null}

      <ScrollView nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ minHeight: axisHeight(range, hourHeight) }}><View style={[styles.row, { height: axisHeight(range, hourHeight) }]}>
        <View style={{ width: GUTTER }}>
          {hours.map((h, i) => (
            <Text key={h} style={[styles.hour, { top: i * hourHeight + 2 }]}>
              {hourLabel(h, format)}
            </Text>
          ))}
        </View>
        {days.map((d, c) => (
          <View key={d} style={[styles.col, d === selected && styles.selectedCol]}>
            {hours.map((h, i) => (
              <View key={h} style={[styles.line, { top: i * hourHeight }]} />
            ))}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelectDay(d)} accessibilityRole="button" accessibilityLabel={`Pick ${longDay(d)}`} />
            {lanes[c].map((l) => (
              <Block key={l.task.id} lane={l} box={blockBox(l, range, hourHeight, compact ? 30 : 40)} today={today} format={format} compact={compact} onEdit={onEdit} />
            ))}
          </View>
        ))}
      </View></ScrollView>
    </View>
  )
}

function Block({ lane, box, today, format, compact, onEdit }: { lane: Lane; box: ReturnType<typeof blockBox>; today: string; format: TimeFormat; compact: boolean; onEdit: (id: string) => void }) {
  const t = lane.task
  const hue = t.done ? color.green : isOverdue(t, today) ? color.amber : [color.green, color.accent, color.blue, color.amber][[...(t.courseId ?? t.id)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4]
  const time = formatTime(minuteToTime(lane.start), format)
  return (
    <View style={[styles.blockWrap, { top: box.top, height: box.height, left: `${box.leftPct}%`, width: `${box.widthPct}%` }]}>
      <Pressable onPress={() => onEdit(t.id)} style={[styles.block, { borderColor: hue, borderLeftColor: hue, backgroundColor: `${hue}22` }]} accessibilityRole="button" accessibilityLabel={`${t.title}, ${time}${t.done ? ", done" : ""}`}>
        <Text style={[styles.blockTitle, compact && styles.small, t.done && styles.done]} numberOfLines={compact ? 3 : 2}>
          {t.title}
        </Text>
        {!compact || box.height >= 56 ? (
          <Text style={[styles.blockTime, compact && styles.small]} numberOfLines={1}>
            {time}{t.durationMinutes ? ` – ${formatTime(minuteToTime(lane.end), format)}` : ""}
          </Text>
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: color.ground, overflow: "hidden" },
  row: { flexDirection: "row" },
  headCell: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2 },
  dow: { color: color.muted, fontSize: 11, fontWeight: "700" },
  num: { minWidth: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  numToday: { borderColor: color.accent },
  numOn: { backgroundColor: color.accent, borderColor: color.accent },
  numText: { color: color.text, fontSize: 14, fontWeight: "700" },
  allDayRow: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.line, minHeight: 34 },
  gutterText: { color: color.muted, fontSize: 9, fontWeight: "700", textAlign: "center", paddingTop: 6 },
  allDayCell: { flex: 1, gap: 2, padding: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.line },
  selectedCol: { backgroundColor: `${color.accent}0a` },
  chip: { borderLeftWidth: 3, borderRadius: 4, backgroundColor: color.selected, paddingHorizontal: 3, paddingVertical: 3, minHeight: 24, justifyContent: "center" },
  chipText: { color: color.text, fontWeight: "600" },
  more: { color: color.muted, fontSize: 10, fontWeight: "700", textAlign: "center", paddingVertical: 2 },
  hour: { position: "absolute", left: 0, right: 4, textAlign: "right", color: color.muted, fontSize: 9 },
  col: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.line },
  line: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  blockWrap: { position: "absolute", padding: 1 },
  block: { flex: 1, borderWidth: 1, borderColor: color.border, borderLeftWidth: 3, borderRadius: 6, backgroundColor: color.selected, paddingHorizontal: 4, paddingVertical: 3, overflow: "hidden" },
  blockTitle: { color: color.text, fontSize: 13, fontWeight: "700" },
  blockTime: { color: color.text2, fontSize: 11, marginTop: 1 },
  small: { fontSize: 10 },
  done: { color: color.muted, textDecorationLine: "line-through" },
})
