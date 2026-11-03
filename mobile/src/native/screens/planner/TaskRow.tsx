import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon, tone } from "../../ui.tsx"
import { TaskCheck } from "./TaskCheck.tsx"
import type { PlannerRow } from "./rows.ts"

/**
 * One task in the Planner list: checkbox (completes), the title and details (opens the editor),
 * and a star (toggles it, as on the web row).
 */
export function TaskRow({ row, onToggle, onOpen, onStar }: { row: PlannerRow; onToggle: () => void; onOpen: () => void; onStar: () => void }) {
  const sub = [row.time, row.course].filter(Boolean).join(" · ")
  return (
    <View style={styles.row}>
      <TaskCheck checked={row.done} onPress={onToggle} label={`${row.done ? "Reopen" : "Complete"} ${row.title}`} />
      <Pressable onPress={onOpen} style={styles.body} accessibilityRole="button" accessibilityLabel={`Edit ${row.title}`}>
        <Text style={[styles.title, row.done && styles.done]} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          <Text style={row.overdue ? styles.overdue : undefined}>{row.dueText}</Text>
          {sub ? ` · ${sub}` : ""}
        </Text>
      </Pressable>
      <Pressable onPress={onStar} style={styles.star} accessibilityRole="button" accessibilityLabel={`${row.starred ? "Unstar" : "Star"} ${row.title}`} accessibilityState={{ selected: row.starred }}>
        <Icon name={row.starred ? "star" : "star-outline"} size={18} tint={row.starred ? tone.amber : color.faint} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48, borderBottomWidth: 1, borderBottomColor: color.line },
  body: { flex: 1, gap: 3, minHeight: 44, justifyContent: "center", paddingVertical: 6 },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
  sub: { color: color.muted, fontSize: 12 },
  overdue: { color: tone.red, fontWeight: "700" },
  star: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
})
