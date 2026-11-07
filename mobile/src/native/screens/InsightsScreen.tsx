import { StyleSheet, Text, View } from "react-native"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { HeatGrid, MiniBar, StatCell, StatStrip, StackedBar, WeekBars } from "../kit/charts.tsx"
import { PropChip } from "../kit/PropChip.tsx"
import { averagePerDay, heatCells, streak, taskBalance, weekDays } from "../kit/stats.ts"
import { chipTone, kit } from "../kit/tokens.ts"
import { mono } from "../../theme.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { KINDS } from "./learning/learning-view.ts"

/** Local visual summaries are derived only from saved workspace records. */
export function InsightsScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const today = todayKey()
  const tasks = data?.tasks.filter(t => t.kind !== "event") ?? []
  const week = weekDays(today)
  const todayIndex = Math.max(0, week.indexOf(today))
  const completed = week.map(day => tasks.filter(t => t.done && t.completedAt && t.completedAt.slice(0, 10) === day).length)
  const weekTotal = completed.reduce((n, x) => n + x, 0)
  const average = averagePerDay(completed, todayIndex + 1)
  const balance = taskBalance(tasks, today)
  const run = streak(tasks, today)
  const heat = heatCells(tasks, today, 5)
  const heatTotal = heat.reduce((n, x) => n + x.count, 0)
  return <WorkspacePage page="Insights" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {data ? <>
      <Text style={s.meta}>Your workspace at a glance</Text>
      <StatStrip>
        <StatCell label="Done wk" value={weekTotal} tint={kit.good} />
        <StatCell label="Open" value={balance.open + balance.overdue} tint={kit.open} />
        <StatCell label="Overdue" value={balance.overdue} tint={balance.overdue ? chipTone.overdue.ink : c.text} />
        <StatCell label="Streak" value={`${run.length}d`} tint={run.length ? chipTone.status.ink : c.text} />
      </StatStrip>
      <WorkspaceSection title="This week" icon="stats-chart-outline" tint={c.green} count={`${weekTotal} done`} collapsible>
        <Text style={s.meta}>Tasks completed each day, Monday to Sunday. Days to come are dashed.</Text>
        <WeekBars counts={completed} labels={["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]} todayIndex={todayIndex} average={average} />
      </WorkspaceSection>
      <WorkspaceSection title="Task balance" icon="checkmark-circle-outline" tint={kit.open} count={tasks.length ? `${balance.completePct}% complete` : "0 total"} collapsible>
        {tasks.length ? <StackedBar parts={[{ label: "done", value: balance.done, color: kit.good }, { label: "open", value: balance.open, color: kit.open }, { label: "overdue", value: balance.overdue, color: kit.bad }]} /> : <Text style={s.empty}>No task history yet.</Text>}
      </WorkspaceSection>
      <WorkspaceSection title="Last 5 weeks" icon="grid-outline" tint={c.green} count={`${heatTotal} done`} collapsible>
        <HeatGrid cells={heat} />
      </WorkspaceSection>
      <WorkspaceSection title="Learning" icon="school-outline" tint={kit.hue.learning} count={`${data.courses.length} ${data.courses.length === 1 ? "item" : "items"}`} collapsible>
        {KINDS.map(kind => {
          const courses = data.courses.filter(item => (item.kind ?? "course") === kind.value)
          if (!courses.length) return null
          const ids = new Set(courses.map(x => x.id))
          const work = tasks.filter(t => t.courseId && ids.has(t.courseId))
          const finished = work.filter(t => t.done).length
          return <View key={kind.value} style={s.kind}>
            <View style={[s.kindMark, { backgroundColor: kind.tint }]} />
            <Text style={s.kindTitle}>{kind.label}</Text>
            <PropChip kind="course" value={String(courses.length)} />
            <View style={s.kindBar}>{work.length ? <MiniBar value={finished / work.length} tint={kind.tint} /> : null}</View>
            <Text style={s.kindPct}>{work.length ? `${finished}/${work.length}` : "–"}</Text>
          </View>
        })}
        {!data.courses.length ? <Text style={s.empty}>No learning items yet.</Text> : <Text style={s.meta}>Bars count finished tasks linked to each kind of item.</Text>}
      </WorkspaceSection>
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see insights." : message ?? "Loading your workspace…"}</Text>}
  </WorkspacePage>
}

const s = StyleSheet.create({
  meta: { color: c.muted, fontSize: 11 }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9 },
  kind: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: c.line }, kindMark: { width: 4, height: 18, borderRadius: 2 }, kindTitle: { width: 86, color: c.text2, fontSize: 12, fontWeight: "600" }, kindBar: { flex: 1 }, kindPct: { width: 40, textAlign: "right", color: c.text2, fontFamily: mono, fontSize: 10, fontWeight: "700" },
})
