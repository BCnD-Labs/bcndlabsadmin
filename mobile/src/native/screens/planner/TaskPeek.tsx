import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"
import { selectedItem } from "../../selected-item.ts"

type Task = Collections["tasks"][number]

/** Limits the *preview*, never the saved description. Text still ellipsizes by its available width. */
export function previewText(value: string | undefined, max = 120): string {
  const text = value?.trim().replace(/\s+/g, " ") ?? ""
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

export function TaskPeek({ task, course, onOpen }: { task: Task; course?: string; onOpen: () => void }) {
  const counts = { notes: 0, tasks: 0, reflections: 0 }
  for (const link of task.recordLinks ?? []) {
    if (link.kind === "note") counts.notes++
    if (link.kind === "task") counts.tasks++
    if (link.kind === "log") counts.reflections++
  }
  const facts = [
    course,
    task.scheduledDate ? `Planned ${task.scheduledDate}${task.scheduledTime ? ` · ${task.scheduledTime}` : ""}` : undefined,
    task.due ? `Due ${task.due}${task.time ? ` · ${task.time}` : ""}` : undefined,
    counts.notes ? `${counts.notes} linked ${counts.notes === 1 ? "note" : "notes"}` : undefined,
    counts.tasks ? `${counts.tasks} related ${counts.tasks === 1 ? "task" : "tasks"}` : undefined,
    counts.reflections ? `${counts.reflections} linked ${counts.reflections === 1 ? "reflection" : "reflections"}` : undefined,
    task.links?.length ? `${task.links.length} ${task.links.length === 1 ? "document" : "documents"}` : undefined,
    task.reflection ? "Reflection saved" : undefined,
  ].filter((fact): fact is string => !!fact)
  return <View style={selectedItem.preview} accessibilityLabel={`Preview ${task.title}`}>
    {task.details?.trim() ? <Text style={s.description} numberOfLines={2} ellipsizeMode="tail">{previewText(task.details)}</Text> : null}
    {facts.length ? <View style={s.facts}>{facts.map((fact, i) => <Text key={`${i}-${fact}`} style={s.fact} numberOfLines={1}>{fact}</Text>)}</View> : null}
    {!task.details?.trim() && !facts.length ? <Text style={s.muted}>No additional details yet.</Text> : null}
    <Pressable onPress={onOpen} style={selectedItem.action} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`}><Icon name="open-outline" size={14} tint={c.accent} /><Text style={selectedItem.actionText}>Open</Text></Pressable>
  </View>
}

const s = StyleSheet.create({
  description: { color: c.text2, fontSize: 12, lineHeight: 17 }, muted: { color: c.muted, fontSize: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, fact: { color: c.text2, backgroundColor: c.panel, fontSize: 11, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, maxWidth: "100%" },
})
