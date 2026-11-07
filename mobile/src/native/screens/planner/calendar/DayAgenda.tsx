import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { plannerColor as color } from "../../../planner-theme.ts"
import { Empty, Icon, tone } from "../../../ui.tsx"
import { selectedItem } from "../../../selected-item.ts"
import { TaskCheck } from "../TaskCheck.tsx"
import { TaskPeek } from "../TaskPeek.tsx"
import { durationText, formatTime, longDay, type TimeFormat } from "./format.ts"
import type { AgendaItem } from "./schedule.ts"

/**
 * One day's tasks as a list (under the Month and Week grids). Tap a row to open the task, tap its
 * box to complete or reopen it. Empty days say so.
 */
export function DayAgenda({ day, items, tasks, meta, format, onEdit, onToggle, showTimes = true, showCourses = true }: {
  day: string
  items: AgendaItem[]
  tasks: Collections["tasks"]
  meta: { logged: boolean; completed: number }
  format: TimeFormat
  onEdit: (id: string) => void
  showTimes?: boolean
  showCourses?: boolean
  onToggle: (id: string) => void
}) {
  const [previewKey, setPreviewKey] = useState<string | null>(null)
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
        <View key={item.id} style={[selectedItem.item, previewKey === `${day}/${item.id}` && selectedItem.itemOn]}>
        <View style={styles.row}>
          {item.event ? <View style={{ width: 32, alignItems: "center" }}><Icon name="calendar-outline" size={16} tint={color.accent} /></View> : <TaskCheck compact checked={item.done} onPress={() => onToggle(item.id)} label={`${item.done ? "Reopen" : "Complete"} ${item.title}`} />}
          <Pressable onPress={() => setPreviewKey(value => value === `${day}/${item.id}` ? null : `${day}/${item.id}`)} style={styles.body} accessibilityRole="button" accessibilityLabel={`Preview ${item.title}`} accessibilityState={{ expanded: previewKey === `${day}/${item.id}` }}>
            <Text style={[styles.rowTitle, item.done && styles.done]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.event ? "Event · " : ""}{item.time ? (showTimes ? `${formatTime(item.time, format)}${item.duration ? ` · ${durationText(item.duration)}` : ""}` : "") : item.deadline ? "Due" : "All day"}
              {item.overdue ? <Text style={styles.overdue}>{" · Overdue"}</Text> : null}
              {showCourses && item.course ? ` · ${item.course}` : ""}
            </Text>
          </Pressable>
          {!item.event && item.deadline && !item.done ? <Icon name="flag-outline" size={16} tint={item.overdue ? tone.amber : color.muted} /> : null}
        </View>
        {previewKey === `${day}/${item.id}` && tasks.find(t => t.id === item.id) ? <TaskPeek task={tasks.find(t => t.id === item.id)!} course={item.course} onOpen={() => onEdit(item.id)} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 6 },
  title: { flex: 1, color: color.text, fontSize: 12, fontWeight: "600" },
  count: { color: color.muted, fontSize: 11 },
  note: { color: color.muted, fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 2 },
  body: { flex: 1, justifyContent: "center", gap: 1, paddingVertical: 0 },
  rowTitle: { color: color.text, fontSize: 14, lineHeight: 18, includeFontPadding: false, fontWeight: "500" },
  done: { color: color.muted, textDecorationLine: "line-through" },
  sub: { color: color.muted, fontSize: 11, lineHeight: 14, includeFontPadding: false },
  overdue: { color: tone.amber, fontWeight: "700" },
})
