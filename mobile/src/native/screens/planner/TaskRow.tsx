import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../lib/shared.ts"
import { plannerColor as color } from "../../planner-theme.ts"
import { Icon, tone } from "../../ui.tsx"
import { selectedItem } from "../../selected-item.ts"
import { PropChip } from "../../kit/PropChip.tsx"
import { SwipeRow } from "./SwipeRow.tsx"
import { TaskCheck } from "./TaskCheck.tsx"
import { TaskPeek } from "./TaskPeek.tsx"
import { rowMetrics, type Density } from "./density.ts"
import type { PlannerRow } from "./rows.ts"

interface Props {
  row: PlannerRow
  task: Collections["tasks"][number]
  expanded: boolean
  onSelect: () => void
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
export function TaskRow({ row, task, expanded, onSelect, density, tagFocus, onToggle, onOpen, onStar, onDelete, onMenu }: Props) {
  const m = rowMetrics(density)
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
      <View style={[selectedItem.item, expanded && selectedItem.itemOn]}>
      <View style={[styles.row, { minHeight: m.minHeight }]}>
        {!expanded && !row.done && (row.overdue || row.starred) ? <View style={[styles.priority, { backgroundColor: row.overdue ? tone.red : color.amber }]} /> : null}
        <TaskCheck checked={row.done} onPress={onToggle} label={`${row.done ? "Reopen" : "Complete"} ${row.title}`} />
        <Pressable
          onPress={onSelect}
          onLongPress={onMenu}
          style={[styles.body, { paddingVertical: Math.max(2, m.vertical - 3) }]}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Collapse preview for" : "Preview"} ${row.title}`}
          accessibilityActions={actions}
          onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName)}
        >
          <Text style={[styles.title, row.overdue && styles.overdue, row.starred && !row.done && styles.starredTitle, row.done && styles.done]} numberOfLines={m.titleLines}>
            {row.title}
          </Text>
          {row.dueText !== "No date" || row.time || row.course || (tagFocus && row.focused && !row.done) ? <View style={styles.meta}>
            {row.dueText !== "No date" ? <PropChip kind={row.overdue && !row.done ? "overdue" : "date"} label="Due" value={row.dueText} /> : null}
            {row.time ? <PropChip kind="date" label="Time" value={row.time} /> : null}
            {row.course ? <PropChip kind="course" label="Course" value={row.course} /> : null}
            {tagFocus && row.focused && !row.done ? <PropChip kind="neutral" label="Focus" value="On" /> : null}
          </View> : null}
          {m.showDetails && row.details ? (
            <Text style={styles.details} numberOfLines={1}>
              {row.details}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={row.starred ? onStar : onMenu} onLongPress={onMenu} style={styles.star} accessibilityRole="button" accessibilityLabel={`${row.starred ? "Unstar" : "More actions for"} ${row.title}`} accessibilityState={{ selected: row.starred }}>
          <Icon name={row.starred ? "star" : "ellipsis-horizontal"} size={17} tint={row.starred ? tone.amber : color.muted} />
        </Pressable>
      </View>
      {expanded ? <TaskPeek task={task} course={row.course} onOpen={onOpen} /> : null}
      </View>
    </SwipeRow>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 0 },
  priority: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3 },
  body: { flex: 1, minWidth: 0, gap: 4, minHeight: 44, justifyContent: "center" },
  title: { color: color.text, fontSize: 14, lineHeight: 19, fontWeight: "500" },
  starredTitle: { color: color.amber },
  done: { color: color.green, textDecorationLine: "line-through" },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%", minHeight: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { flexShrink: 1, fontSize: 10, lineHeight: 14 },
  dueBadge: { backgroundColor: color.dateFill },
  dueText: { color: color.dateText },
  courseBadge: { backgroundColor: color.tagFill },
  courseText: { color: color.tagText },
  focusBadge: { backgroundColor: color.selected },
  focusText: { color: color.accent },
  details: { color: color.muted, fontSize: 11, lineHeight: 16 },
  overdue: { color: tone.red },
  star: { width: 36, minHeight: 44, alignItems: "center", justifyContent: "center" },
})
