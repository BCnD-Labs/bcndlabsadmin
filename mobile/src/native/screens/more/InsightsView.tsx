import { StyleSheet, Text, View } from "react-native"
import { color } from "../../../theme.ts"
import { Card, tone } from "../../ui.tsx"
import { SAMPLE_INSIGHTS } from "../../sample.ts"

/** Invented per-day counts for the bar chart (sample data, Monday to Sunday). */
const WEEK_SAMPLE: { day: string; letter: string; tasks: number }[] = [
  { day: "Monday", letter: "M", tasks: 2 },
  { day: "Tuesday", letter: "T", tasks: 3 },
  { day: "Wednesday", letter: "W", tasks: 1 },
  { day: "Thursday", letter: "T", tasks: 2 },
  { day: "Friday", letter: "F", tasks: 2 },
  { day: "Saturday", letter: "S", tasks: 1 },
  { day: "Sunday", letter: "S", tasks: 0 },
]

const BAR_MAX_HEIGHT = 120

export function InsightsView() {
  const max = Math.max(1, ...WEEK_SAMPLE.map((d) => d.tasks))
  return (
    <>
      <View style={styles.stats}>
        <Stat label="Completed this week" value={SAMPLE_INSIGHTS.completedThisWeek} />
        <Stat label="Day streak" value={SAMPLE_INSIGHTS.streakDays} />
      </View>
      <View style={styles.stats}>
        <Stat label="Open tasks" value={SAMPLE_INSIGHTS.openTasks} />
        <Stat label="Overdue" value={SAMPLE_INSIGHTS.overdue} />
      </View>
      <Card title="Tasks done per day">
        <Text style={styles.note}>Sample counts, not connected.</Text>
        <View style={styles.chart}>
          {WEEK_SAMPLE.map((d) => {
            const height = d.tasks === 0 ? 2 : Math.round((d.tasks / max) * BAR_MAX_HEIGHT)
            return (
              <View key={d.day} style={styles.col} accessible accessibilityLabel={`${d.day} ${d.tasks} tasks`}>
                <View style={[styles.bar, { height }]} />
                <Text style={styles.letter}>{d.letter}</Text>
              </View>
            )
          })}
        </View>
      </Card>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: color.panel, borderRadius: 14, borderWidth: 1, borderColor: color.edge, padding: 12, gap: 2 },
  value: { color: color.text, fontSize: 22, fontWeight: "700" },
  label: { color: color.muted, fontSize: 12 },
  note: { color: color.faint, fontSize: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: BAR_MAX_HEIGHT + 24, paddingTop: 8 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  bar: { width: 22, borderRadius: 6, backgroundColor: tone.blue },
  letter: { color: color.muted, fontSize: 12, fontWeight: "600" },
})
