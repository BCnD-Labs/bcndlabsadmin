import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { TASK_TABS, toggleStar, toggleTask, type Collections, type TaskTab } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { Button, Chip, ChipRow, Empty, Icon, SectionLabel, tone } from "../../ui.tsx"
import { plannerRows, tabCounts } from "./rows.ts"
import { QuickAdd } from "./QuickAdd.tsx"
import { TaskRow } from "./TaskRow.tsx"

/**
 * The Planner's Tasks tab on the real workspace: Today / Next / All / Done, search, starred-only,
 * grouped like the web. Quick add sits on top, a row opens the editor, the checkbox and star save
 * through the shared `toggleTask` / `toggleStar` rules. `onCreateDue` tells the screen's "+" which
 * due date a new task starts with (today on the Today tab, none elsewhere, as on the web).
 */
export function TasksView({ data, today, onEdit, onCreateDue }: { data: Collections; today: string; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void }) {
  const { mutate } = useWorkspace()
  const [tab, setTab] = useState<TaskTab>("today")
  const [search, setSearch] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  // Checked off here: stays listed (struck through) until the tab changes, like the web.
  const [lingering, setLingering] = useState<Set<string>>(new Set())

  const view = useMemo(
    () => plannerRows(data.tasks, data.courses, { tab, search, today, starredOnly, lingering }),
    [data.tasks, data.courses, tab, search, today, starredOnly, lingering],
  )
  const defaultDue = tab === "today" ? today : undefined
  useEffect(() => onCreateDue(defaultDue), [defaultDue, onCreateDue])
  const counts = useMemo(() => tabCounts(data.tasks, today), [data.tasks, today])

  function changeTab(next: TaskTab) {
    setTab(next)
    setLingering(new Set())
  }

  function toggle(id: string, done: boolean) {
    if (!done) setLingering((s) => new Set(s).add(id))
    void mutate(["tasks"], (d) => toggleTask(d, id))
  }

  return (
    <>
      <QuickAdd today={today} defaultDue={defaultDue} />
      <ChipRow>
        {TASK_TABS.map((t) => (
          <Chip key={t.value} label={t.value === "done" ? t.label : `${t.label} ${counts[t.value]}`} active={tab === t.value} onPress={() => changeTab(t.value)} />
        ))}
      </ChipRow>
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks"
          placeholderTextColor={color.faint}
          accessibilityLabel="Search tasks"
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
        <Pressable onPress={() => setStarredOnly((v) => !v)} style={[styles.star, starredOnly && styles.starOn]} accessibilityRole="button" accessibilityLabel="Starred only" accessibilityState={{ selected: starredOnly }}>
          <Icon name={starredOnly ? "star" : "star-outline"} size={20} tint={starredOnly ? tone.amber : color.text2} />
        </Pressable>
      </View>
      {view.total === 0 ? (
        <View style={styles.empty}>
          <Empty>{view.empty.text}</Empty>
          {view.empty.filtered ? (
            <Button
              label="Clear filters"
              onPress={() => {
                setSearch("")
                setStarredOnly(false)
              }}
            />
          ) : null}
        </View>
      ) : (
        view.sections.map((s) => (
          <View key={s.key} accessibilityLabel={s.title ?? "Completed"}>
            {s.title ? (
              <View style={styles.head}>
                <SectionLabel>{s.title}</SectionLabel>
                <Text style={[styles.count, s.warn && styles.warn]}>{`· ${s.count}`}</Text>
              </View>
            ) : null}
            <View style={styles.list}>
              {s.rows.map((r) => (
                <TaskRow key={r.id} row={r} onToggle={() => toggle(r.id, r.done)} onOpen={() => onEdit(r.id)} onStar={() => void mutate(["tasks"], (d) => toggleStar(d, r.id))} />
              ))}
            </View>
          </View>
        ))
      )}
      <View style={styles.fabRoom} />
    </>
  )
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.panel, color: color.text, paddingHorizontal: 14, fontSize: 15 },
  star: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.border },
  starOn: { borderColor: tone.amber },
  empty: { gap: 8 },
  fabRoom: { height: 64 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  count: { color: color.faint, fontSize: 12, fontWeight: "700", marginTop: 4 },
  warn: { color: tone.red },
  list: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, paddingHorizontal: 12 },
})
