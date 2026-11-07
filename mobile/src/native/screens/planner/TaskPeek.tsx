import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { Icon } from "../../ui.tsx"
import { selectedItem } from "../../selected-item.ts"
import { PropChip } from "../../kit/PropChip.tsx"
import type { ChipKind } from "../../kit/tokens.ts"

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
  type Fact = { key: string; kind: ChipKind; label: string; value: string }
  const facts = ([
    course ? { key: "course", kind: "course", label: "Course", value: course } : undefined,
    task.scheduledDate ? { key: "planned", kind: "date", label: "Planned", value: `${task.scheduledDate}${task.scheduledTime ? ` · ${task.scheduledTime}` : ""}` } : undefined,
    task.due ? { key: "due", kind: "date", label: "Due", value: `${task.due}${task.time ? ` · ${task.time}` : ""}` } : undefined,
    counts.notes ? { key: "notes", kind: "neutral", label: counts.notes === 1 ? "Note" : "Notes", value: String(counts.notes) } : undefined,
    counts.tasks ? { key: "tasks", kind: "neutral", label: "Related", value: String(counts.tasks) } : undefined,
    counts.reflections ? { key: "refl", kind: "neutral", label: counts.reflections === 1 ? "Reflection" : "Reflections", value: String(counts.reflections) } : undefined,
    task.links?.length ? { key: "docs", kind: "neutral", label: task.links.length === 1 ? "Document" : "Documents", value: String(task.links.length) } : undefined,
    task.reflection ? { key: "saved", kind: "status", label: "Reflection", value: "Saved" } : undefined,
  ] as (Fact | undefined)[]).filter((fact): fact is Fact => !!fact)
  return <View style={selectedItem.preview} accessibilityLabel={`Preview ${task.title}`}>
    {task.details?.trim() ? <Text style={s.description} numberOfLines={2} ellipsizeMode="tail">{previewText(task.details)}</Text> : null}
    {facts.length ? <View style={s.facts}>{facts.map(fact => <PropChip key={fact.key} kind={fact.kind} label={fact.label} value={fact.value} />)}</View> : null}
    {!task.details?.trim() && !facts.length ? <Text style={s.muted}>No additional details yet.</Text> : null}
    <Pressable onPress={onOpen} style={s.open} accessibilityRole="button" accessibilityLabel={`Open ${task.title}`}><Icon name="open-outline" size={12} tint="#fff" /><Text style={s.openText}>Open</Text></Pressable>
  </View>
}

const s = StyleSheet.create({
  description: { color: c.text2, fontSize: 12, lineHeight: 17 }, muted: { color: c.muted, fontSize: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  open: { alignSelf: "flex-start", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 15, backgroundColor: c.action, borderWidth: 1, borderColor: c.selectedBorder }, openText: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
})
