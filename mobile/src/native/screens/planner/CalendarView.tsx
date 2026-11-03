import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Badge, Empty, Icon, ListRow, SectionLabel, tone } from "../../ui.tsx"
import { SAMPLE_EVENTS, SAMPLE_TODAY, type SampleTask } from "../../sample.ts"
import { TaskCheck } from "./TaskCheck.tsx"
import { WEEKDAY_SHORT, addDays, dayOfMonth, formatDay, weekDays, weekRangeLabel } from "./dates.ts"

const KIND_TONE = { class: tone.blue, task: tone.amber, event: tone.green } as const

type AgendaItem = {
  key: string
  kind: "class" | "task" | "event"
  title: string
  /** HH:MM; undefined for an undated time (shown as "Any time"). */
  time?: string
  /** HH:MM, events only. */
  end?: string
  /** Set for tasks, so the row can toggle them. */
  task?: SampleTask
}

function timeText(item: AgendaItem): string {
  if (!item.time) return "Any time"
  return item.end ? `${item.time}–${item.end}` : item.time
}

export function CalendarView({ tasks, onToggle }: { tasks: SampleTask[]; onToggle: (id: string) => void }) {
  const [selected, setSelected] = useState(SAMPLE_TODAY)
  const week = weekDays(selected)
  const hasItems = (day: string) => SAMPLE_EVENTS.some((e) => e.date === day) || tasks.some((t) => t.due === day)

  const agenda: AgendaItem[] = [
    ...SAMPLE_EVENTS.filter((e) => e.date === selected).map((e) => ({ key: e.id, kind: e.kind, title: e.title, time: e.start, end: e.end })),
    ...tasks
      .filter((t) => t.due === selected)
      .map((t) => ({ key: t.id, kind: "task" as const, title: t.title, time: t.time, task: t })),
  ].sort((a, b) => {
    const timeA = a.time ?? "99:99"
    const timeB = b.time ?? "99:99"
    return timeA < timeB ? -1 : timeA > timeB ? 1 : 0
  })

  return (
    <>
      <View style={styles.nav}>
        <Pressable onPress={() => setSelected(addDays(selected, -7))} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Previous week">
          <Icon name="chevron-back" tint={color.text2} />
        </Pressable>
        <Text style={styles.navLabel}>{weekRangeLabel(selected)}</Text>
        <Pressable onPress={() => setSelected(addDays(selected, 7))} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Next week">
          <Icon name="chevron-forward" tint={color.text2} />
        </Pressable>
      </View>

      <View style={styles.strip}>
        {week.map((day, i) => {
          const active = day === selected
          const isToday = day === SAMPLE_TODAY
          const dot = hasItems(day)
          return (
            <Pressable
              key={day}
              onPress={() => setSelected(day)}
              style={[styles.day, isToday && !active && styles.today, active && styles.dayOn]}
              accessibilityRole="button"
              accessibilityLabel={`${formatDay(day)}${isToday ? ", today" : ""}${dot ? ", has items" : ""}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dow, active && styles.onText]}>{WEEKDAY_SHORT[i]}</Text>
              <Text style={[styles.num, active && styles.onText]}>{dayOfMonth(day)}</Text>
              <View style={[styles.dot, { backgroundColor: dot ? (active ? "#fff" : tone.blue) : "transparent" }]} />
            </Pressable>
          )
        })}
      </View>

      <SectionLabel>{formatDay(selected)}</SectionLabel>
      <View style={styles.list}>
        {agenda.length === 0 ? (
          <Empty>Nothing scheduled for this day.</Empty>
        ) : (
          agenda.map((item) => (
            <ListRow
              key={item.key}
              title={item.title}
              done={!!item.task?.done}
              left={<Text style={styles.time}>{timeText(item)}</Text>}
              right={
                <View style={styles.side}>
                  {item.task ? <TaskCheck checked={item.task.done} onPress={() => onToggle(item.task?.id ?? item.key)} label={`${item.task.done ? "Reopen" : "Complete"} ${item.title}`} /> : null}
                  <Badge label={item.kind} tint={KIND_TONE[item.kind]} />
                </View>
              }
            />
          ))
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.edge },
  navLabel: { color: color.text, fontSize: 15, fontWeight: "700" },
  strip: { flexDirection: "row", gap: 4 },
  day: { flex: 1, minHeight: 60, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: color.panel, borderWidth: 1, borderColor: color.edge },
  today: { borderColor: tone.blue },
  dayOn: { backgroundColor: color.red, borderColor: color.red },
  dow: { color: color.muted, fontSize: 11, fontWeight: "600" },
  num: { color: color.text, fontSize: 16, fontWeight: "700" },
  onText: { color: "#fff" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  list: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, paddingHorizontal: 12 },
  time: { color: color.text2, fontSize: 12, fontWeight: "700", minWidth: 92 },
  side: { flexDirection: "row", alignItems: "center", gap: 2 },
})
