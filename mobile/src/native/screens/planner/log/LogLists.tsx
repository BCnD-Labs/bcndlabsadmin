import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { color } from "../../../../theme.ts"
import { Icon, tone } from "../../../ui.tsx"
import { WorkspaceSection } from "../../../WorkspacePage.tsx"
import { selectedItem } from "../../../selected-item.ts"
import { TaskPeek } from "../TaskPeek.tsx"
import { completedOn, dueOn } from "./log-rules.ts"

/** A row previews in place; Open in that preview reaches the task editor. */
export function LogLists({ data, day, onEditTask }: { data: Collections; day: string; onEditTask: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const tasks = data.tasks
  const done = completedOn(tasks, day)
  const due = dueOn(tasks, day)
  const line = (task: Collections["tasks"][number], group: string, icon: "checkmark-circle" | "checkmark-circle-outline" | "ellipse-outline", tint: string) => {
    const key = `${day}/${group}/${task.id}`
    const expanded = selected === key
    return <TaskLine key={key} task={task} course={data.courses.find(c => c.id === task.courseId)?.title} icon={icon} tint={tint} expanded={expanded} onSelect={() => setSelected(current => current === key ? null : key)} onOpen={() => onEditTask(task.id)} />
  }
  return (
    <>
      {done.length ? (
        <WorkspaceSection title="Completed this day" icon="checkmark-circle-outline" tint={tone.green} count={String(done.length)} collapsible flush>
          {done.map(t => line(t, "done", "checkmark-circle", tone.green))}
        </WorkspaceSection>
      ) : null}
      {due.length ? (
        <WorkspaceSection title="Due this day" icon="flag-outline" tint={tone.amber} count={String(due.length)} collapsible flush>
          {due.map(t => line(t, "due", t.done ? "checkmark-circle-outline" : "ellipse-outline", t.done ? color.faint : tone.amber))}
        </WorkspaceSection>
      ) : null}
    </>
  )
}

function TaskLine({ task, course, icon, tint, expanded, onSelect, onOpen }: { task: Collections["tasks"][number]; course?: string; icon: "checkmark-circle" | "checkmark-circle-outline" | "ellipse-outline"; tint: string; expanded: boolean; onSelect: () => void; onOpen: () => void }) {
  return (
    <View style={[selectedItem.item, expanded && selectedItem.itemOn]}><Pressable onPress={onSelect} style={({ pressed }) => [styles.line, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`Preview ${task.title}${task.done ? ", done" : ""}`}>
      <Icon name={icon} size={20} tint={tint} />
      <View style={styles.flex}>
        <Text style={[styles.title, task.done && styles.done]} numberOfLines={2}>
          {task.title}
        </Text>
      </View>
    </Pressable>{expanded ? <TaskPeek task={task} course={course} onOpen={onOpen} /> : null}</View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 6, paddingHorizontal: 10 },
  pressed: { backgroundColor: color.raised },
  title: { color: color.text, fontSize: 14, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
})
