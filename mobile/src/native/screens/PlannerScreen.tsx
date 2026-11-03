import { useRef, useState } from "react"
import { Chip, ChipRow, SampleBadge, Screen } from "../ui.tsx"
import { SAMPLE_TASKS, SAMPLE_TODAY, type SampleTask } from "../sample.ts"
import { CalendarView } from "./planner/CalendarView.tsx"
import { TasksView } from "./planner/TasksView.tsx"

type Mode = "tasks" | "calendar"

const MODES: { key: Mode; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "calendar", label: "Calendar" },
]

/** Planner skeleton. Tasks live in local state only: nothing is saved or sent anywhere. */
export function PlannerScreen(_props: { onOpenSettings: () => void }) {
  const [mode, setMode] = useState<Mode>("tasks")
  const [tasks, setTasks] = useState<SampleTask[]>(SAMPLE_TASKS)
  const nextId = useRef(0)

  function toggle(id: string) {
    setTasks((all) => all.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function add(title: string) {
    nextId.current += 1
    const task: SampleTask = { id: `local-${nextId.current}`, title, done: false, starred: false, due: SAMPLE_TODAY }
    setTasks((all) => [...all, task])
  }

  return (
    <Screen title="Planner" right={<SampleBadge />}>
      <ChipRow>
        {MODES.map((m) => (
          <Chip key={m.key} label={m.label} active={mode === m.key} onPress={() => setMode(m.key)} />
        ))}
      </ChipRow>
      {mode === "tasks" ? <TasksView tasks={tasks} onToggle={toggle} onAdd={add} /> : <CalendarView tasks={tasks} onToggle={toggle} />}
    </Screen>
  )
}
