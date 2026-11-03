import { StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Badge, Icon, ProgressBar, tone } from "../../ui.tsx"
import { SAMPLE_COURSES, SAMPLE_TODAY, type SampleTask } from "../../sample.ts"
import { TaskCheck } from "./TaskCheck.tsx"
import { shortDay } from "./dates.ts"

/**
 * One task in the Planner list. It mirrors ListRow from ui.tsx, but ListRow takes a plain string
 * subtitle and this row needs the overdue due text in red, so it is written here.
 */
export function TaskRow({ task, onToggle }: { task: SampleTask; onToggle: () => void }) {
  const course = SAMPLE_COURSES.find((c) => c.id === task.courseId)
  const overdue = !task.done && !!task.due && task.due < SAMPLE_TODAY
  const dueText = task.due ? `${overdue ? "Overdue · " : ""}${shortDay(task.due)}` : "No date"
  const sub = [task.time, course?.code].filter(Boolean).join(" · ")
  const subtasks = task.subtasks

  return (
    <View style={styles.row}>
      <TaskCheck checked={task.done} onPress={onToggle} label={`${task.done ? "Reopen" : "Complete"} ${task.title}`} />
      <View style={styles.body}>
        <Text style={[styles.title, task.done && styles.done]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          <Text style={overdue ? styles.overdue : undefined}>{dueText}</Text>
          {sub ? ` · ${sub}` : ""}
        </Text>
        {subtasks ? (
          <View style={styles.subtasks} accessibilityLabel={`${subtasks.done} of ${subtasks.total} subtasks done`}>
            <Text style={styles.count}>{`${subtasks.done}/${subtasks.total}`}</Text>
            <View style={styles.bar}>
              <ProgressBar value={subtasks.total > 0 ? subtasks.done / subtasks.total : 0} />
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.side}>
        {course ? <Badge label={course.code} tint={course.color} /> : null}
        {task.starred ? (
          <View accessibilityLabel="Starred">
            <Icon name="star" size={16} tint={tone.amber} />
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line },
  body: { flex: 1, gap: 3 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
  sub: { color: color.muted, fontSize: 12 },
  overdue: { color: tone.red, fontWeight: "700" },
  subtasks: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  count: { color: color.muted, fontSize: 11, fontWeight: "700" },
  bar: { flex: 1 },
  side: { alignItems: "flex-end", gap: 6 },
})
