import { Pressable, StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Icon, tone } from "../../ui.tsx"
import { SwipeRow } from "./SwipeRow.tsx"
import { TaskCheck } from "./TaskCheck.tsx"
import { rowMetrics, type Density } from "./density.ts"
import type { PlannerRow } from "./rows.ts"

interface Props {
  row: PlannerRow
  density: Density
  /** Show a "Focus" tag on rows that are in today's focus (not needed inside the Focus group itself). */
  tagFocus?: boolean
  onToggle: () => void
  onOpen: () => void
  onStar: () => void
  onDelete: () => void
  onMenu: () => void
}

/**
 * One task in the Planner list: checkbox (completes), title and details (tap edits, long-press opens
 * quick actions), a star, and swipe shortcuts (SwipeRow). Compact packs one line of title; comfortable
 * wraps the title and shows the first line of the details. TalkBack gets the same actions as a menu.
 */
export function TaskRow({ row, density, tagFocus, onToggle, onOpen, onStar, onDelete, onMenu }: Props) {
  const m = rowMetrics(density)
  const sub = [row.time, row.course, tagFocus && row.focused && !row.done ? "Focus" : ""].filter(Boolean).join(" · ")
  const actions = [
    { name: "complete", label: row.done ? "Reopen" : "Complete" },
    { name: "star", label: row.starred ? "Remove star" : "Star" },
    { name: "delete", label: "Delete" },
    { name: "more", label: "More actions" },
  ]
  function onAction(name: string) {
    if (name === "complete") onToggle()
    else if (name === "star") onStar()
    else if (name === "delete") onDelete()
    else if (name === "more") onMenu()
  }
  return (
    <SwipeRow done={row.done} starred={row.starred} onComplete={onToggle} onStar={onStar} onDelete={onDelete}>
      <View style={[styles.row, { minHeight: m.minHeight }]}>
        <TaskCheck checked={row.done} onPress={onToggle} label={`${row.done ? "Reopen" : "Complete"} ${row.title}`} />
        <Pressable
          onPress={onOpen}
          onLongPress={onMenu}
          style={[styles.body, { paddingVertical: m.vertical }]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${row.title}`}
          accessibilityActions={actions}
          onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName)}
        >
          <Text style={[styles.title, row.done && styles.done]} numberOfLines={m.titleLines}>
            {row.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            <Text style={row.overdue ? styles.overdue : undefined}>{row.dueText}</Text>
            {sub ? ` · ${sub}` : ""}
          </Text>
          {m.showDetails && row.details ? (
            <Text style={styles.details} numberOfLines={1}>
              {row.details}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={onStar} style={styles.star} accessibilityRole="button" accessibilityLabel={`${row.starred ? "Unstar" : "Star"} ${row.title}`} accessibilityState={{ selected: row.starred }}>
          <Icon name={row.starred ? "star" : "star-outline"} size={18} tint={row.starred ? tone.amber : color.faint} />
        </Pressable>
      </View>
    </SwipeRow>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  body: { flex: 1, gap: 2, minHeight: 44, justifyContent: "center" },
  title: { color: color.text, fontSize: 15, fontWeight: "600" },
  done: { color: color.faint, textDecorationLine: "line-through" },
  sub: { color: color.muted, fontSize: 12 },
  details: { color: color.faint, fontSize: 12 },
  overdue: { color: tone.red, fontWeight: "700" },
  star: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
})
