import { Text } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { Card, Empty, Screen } from "../ui.tsx"

/** Counts are derived from saved records, never sample activity. */
export function InsightsScreen() {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const today = todayKey()
  const monday = new Date(`${today}T12:00:00`)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const start = [monday.getFullYear(), String(monday.getMonth() + 1).padStart(2, "0"), String(monday.getDate()).padStart(2, "0")].join("-")
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const counts = [
    ["Completed this week", tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) >= start).length],
    ["Open tasks", tasks.filter(t => !t.done).length],
    ["Overdue", tasks.filter(t => !t.done && t.due && t.due < today).length],
    ["Learning items", data?.courses.length ?? 0],
  ] as const
  return <Screen title="Insights" onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? counts.map(([label, value]) => <Card key={label} title={label}><Text style={{ color: "#e3e5e8", fontSize: 28, fontWeight: "700" }}>{value}</Text></Card>) : <Card><Empty>{status === "signed-out" ? "Sign in under Settings to see your workspace." : message ?? "Loading your workspace…"}</Empty></Card>}
  </Screen>
}
