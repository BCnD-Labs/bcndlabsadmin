import { TextInput } from "../../editing/keyboard.tsx"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { TASK_TABS, removeTask, toggleStar, toggleTask, type Collections, type TaskTab } from "../../../lib/shared.ts"
import { plannerColor as color } from "../../planner-theme.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import { showSnack } from "../../snack/snack-store.ts"
import { Button, ChipRow, Empty, Icon, tone } from "../../ui.tsx"
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
export function TasksView({ data, today, onEdit, onCreateDue, search: query, onSearchChange }: { data: Collections; today: string; onEdit: (id: string) => void; onCreateDue: (due: string | undefined) => void; search?: string; onSearchChange?: (value: string) => void }) {
  const { mutate, message } = useWorkspace()
  const [tab, setTab] = useState<TaskTab>("today")
  const [localSearch, setLocalSearch] = useState("")
  const search = query ?? localSearch
  const setSearch = onSearchChange ?? setLocalSearch
  const [starredOnly, setStarredOnly] = useState(false)
  // Checked off here: stays listed (struck through) until the tab changes, like the web.
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  const [menuId, setMenuId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
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
    setPreviewId(null)
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
    <TaskRow key={r.id} row={r} task={data.tasks.find(t => t.id === r.id)!} expanded={previewId === r.id} onSelect={() => setPreviewId(value => value === r.id ? null : r.id)} density={density} tagFocus={tagFocus} onToggle={() => toggle(r.id)} onOpen={() => onEdit(r.id)} onStar={() => star(r.id)} onDelete={() => remove(r.id)} onMenu={() => setMenuId(r.id)} />
  )
  const renderSection = (s: PlannerSection, tagFocus: boolean) => (
    <View key={s.key} accessibilityLabel={s.title ?? "Completed"}>
      {s.title ? (
        <Pressable style={styles.head} onPress={() => setCollapsed((all) => { const next = new Set(all); if (next.has(s.key)) next.delete(s.key); else next.add(s.key); return next })} accessibilityRole="button" accessibilityLabel={`${collapsed.has(s.key) ? "Expand" : "Collapse"} ${s.title}`} accessibilityState={{ expanded: !collapsed.has(s.key) }}>
          <Icon name={collapsed.has(s.key) ? "chevron-forward" : "chevron-down"} size={15} tint={color.muted} />
          <Text style={[styles.sectionTitle, s.warn && styles.warn]} accessibilityRole="header">{s.title}</Text>
          <View style={styles.countBubble}><Text style={styles.count}>{s.count}</Text></View>
        </Pressable>
      ) : null}
      {!s.title || !collapsed.has(s.key) ? <View style={styles.list}>{s.rows.map((r) => renderRow(r, tagFocus))}</View> : null}
    </View>
  )

  return (
    <>
      <View style={styles.filters}>
        <View style={styles.tabs}>
          <ChipRow>
            {TASK_TABS.map((t) => (
              <Pressable key={t.value} onPress={() => changeTab(t.value)} style={[styles.filter, tab === t.value && styles.filterOn]} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.value }}>
                <Text style={[styles.filterText, tab === t.value && styles.filterTextOn]}>{t.label}</Text>
                {t.value !== "done" ? <Text style={[styles.filterCount, tab === t.value && styles.filterTextOn]}>{counts[t.value]}</Text> : null}
              </Pressable>
            ))}
          </ChipRow>
        </View>
        <Pressable onPress={() => setStarredOnly((v) => !v)} style={[styles.tool, starredOnly && styles.toolOn]} accessibilityRole="button" accessibilityLabel="Starred only" accessibilityState={{ selected: starredOnly }}>
          <Icon name={starredOnly ? "star" : "star-outline"} size={17} tint={starredOnly ? tone.amber : color.text2} />
        </Pressable>
        <Pressable onPress={flipDensity} style={styles.tool} accessibilityRole="button" accessibilityLabel={`Row density: ${density}. Switch to ${density === "compact" ? "comfortable" : "compact"}`}>
          <Icon name={density === "compact" ? "reorder-four-outline" : "reorder-two-outline"} size={19} tint={color.text2} />
        </Pressable>
      </View>
      {query === undefined ? <TextInput value={search} onChangeText={setSearch} placeholder="Search tasks" placeholderTextColor={color.muted} accessibilityLabel="Search tasks" returnKeyType="search" autoCorrect={false} style={styles.input} /> : null}
      <QuickAdd today={today} defaultDue={defaultDue} />
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
  filters: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabs: { flex: 1, minWidth: 0 },
  filter: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32, paddingHorizontal: 10, borderRadius: 18, backgroundColor: color.panel },
  filterOn: { backgroundColor: color.selected },
  filterText: { color: color.text2, fontSize: 12, fontWeight: "600" },
  filterCount: { color: color.muted, fontSize: 10 },
  filterTextOn: { color: color.accent },
  input: { minHeight: 38, borderRadius: 20, backgroundColor: color.panel, color: color.text, paddingHorizontal: 14, paddingVertical: 6, fontSize: 14 },
  tool: { width: 34, height: 34, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: color.panel },
  toolOn: { backgroundColor: "#423722" },
  empty: { gap: 8 },
  fabRoom: { height: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32, marginBottom: 3, marginTop: 6 },
  sectionTitle: { flex: 1, color: color.text2, fontSize: 12, fontWeight: "600" },
  countBubble: { minWidth: 22, height: 22, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: color.panel },
  count: { color: color.muted, fontSize: 11 },
  warn: { color: tone.red },
  list: { gap: 2 },
})

