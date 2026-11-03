import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../../theme.ts"
import { Empty, Icon, tone } from "../../../ui.tsx"
import { TaskCheck } from "../TaskCheck.tsx"
import { durationText, formatTime, longDay, type TimeFormat } from "./format.ts"
import type { AgendaItem } from "./schedule.ts"

/**
 * One day's tasks as a list (under the Month and Week grids). Tap a row to open the task, tap its
 * box to complete or reopen it. Empty days say so.
 */
export function DayAgenda({ day, items, meta, format, onEdit, onToggle }: {
  day: string
  items: AgendaItem[]
  meta: { logged: boolean; completed: number }
  format: TimeFormat
  onEdit: (id: string) => void
  onToggle: (id: string) => void
}) {
  const note = [meta.logged && "Daily log written", meta.completed > 0 && `${meta.completed} completed`].filter(Boolean).join(" · ")
  return (
    <View style={styles.card} accessibilityLabel={`Items on ${longDay(day)}`}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {longDay(day)}
        </Text>
        <Text style={styles.count}>{items.length ? `${items.length} ${items.length === 1 ? "item" : "items"}` : "Nothing scheduled"}</Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {items.length === 0 ? <Empty>Nothing is scheduled or due on this day.</Empty> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <TaskCheck checked={item.done} onPress={() => onToggle(item.id)} label={`${item.done ? "Reopen" : "Complete"} ${item.title}`} />
          <Pressable onPress={() => onEdit(item.id)} style={styles.body} accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`}>
            <Text style={[styles.rowTitle, item.done && styles.done]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.time ? `${formatTime(item.time, format)}${item.duration ? ` · ${durationText(item.duration)}` : ""}` : item.deadline ? "Due" : "All day"}
              {item.overdue ? <Text style={styles.overdue}>{" · Overdue"}</Text> : null}
              {item.course ? ` · ${item.course}` : ""}
            </Text>
          </Pressable>
          {item.deadline && !item.done ? <Icon name="flag-outline" size={16} tint={item.overdue ? tone.amber : color.muted} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, paddingHorizontal: 12, paddingVertical: 10 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: color.text, fontSize: 15, fontWeight: "700" },
  count: { color: color.muted, fontSize: 12 },
  note: { color: color.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, borderTopWidth: 1, borderTopColor: color.line, marginTop: 6, gap: 4 },
  body: { flex: 1, minHeight: 44, justifyContent: "center", gap: 2, paddingVertical: 6 },
  rowTitle: { color: color.text, fontSize: 15, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
  sub: { color: color.muted, fontSize: 12 },
  overdue: { color: tone.amber, fontWeight: "700" },
})
