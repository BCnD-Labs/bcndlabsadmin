import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { reflectionLabel, type ReflectionKey } from "./planner/reflection.ts"

type Reflection = NonNullable<Collections["tasks"][number]["reflection"]>
type Review = { id: string; kind: "Task" | "Event" | "Log"; source: string; day: string; reflection: Reflection }

/** One read-only place to revisit the comments attached to actions and records. */
export function AttachedReflections({ data }: { data: Collections }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const tasks: Review[] = data.tasks.flatMap(task => task.reflection ? [{ id: `task/${task.id}`, kind: task.kind === "event" ? "Event" : "Task", source: task.title, day: (task.scheduledDate ?? task.due ?? task.reflection.updatedAt).slice(0, 10), reflection: task.reflection }] : [])
  // The optional log field is validated by the shared workspace rules when present.
  const logs: Review[] = data.journal.flatMap(day => (day.entries ?? []).flatMap(item => {
    const reflection = (item as typeof item & { reflection?: Reflection }).reflection
    return reflection && !item.id.startsWith("journal-") && !item.courseId && !item.taskId ? [{ id: `log/${day.id}/${item.id}`, kind: "Log" as const, source: item.text, day: day.id, reflection }] : []
  }))
  const reviews = [...tasks, ...logs].sort((a, b) => b.reflection.updatedAt.localeCompare(a.reflection.updatedAt))
  return <View style={s.list}>
    {reviews.map(review => <View key={review.id} style={s.item}>
      <Pressable onPress={() => setExpanded(id => id === review.id ? null : review.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded: expanded === review.id }} accessibilityLabel={`${review.kind} reflection for ${review.source}`}>
        <View style={s.main}><Text style={s.source} numberOfLines={1}>{review.source}</Text><Text style={s.meta}>{review.kind} · {review.day}</Text></View><Icon name={expanded === review.id ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
      </Pressable>
      {expanded === review.id ? <View style={s.body}>{review.reflection.text ? <Text style={s.text}>{review.reflection.text}</Text> : null}{Object.entries(review.reflection.items).map(([key, value]) => <Text key={key} style={s.detail}><Text style={s.detailLabel}>{reflectionLabel(key as ReflectionKey)}: </Text>{value}</Text>)}</View> : null}
    </View>)}
    {!reviews.length ? <Text style={s.empty}>Reflections you add to tasks, events and logs will gather here.</Text> : null}
  </View>
}

const s = StyleSheet.create({
  list: { gap: 2 }, item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6 }, main: { flex: 1, gap: 3 }, source: { color: c.text, fontSize: 13, fontWeight: "600" }, meta: { color: c.muted, fontSize: 11 }, body: { paddingHorizontal: 10, paddingBottom: 12, gap: 6 }, text: { color: c.text2, fontSize: 12, lineHeight: 18 }, detail: { color: c.text2, fontSize: 12, lineHeight: 18 }, detailLabel: { color: c.accent, fontWeight: "600" }, empty: { color: c.muted, fontSize: 12, padding: 10 },
})
