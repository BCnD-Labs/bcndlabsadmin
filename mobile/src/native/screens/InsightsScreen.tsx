import { StyleSheet, Text, View } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"

/** Local visual summaries are derived only from saved workspace records. */
export function InsightsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const today = todayKey()
  const monday = new Date(today + "T12:00:00")
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-")
  })
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const completed = week.map(day => tasks.filter(t => t.completedAt?.slice(0, 10) === day).length)
  const done = tasks.filter(t => t.done).length
  const open = tasks.length - done
  const overdue = tasks.filter(t => !t.done && t.due && t.due < today).length
  const total = Math.max(tasks.length, 1)
  return <WorkspacePage page="Insights" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? <>
      <Text style={s.meta}>Your workspace at a glance</Text>
      <View style={s.metrics}><Metric value={completed.reduce((n, x) => n + x, 0)} label="done this week" tint={c.green} /><Metric value={open} label="open tasks" tint={c.blue} /><Metric value={overdue} label="overdue" tint={c.amber} /></View>
      <WorkspaceSection title="This week" icon="stats-chart-outline" tint={c.green}>
        <Text style={s.meta}>Tasks completed each day, Monday to Sunday</Text>
        <View style={s.chart}>{week.map((day, i) => <View key={day} style={s.barCell}><Text style={s.barValue}>{completed[i] || ""}</Text><View style={[s.bar, { height: 4 + 29 * completed[i] / Math.max(1, ...completed), backgroundColor: completed[i] ? c.green : c.line }]} /><Text style={[s.day, day === today && s.today]}>{["M", "T", "W", "T", "F", "S", "S"][i]}</Text></View>)}</View>
      </WorkspaceSection>
      <WorkspaceSection title="Task balance" icon="checkmark-circle-outline" count={String(tasks.length) + " total"}>
        {tasks.length ? <View style={s.balance}>{done ? <View style={[s.balanceDone, { flex: done }]} /> : null}{open ? <View style={[s.balanceOpen, { flex: open }]} /> : null}</View> : <Text style={s.empty}>No task history yet.</Text>}
        <View style={s.legend}><Text style={s.meta}>{done} complete</Text><Text style={s.meta}>{open} open</Text></View>
      </WorkspaceSection>
      <WorkspaceSection title="Learning" icon="school-outline" tint="#b39ddb" count={String(data.courses.length) + " items"}>
        {(["course", "certification", "selfpaced", "skill", "reading"] as const).map(kind => {
          const count = data.courses.filter(item => (item.kind ?? "course") === kind).length
          return count ? <View key={kind} style={s.kind}><Text style={s.kindTitle}>{({ course: "Courses", certification: "Certifications", selfpaced: "Self-paced", skill: "Skills", reading: "Reading" })[kind]}</Text><Text style={s.meta}>{count}</Text></View> : null
        })}
        {!data.courses.length ? <Text style={s.empty}>No learning items yet.</Text> : null}
      </WorkspaceSection>
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see insights." : message ?? "Loading your workspace…"}</Text>}
  </WorkspacePage>
}

function Metric({ value, label, tint }: { value: number; label: string; tint: string }) { return <View style={s.metric}><Text style={[s.value, { color: tint }]}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View> }
const s = StyleSheet.create({ meta: { color: c.muted, fontSize: 11 }, metrics: { flexDirection: "row", gap: 7 }, metric: { flex: 1, backgroundColor: c.panel, borderRadius: 8, padding: 10, gap: 3 }, value: { fontSize: 20, fontWeight: "700" }, metricLabel: { color: c.muted, fontSize: 11 }, chart: { minHeight: 77, flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", paddingVertical: 9, backgroundColor: c.panel, borderRadius: 8 }, barCell: { width: 27, alignItems: "center", justifyContent: "flex-end", gap: 4 }, barValue: { color: c.text2, fontSize: 10, height: 14 }, bar: { width: 11, borderRadius: 4 }, day: { color: c.muted, fontSize: 10 }, today: { color: c.accent, fontWeight: "700" }, balance: { flexDirection: "row", height: 8, borderRadius: 5, overflow: "hidden", gap: 2, marginTop: 6 }, balanceDone: { backgroundColor: c.green }, balanceOpen: { backgroundColor: c.blue }, legend: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }, kind: { minHeight: 31, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: c.line }, kindTitle: { color: c.text2, fontSize: 12 }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9 } })
