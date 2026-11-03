import { StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon, tone } from "../../ui.tsx"
import { TaskCheck } from "./TaskCheck.tsx"
import type { PlannerRow } from "./rows.ts"

/** One task in the Planner list: checkbox, title, then due text, time and course. */
export function TaskRow({ row, onToggle }: { row: PlannerRow; onToggle: () => void }) {
  const sub = [row.time, row.course].filter(Boolean).join(" · ")
  return (
    <View style={styles.row}>
      <TaskCheck checked={row.done} onPress={onToggle} label={`${row.done ? "Reopen" : "Complete"} ${row.title}`} />
      <View style={styles.body}>
        <Text style={[styles.title, row.done && styles.done]} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          <Text style={row.overdue ? styles.overdue : undefined}>{row.dueText}</Text>
          {sub ? ` · ${sub}` : ""}
        </Text>
      </View>
      {row.starred ? (
        <View accessibilityLabel="Starred">
          <Icon name="star" size={16} tint={tone.amber} />
        </View>
      ) : null}
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
})
