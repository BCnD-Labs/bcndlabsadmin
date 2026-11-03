import { useState } from "react"
import { StyleSheet, TextInput, View } from "react-native"
import { color } from "../../../theme.ts"
import { Chip, ChipRow, Empty } from "../../ui.tsx"
import { SAMPLE_TODAY, type SampleTask } from "../../sample.ts"
import { TaskRow } from "./TaskRow.tsx"

export type TaskFilter = "today" | "next" | "all" | "done" | "starred"

const FILTERS: { key: TaskFilter; label: string; empty: string }[] = [
  { key: "today", label: "Today", empty: "Nothing due today or overdue." },
  { key: "next", label: "Next", empty: "Nothing due after today." },
  { key: "all", label: "All", empty: "No open tasks." },
  { key: "done", label: "Done", empty: "Nothing finished yet." },
  { key: "starred", label: "Starred", empty: "No starred tasks." },
]

/** Which tasks a filter shows. Dates compare as YYYY-MM-DD strings. */
export function matchesFilter(task: SampleTask, filter: TaskFilter): boolean {
  switch (filter) {
    case "today":
      return !task.done && !!task.due && task.due <= SAMPLE_TODAY
    case "next":
      return !task.done && !!task.due && task.due > SAMPLE_TODAY
    case "all":
      return !task.done
    case "done":
      return task.done
    case "starred":
      return task.starred && !task.done
  }
}

/** Soonest due first, undated tasks last, then by time of day. */
function byDue(a: SampleTask, b: SampleTask): number {
  const dueA = a.due ?? "9999-99-99"
  const dueB = b.due ?? "9999-99-99"
  if (dueA !== dueB) return dueA < dueB ? -1 : 1
  const timeA = a.time ?? "99:99"
  const timeB = b.time ?? "99:99"
  return timeA < timeB ? -1 : timeA > timeB ? 1 : 0
}

export function TasksView({ tasks, onToggle, onAdd }: { tasks: SampleTask[]; onToggle: (id: string) => void; onAdd: (title: string) => void }) {
  const [filter, setFilter] = useState<TaskFilter>("today")
  const [draft, setDraft] = useState("")
  const shown = tasks.filter((t) => matchesFilter(t, filter)).sort(byDue)
  const emptyText = FILTERS.find((f) => f.key === filter)?.empty ?? ""

  function submit() {
    const title = draft.trim()
    if (!title) return
    onAdd(title)
    setDraft("")
  }

  return (
    <>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        placeholder="Add a task"
        placeholderTextColor={color.faint}
        accessibilityLabel="Add a task"
        returnKeyType="done"
        style={styles.input}
      />
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      <View style={styles.list}>
        {shown.length === 0 ? <Empty>{emptyText}</Empty> : shown.map((t) => <TaskRow key={t.id} task={t} onToggle={() => onToggle(t.id)} />)}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.panel,
    color: color.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  list: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, paddingHorizontal: 12 },
})
