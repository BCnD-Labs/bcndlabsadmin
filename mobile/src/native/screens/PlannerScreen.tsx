import { useCallback, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { SyncStatus } from "../data/SyncStatus.tsx"
import { todayKey } from "../data/sync-view.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { Button, Card, Chip, ChipRow, Screen } from "../ui.tsx"
import { CalendarView } from "./planner/CalendarView.tsx"
import { AddFab } from "./planner/AddFab.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { editAccess } from "./planner/task-form.ts"
import { TasksView } from "./planner/TasksView.tsx"

type Mode = "tasks" | "calendar"

const MODES: { key: Mode; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "calendar", label: "Calendar" },
]

/**
 * Planner on the real workspace. Tasks and the calendar read it; adding, editing, deleting and ticking
 * tasks save to the server (or queue on the phone). The "+" and the editor sheet live here, outside the scrolling page.
 */
export function PlannerScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const [mode, setMode] = useState<Mode>("tasks")
  const [editor, setEditor] = useState<Editor | null>(null)
  // The due date a task made with "+" starts with; the visible tab reports it.
  const [createDue, setCreateDue] = useState<string | undefined>()
  const edit = useCallback((id: string) => setEditor({ mode: "edit", id }), [])
  const today = todayKey()

  let body
  if (data) {
    body = mode === "tasks" ? <TasksView data={data} today={today} onEdit={edit} onCreateDue={setCreateDue} /> : <CalendarView data={data} today={today} onEdit={edit} onCreateDue={setCreateDue} />
  } else if (status === "loading") {
    body = (
      <View style={styles.loading} accessibilityLabel="Loading your tasks">
        <ActivityIndicator color={color.text2} />
        <Text style={styles.note}>Loading your tasks…</Text>
      </View>
    )
  } else if (status === "signed-out") {
    body = (
      <Card title="You're signed out">
        <Text style={styles.note}>Sign in under Account in Settings to see your tasks here.</Text>
        <Button label="Sign in" primary onPress={onOpenSettings} />
      </Card>
    )
  } else {
    body = (
      <Card title={status === "offline" ? "Can't reach the server" : "Couldn't load your tasks"}>
        <Text style={styles.note}>{status === "offline" ? "This phone has no saved copy of your workspace yet, so there is nothing to show offline." : (message ?? "Something went wrong.")}</Text>
        <Button label="Try again" primary onPress={() => void refresh()} />
      </Card>
    )
  }

  return (
    <View style={styles.fill}>
      <Screen title="Planner" right={<SyncStatus onOpenSettings={onOpenSettings} />} onRefresh={() => void refresh()} refreshing={refreshing}>
        {data ? (
          <ChipRow>
            {MODES.map((m) => (
              <Chip key={m.key} label={m.label} active={mode === m.key} onPress={() => setMode(m.key)} />
            ))}
          </ChipRow>
        ) : null}
        {data && status !== "ok" && status !== "loading" && message ? <Text style={styles.note}>{message}</Text> : null}
        {body}
      </Screen>
      {data ? <AddFab enabled={editAccess(status, true).ok} onPress={() => setEditor({ mode: "create", due: createDue })} /> : null}
      {data && editor ? <TaskSheet editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { alignItems: "center", gap: 8, paddingVertical: 32 },
  note: { color: color.text2, fontSize: 13, lineHeight: 19 },
})
