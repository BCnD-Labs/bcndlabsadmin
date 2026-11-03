import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { TASK_TABS, removeTask, toggleStar, toggleTask, type Collections, type TaskTab } from "../../../lib/shared.ts"
import { color } from "../../../theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { showSnack } from "../../snack/snack-store.ts"
import { Button, Chip, ChipRow, Empty, Icon, SectionLabel, tone } from "../../ui.tsx"
import { QuickActionsSheet } from "./QuickActionsSheet.tsx"
import { QuickAdd } from "./QuickAdd.tsx"
import { TaskRow } from "./TaskRow.tsx"
import { applyQuickAction, quickActions, type QuickKey } from "./quick-actions.ts"
import { plannerRows, tabCounts, type PlannerRow, type PlannerSection } from "./rows.ts"
import { resolveWithin } from "./task-form.ts"
import { undoDelete, undoToggle, type UndoAction } from "./task-undo.ts"
import { offerUndo } from "./undo-snack.ts"
import { useTaskDensity } from "./useTaskDensity.ts"

/**
 * The Planner's Tasks tab on the real workspace: Today / Next / All / Done, search, starred-only,
 * grouped like the web, with today's daily focus on top of the Today tab. Quick add sits on top, a
 * row opens the editor, long-press opens quick actions, swiping completes / stars / deletes, and a
 * snackbar offers Undo after a delete or a complete. Everything saves through the shared record
 * rules. `onCreateDue` tells the screen's "+" which due date a new task starts with (today on the
 * Today tab, none elsewhere, as on the web).
 */
export function TasksView({ data, today, onEdit, onCreateDue }: { data: Collections; today: string; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void }) {
  const { mutate, message } = useWorkspace()
  const [tab, setTab] = useState<TaskTab>("today")
  const [search, setSearch] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  // Checked off here: stays listed (struck through) until the tab changes, like the web.
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  const [menuId, setMenuId] = useState<string | null>(null)
  const [density, flipDensity] = useTaskDensity()
  // The newest refusal message, read after an awaited save.
  const latest = useRef({ message })
  latest.current = { message }

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

  /** Saves a change; when it is on the phone and has an undo, offers it. A refusal says why instead. */
  const run = useCallback(
    async (change: (d: Collections) => Collections, undo?: UndoAction) => {
      const ok = await resolveWithin(mutate(["tasks"], change), 1500, true)
      if (!ok) return showSnack(latest.current.message ?? "That couldn't be saved.")
      if (undo) offerUndo(undo, mutate)
    },
    [mutate],
  )

  function toggle(id: string) {
    const t = data.tasks.find((x) => x.id === id)
    if (!t) return
    if (!t.done) setLingering((s) => new Set(s).add(id))
    void run((d) => toggleTask(d, id), undoToggle(t))
  }
  const star = (id: string) => void run((d) => toggleStar(d, id))
  function remove(id: string) {
    const t = data.tasks.find((x) => x.id === id)
    if (t) void run((d) => removeTask(d, id), undoDelete(t))
  }
  function quick(key: QuickKey) {
    const id = menuId
    setMenuId(null)
    if (!id) return
    if (key === "edit") onEdit(id)
    else if (key === "complete") toggle(id)
    else if (key === "delete") remove(id)
    else void run((d) => applyQuickAction(d, id, key, today))
  }

  const menuTask = menuId ? data.tasks.find((t) => t.id === menuId) : undefined
  const renderRow = (r: PlannerRow, tagFocus: boolean) => (
    <TaskRow key={r.id} row={r} density={density} tagFocus={tagFocus} onToggle={() => toggle(r.id)} onOpen={() => onEdit(r.id)} onStar={() => star(r.id)} onDelete={() => remove(r.id)} onMenu={() => setMenuId(r.id)} />
  )
  const renderSection = (s: PlannerSection, tagFocus: boolean) => (
    <View key={s.key} accessibilityLabel={s.title ?? "Completed"}>
      {s.title ? (
        <View style={styles.head}>
          <SectionLabel>{s.title}</SectionLabel>
          <Text style={[styles.count, s.warn && styles.warn]}>{`· ${s.count}`}</Text>
        </View>
      ) : null}
      <View style={styles.list}>{s.rows.map((r) => renderRow(r, tagFocus))}</View>
    </View>
  )

  return (
    <>
      <QuickAdd today={today} defaultDue={defaultDue} />
      <ChipRow>
        {TASK_TABS.map((t) => (
          <Chip key={t.value} label={t.value === "done" ? t.label : `${t.label} ${counts[t.value]}`} active={tab === t.value} onPress={() => changeTab(t.value)} />
        ))}
      </ChipRow>
      <View style={styles.searchRow}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search tasks" placeholderTextColor={color.faint} accessibilityLabel="Search tasks" returnKeyType="search" autoCorrect={false} style={styles.input} />
        <Pressable onPress={() => setStarredOnly((v) => !v)} style={[styles.tool, starredOnly && styles.toolOn]} accessibilityRole="button" accessibilityLabel="Starred only" accessibilityState={{ selected: starredOnly }}>
          <Icon name={starredOnly ? "star" : "star-outline"} size={20} tint={starredOnly ? tone.amber : color.text2} />
        </Pressable>
        <Pressable onPress={flipDensity} style={styles.tool} accessibilityRole="button" accessibilityLabel={`Row density: ${density}. Switch to ${density === "compact" ? "comfortable" : "compact"}`}>
          <Icon name={density === "compact" ? "reorder-four-outline" : "reorder-two-outline"} size={22} tint={color.text2} />
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
        <>
          {view.focus ? renderSection(view.focus, false) : null}
          {view.sections.map((s) => renderSection(s, true))}
        </>
      )}
      <View style={styles.fabRoom} />
      {menuTask ? <QuickActionsSheet title={menuTask.title} actions={quickActions(menuTask, today)} onPick={quick} onClose={() => setMenuId(null)} /> : null}
    </>
  )
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.border, backgroundColor: color.panel, color: color.text, paddingHorizontal: 14, fontSize: 15 },
  tool: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color.panel, borderWidth: 1, borderColor: color.border },
  toolOn: { borderColor: tone.amber },
  empty: { gap: 8 },
  fabRoom: { height: 64 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  count: { color: color.faint, fontSize: 12, fontWeight: "700", marginTop: 4 },
  warn: { color: tone.red },
  list: { backgroundColor: color.panel, borderRadius: 16, borderWidth: 1, borderColor: color.edge, overflow: "hidden" },
})
