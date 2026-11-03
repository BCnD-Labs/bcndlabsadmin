import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { Badge, Card, Empty, Icon, ListRow, SampleBadge, Screen, TYPE_ICON, TYPE_LABEL, TYPE_TONE, tone } from "../ui.tsx"
import { SAMPLE_COURSES, SAMPLE_COURSEWORK, SAMPLE_EVENTS, SAMPLE_INSIGHTS, SAMPLE_REPOS, SAMPLE_TASKS, SAMPLE_TODAY, type SampleTask } from "../sample.ts"
import { TaskCheck } from "./planner/TaskCheck.tsx"
import { formatDay, weekDays } from "./planner/dates.ts"

const WEEK = weekDays(SAMPLE_TODAY)
const WEEK_START = WEEK[0]
const WEEK_END = WEEK[6]

/** Open tasks due today or overdue, in sample order. Fixed at load; the checkboxes change local state only. */
const TODAY_TASKS = SAMPLE_TASKS.filter((t) => !t.done && !!t.due && t.due <= SAMPLE_TODAY)

/** The next five open coursework items, soonest first. */
const COMING_UP = SAMPLE_COURSEWORK.filter((w) => !w.done)
  .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
  .slice(0, 5)

/** Events in the week that contains today, by date then start time. */
const WEEK_EVENTS = SAMPLE_EVENTS.filter((e) => e.date >= WEEK_START && e.date <= WEEK_END).sort((a, b) => {
  const keyA = `${a.date} ${a.start}`
  const keyB = `${b.date} ${b.start}`
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
})

const STATS = [
  { label: "Completed", value: SAMPLE_INSIGHTS.completedThisWeek, tint: undefined },
  { label: "Day streak", value: SAMPLE_INSIGHTS.streakDays, tint: undefined },
  { label: "Open", value: SAMPLE_INSIGHTS.openTasks, tint: undefined },
  { label: "Overdue", value: SAMPLE_INSIGHTS.overdue, tint: SAMPLE_INSIGHTS.overdue > 0 ? tone.red : undefined },
]

/** Home skeleton: a stack of cards, all derived from the sample data. Cards are not tappable. */
export function HomeScreen(_props: { onOpenSettings: () => void }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const isDone = (t: SampleTask) => (t.id in overrides ? overrides[t.id] : t.done)
  const toggle = (t: SampleTask) => setOverrides((o) => ({ ...o, [t.id]: !isDone(t) }))
  const openToday = TODAY_TASKS.filter((t) => !isDone(t)).length

  return (
    <Screen title="Home" right={<SampleBadge />}>
      <Card
        title="Today"
        right={<Badge label={`${openToday} open`} tint={openToday > 0 ? tone.amber : tone.green} />}
      >
        {TODAY_TASKS.length === 0 ? <Empty>Nothing due today.</Empty> : null}
        {TODAY_TASKS.slice(0, 3).map((t) => (
          <ListRow
            key={t.id}
            title={t.title}
            done={isDone(t)}
            subtitle={t.due && t.due < SAMPLE_TODAY ? `Overdue · ${formatDay(t.due)}` : "Due today"}
            left={<TaskCheck checked={isDone(t)} onPress={() => toggle(t)} label={`${isDone(t) ? "Reopen" : "Complete"} ${t.title}`} />}
          />
        ))}
      </Card>

      <Card title="Coming up">
        {COMING_UP.length === 0 ? <Empty>No open coursework.</Empty> : null}
        {COMING_UP.map((w) => {
          const course = SAMPLE_COURSES.find((c) => c.id === w.courseId)
          return (
            <ListRow
              key={w.id}
              title={w.title}
              subtitle={`${course?.code ?? "No course"} · due ${formatDay(w.due)}`}
              left={<Icon name={TYPE_ICON[w.type]} tint={TYPE_TONE[w.type]} />}
              right={<Badge label={TYPE_LABEL[w.type]} tint={TYPE_TONE[w.type]} />}
            />
          )
        })}
      </Card>

      <Card title="This week">
        {WEEK_EVENTS.length === 0 ? <Empty>No events this week.</Empty> : null}
        {WEEK_EVENTS.map((e) => (
          <ListRow key={e.id} title={e.title} subtitle={formatDay(e.date)} right={<Text style={styles.time}>{`${e.start}–${e.end}`}</Text>} />
        ))}
      </Card>

      <Card title="Projects">
        {SAMPLE_REPOS.map((r) => (
          <ListRow
            key={r.id}
            title={r.name}
            subtitle={`${r.openPrs} open PRs · ${r.issues} issues · pushed ${r.lastPush}`}
            right={<Badge label={r.status === "passing" ? "Passing" : "Failing"} tint={r.status === "passing" ? tone.green : tone.red} />}
          />
        ))}
      </Card>

      <Card title="This week in numbers">
        <View style={styles.stats}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.stat} accessibilityLabel={`${s.label}: ${s.value}`}>
              <Text style={[styles.statValue, s.tint ? { color: s.tint } : null]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  time: { color: color.muted, fontSize: 12, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: color.well, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  statValue: { color: color.text, fontSize: 22, fontWeight: "700" },
  statLabel: { color: color.muted, fontSize: 11, marginTop: 2 },
})
