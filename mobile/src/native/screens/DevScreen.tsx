import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { color } from "../../theme.ts"
import { Badge, Card, Chip, ChipRow, Empty, Icon, Screen, SampleBadge, tone } from "../ui.tsx"
import { SAMPLE_REPOS, type SampleRepo } from "../sample.ts"

type Filter = "all" | "failing"

/** Repos from the sample set. Read-only: no taps change anything. */
export function DevScreen(_props: { onOpenSettings: () => void }) {
  const [filter, setFilter] = useState<Filter>("all")
  const shown = SAMPLE_REPOS.filter((r) => filter === "all" || r.status === "failing")
  const openPrs = SAMPLE_REPOS.reduce((sum, r) => sum + r.openPrs, 0)
  const issues = SAMPLE_REPOS.reduce((sum, r) => sum + r.issues, 0)

  return (
    <Screen title="Projects" subtitle="Repos and their status" right={<SampleBadge />}>
      <View style={styles.stats}>
        <Stat label="Repos" value={SAMPLE_REPOS.length} />
        <Stat label="Open PRs" value={openPrs} />
        <Stat label="Issues" value={issues} />
      </View>

      <ChipRow>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Failing" active={filter === "failing"} onPress={() => setFilter("failing")} />
      </ChipRow>

      {shown.length === 0 ? <Empty>No failing repos.</Empty> : null}
      {shown.map((r) => (
        <RepoCard key={r.id} repo={r} />
      ))}
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function RepoCard({ repo }: { repo: SampleRepo }) {
  const passing = repo.status === "passing"
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {repo.name}
        </Text>
        <Badge label={passing ? "Passing" : "Failing"} tint={passing ? tone.green : tone.red} />
      </View>
      <View style={styles.branch}>
        <Icon name="git-branch-outline" size={16} />
        <Text style={styles.meta}>{repo.branch}</Text>
      </View>
      <Text style={styles.meta}>{`Open PRs ${repo.openPrs} · Issues ${repo.issues}`}</Text>
      <Text style={styles.meta}>{`Last push ${repo.lastPush}`}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: color.panel, borderRadius: 14, borderWidth: 1, borderColor: color.edge, padding: 12, gap: 2 },
  statValue: { color: color.text, fontSize: 20, fontWeight: "700" },
  statLabel: { color: color.muted, fontSize: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, color: color.text, fontSize: 15, fontWeight: "700" },
  branch: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: color.muted, fontSize: 13 },
})
