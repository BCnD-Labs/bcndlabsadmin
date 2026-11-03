import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../../lib/shared.ts"
import { color } from "../../../../theme.ts"
import { Icon, SectionLabel, tone } from "../../../ui.tsx"
import { completedOn, dueOn } from "./log-rules.ts"

/** The tasks completed on the log's day (the web's "completed this day") and the tasks due that day. Tapping a task opens it. Each part hides when empty. */
export function LogLists({ tasks, day, onEditTask }: { tasks: Collections["tasks"]; day: string; onEditTask: (id: string) => void }) {
  const done = completedOn(tasks, day)
  const due = dueOn(tasks, day)
  return (
    <>
      {done.length ? (
        <>
          <SectionLabel>{`Completed this day · ${done.length}`}</SectionLabel>
          {done.map((t) => (
            <TaskLine key={t.id} title={t.title} icon="checkmark-circle" tint={tone.green} onPress={() => onEditTask(t.id)} />
          ))}
        </>
      ) : null}
      {due.length ? (
        <>
          <SectionLabel>{`Due this day · ${due.length}`}</SectionLabel>
          {due.map((t) => (
            <TaskLine key={t.id} title={t.title} done={t.done} icon={t.done ? "checkmark-circle-outline" : "ellipse-outline"} tint={t.done ? color.faint : tone.amber} onPress={() => onEditTask(t.id)} />
          ))}
        </>
      ) : null}
    </>
  )
}

function TaskLine({ title, icon, tint, done, onPress }: { title: string; icon: "checkmark-circle" | "checkmark-circle-outline" | "ellipse-outline"; tint: string; done?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.line, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${title}${done ? ", done" : ""}. Open task`}>
      <Icon name={icon} size={20} tint={tint} />
      <View style={styles.flex}>
        <Text style={[styles.title, done && styles.done]} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line },
  pressed: { backgroundColor: color.raised },
  title: { color: color.text, fontSize: 14, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
})
