import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { toggleTask } from "../../lib/shared.ts"
import { color } from "../../theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { Badge, Button, Card, Checkbox, Empty, Icon, ListRow, Screen, tone } from "../ui.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { formatDay } from "./planner/dates.ts"

/** A live overview of the shared workspace, with no fabricated activity or counters. */
export function HomeScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState<string>()
  const today = todayKey()
  const blocked = status === "conflict"
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const due = tasks.filter(t => !t.done && t.due && t.due <= today).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))
  const upcoming = tasks.filter(t => !t.done && t.courseId && (!t.due || t.due > today)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 5)
  const events = (data?.tasks ?? []).filter(t => t.kind === "event" && t.scheduledDate && t.scheduledDate >= today).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "")).slice(0, 4)
  const pinned = (data?.notes ?? []).filter(n => n.pinned).slice(0, 3)
  async function complete(id: string) {
    if (blocked) return setNotice("Resolve the sync conflict before editing.")
    if (!await mutate(["tasks"], d => toggleTask(d, id))) setNotice(message ?? "Could not save this task.")
  }
  const add = <Pressable onPress={() => data && !blocked ? setEditor({ mode: "create" }) : setNotice(blocked ? "Resolve the sync conflict before editing." : "Load your workspace first.")} accessibilityRole="button" accessibilityLabel="Add task" style={styles.add}><Icon name="add" tint={color.text} /></Pressable>
  return <Screen title="Home" subtitle={data ? formatDay(today) : undefined} right={add} onRefresh={() => void refresh()} refreshing={refreshing}>
    {!data ? <Card title={status === "signed-out" ? "Sign in to use Blackwall" : "Loading your workspace"}><Text style={styles.meta}>{status === "signed-out" ? "Your records will appear here after sign-in." : message ?? "Pull down to try again."}</Text>{status === "signed-out" ? <Button label="Sign in" onPress={onOpenSettings} /> : null}</Card> : null}
    {notice || (data && status !== "ok" && message) ? <Text style={styles.meta}>{notice ?? message}</Text> : null}
    {data ? <>
      <Card title="Today" right={<Badge label={`${due.length} open`} tint={due.length ? tone.amber : tone.green} />}>
        {due.length ? due.slice(0, 5).map(t => <ListRow key={t.id} title={t.title} subtitle={t.due && t.due < today ? `Overdue · ${formatDay(t.due)}` : "Due today"} left={<Checkbox checked={t.done} onPress={() => void complete(t.id)} label={`Complete ${t.title}`} />} onPress={() => setEditor({ mode: "edit", id: t.id })} />) : <Empty>Nothing due today.</Empty>}
      </Card>
      <Card title="Learning next">
        {upcoming.length ? upcoming.map(t => <ListRow key={t.id} title={t.title} subtitle={[data.courses.find(c => c.id === t.courseId)?.title, t.due ? formatDay(t.due) : ""].filter(Boolean).join(" · ")} left={<Checkbox checked={t.done} onPress={() => void complete(t.id)} label={`Complete ${t.title}`} />} onPress={() => setEditor({ mode: "edit", id: t.id })} />) : <Empty>No upcoming learning tasks.</Empty>}
      </Card>
      <Card title="Upcoming events">
        {events.length ? events.map(t => <ListRow key={t.id} title={t.title} subtitle={[t.scheduledDate ? formatDay(t.scheduledDate) : "", t.scheduledTime].filter(Boolean).join(" · ")} onPress={() => setEditor({ mode: "edit", id: t.id })} />) : <Empty>No upcoming events.</Empty>}
      </Card>
      {pinned.length ? <Card title="Pinned notes">{pinned.map(n => <Text key={n.id} style={styles.note} numberOfLines={3}>{n.text}</Text>)}</Card> : null}
      <Card title="Workspace"><View style={styles.counts}><Text style={styles.meta}>{`${tasks.filter(t => !t.done).length} open tasks`}</Text><Text style={styles.meta}>{`${data.courses.length} learning items`}</Text><Text style={styles.meta}>{`${data.projects.length} projects`}</Text></View></Card>
    </> : null}
    {data && editor ? <TaskSheet key={editor.mode === "edit" ? editor.id : "new"} editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
  </Screen>
}
const styles = StyleSheet.create({ add: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: color.panel }, meta: { color: color.muted, fontSize: 13, lineHeight: 19 }, note: { color: color.text2, fontSize: 14, paddingVertical: 7 }, counts: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } })
