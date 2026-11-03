import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { toggleTask, type Collections } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Empty, Icon, ListRow, SectionLabel, tone } from "../../ui.tsx"
import { agendaFor, busyDays } from "./agenda.ts"
import { TaskCheck } from "./TaskCheck.tsx"
import { WEEKDAY_SHORT, addDays, dayOfMonth, formatDay, weekDays, weekRangeLabel } from "./dates.ts"

/**
 * One week of the real workspace's tasks, by schedule (see agenda.ts). Only tasks appear: the
 * workspace has no class timetable or events to show here, so none are invented.
 */
export function CalendarView({ data, today }: { data: Collections; today: string }) {
  const { mutate } = useWorkspace()
  const [selected, setSelected] = useState(today)
  const week = useMemo(() => weekDays(selected), [selected])
  const busy = useMemo(() => busyDays(data.tasks, week), [data.tasks, week])
  const agenda = useMemo(() => agendaFor(data.tasks, selected, data.courses), [data.tasks, data.courses, selected])

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
          const isToday = day === today
          const dot = busy.has(day)
          return (
            <Pressable
              key={day}
              onPress={() => setSelected(day)}
              style={[styles.day, isToday && !active && styles.today, active && styles.dayOn]}
              accessibilityRole="button"
              accessibilityLabel={`${formatDay(day)}${isToday ? ", today" : ""}${dot ? ", has tasks" : ""}`}
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
          <Empty>No tasks on this day.</Empty>
        ) : (
          agenda.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              subtitle={item.course}
              done={item.done}
              left={<Text style={styles.time}>{item.time ?? "Any time"}</Text>}
              right={<TaskCheck checked={item.done} onPress={() => void mutate(["tasks"], (d) => toggleTask(d, item.id))} label={`${item.done ? "Reopen" : "Complete"} ${item.title}`} />}
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
  time: { color: color.text2, fontSize: 12, fontWeight: "700", minWidth: 56 },
})
