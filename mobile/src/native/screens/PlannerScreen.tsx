import { KeyboardFrame, KeyboardScrollView, TextInput } from "../editing/keyboard.tsx"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { plannerColor as c } from "../planner-theme.ts"
import { SyncStatus } from "../data/SyncStatus.tsx"
import { todayKey } from "../data/sync-view.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { Button, Card, Icon, NAV_CLEARANCE } from "../ui.tsx"
import { CalendarView } from "./planner/CalendarView.tsx"
import { useQuickAddDue } from "../quickadd/QuickAdd.tsx"
import { TaskSheet, type Editor } from "./planner/TaskSheet.tsx"
import { useLogDrafts } from "./planner/log/useLogDrafts.ts"
import { editAccess } from "./planner/task-form.ts"
import { TasksView } from "./planner/TasksView.tsx"
type Mode = "tasks" | "calendar"
const MODES: { key: Mode; label: string }[] = [{ key: "tasks", label: "Tasks" }, { key: "calendar", label: "Calendar" }]
export function PlannerScreen({ onOpenSettings, focused = true }: { onOpenSettings: () => void; focused?: boolean }) {
  const { data, status, message, refreshing, refresh, mutate } = useWorkspace()
  const [mode, setMode] = useState<Mode>("calendar"), [search, setSearch] = useState("")
  const [headerHeight, setHeaderHeight] = useState(136)
  const taskClose = useRef<(() => void) | null>(null)
  const [selectedDay, setSelectedDay] = useState(() => todayKey())
  const [editor, setEditor] = useState<Editor | null>(null), [createDue, setCreateDue] = useState<string | undefined>()
  const edit = useCallback((id: string) => setEditor({ mode: "edit", id }), [])
  const today = todayKey(), access = editAccess(status, true)
  useQuickAddDue(createDue, focused)
  const logs = useLogDrafts(data?.journal, mutate, access.ok)
  const floating = mode === "tasks"
  let body
  if (data) {
    body = floating ? <TasksView data={data} today={today} onEdit={edit} onCreateDue={setCreateDue} search={search} onSearchChange={setSearch} />
      : <CalendarView selected={selectedDay} onSelect={setSelectedDay} data={data} today={today} onEdit={edit} onCreateDue={setCreateDue} logs={logs} blocked={access.reason} />
  } else if (status === "loading") {
    body = <View style={styles.loading}><ActivityIndicator color={c.accent} /><Text style={styles.note}>Loading your workspace…</Text></View>
  } else if (status === "signed-out") {
    body = <Card title="You're signed out"><Text style={styles.note}>Sign in under Account in Settings to see your tasks here.</Text><Button label="Sign in" primary onPress={onOpenSettings} /></Card>
  } else {
    body = <Card title={status === "offline" ? "Can't reach the server" : "Couldn't load your workspace"}><Text style={styles.note}>{status === "offline" ? "This phone has no saved copy of your workspace yet." : message ?? "Something went wrong."}</Text><Button label="Try again" primary onPress={() => void refresh()} /></Card>
  }
  const header = <View style={[styles.header, floating && styles.floating]} pointerEvents="box-none" onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
    <View style={styles.titleRow}><Text style={styles.title}>Blackwall <Text style={styles.breadcrumb}>/ Planner</Text></Text><SyncStatus onOpenSettings={onOpenSettings} /></View>
    {floating ? <View style={styles.searchRow}>
      <View style={styles.search}><Icon name="search-outline" size={17} tint={c.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Find tasks…" placeholderTextColor={c.muted} style={styles.searchInput} accessibilityLabel="Find tasks" autoCorrect={false} returnKeyType="search" />{search ? <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear task search" style={styles.clear}><Icon name="close-circle" size={17} tint={c.muted} /></Pressable> : null}</View>
      <Pressable style={styles.calendarButton} onPress={() => setMode("calendar")} accessibilityRole="button" accessibilityLabel="Open calendar"><Icon name="calendar-outline" tint={c.accent} /></Pressable>
    </View> : null}
    {data ? <View style={styles.tabs} accessibilityRole="tablist">{MODES.map(m => <Pressable key={m.key} style={[styles.tab, mode === m.key && styles.tabOn]} onPress={() => setMode(m.key)} accessibilityRole="tab" accessibilityLabel={m.label} accessibilityState={{ selected: mode === m.key }}><Text style={[styles.tabText, mode === m.key && styles.tabTextOn]}>{m.label}</Text></Pressable>)}</View> : null}
  </View>
  return <KeyboardFrame style={styles.fill}>
    {!floating ? header : null}
    {data && !floating && status !== "ok" && status !== "loading" && message ? <Text style={[styles.note, { paddingHorizontal: 14 }]}>{message}</Text> : null}
    {mode === "calendar" && data ? body : <KeyboardScrollView style={styles.fill} contentContainerStyle={[styles.content, floating && { paddingTop: headerHeight + 12 }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} colors={[c.accent]} progressViewOffset={floating ? 136 : 0} />}>
      {data && floating && status !== "ok" && status !== "loading" && message ? <Text style={styles.note}>{message}</Text> : null}
      {body}
    </KeyboardScrollView>}
    {floating ? header : null}
    {data && editor ? <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => taskClose.current?.()}>
    {data && editor ? <TaskSheet key={editor.mode === "edit" ? editor.id : "new"} registerClose={handler => { taskClose.current = handler }} embedded editor={editor} data={data} today={today} onClose={() => setEditor(null)} /> : null}
    </Modal> : null}
  </KeyboardFrame>
}
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, content: { padding: 14, paddingBottom: NAV_CLEARANCE, gap: 10 }, floatingContent: { paddingTop: 146 },
  header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 8 }, floating: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, title: { color: c.text, fontSize: 13, fontWeight: "600", backgroundColor: c.ground, borderRadius: 8, padding: 3 }, breadcrumb: { color: c.muted, fontWeight: "400" },
  searchRow: { flexDirection: "row", gap: 8 }, search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.panel, borderRadius: 24, paddingHorizontal: 12, elevation: 3 }, searchInput: { flex: 1, color: c.text, fontSize: 14, height: 38, paddingVertical: 6 }, clear: { minWidth: 28, minHeight: 34, alignItems: "center", justifyContent: "center" },
  calendarButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, elevation: 3 }, tabs: { flexDirection: "row", gap: 5 }, tab: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderRadius: 16 }, tabOn: { backgroundColor: c.selected }, tabText: { color: c.text2, fontSize: 12, fontWeight: "500" }, tabTextOn: { color: c.accent, fontWeight: "600" },
  loading: { alignItems: "center", gap: 8, paddingVertical: 32 }, note: { color: c.text2, fontSize: 13, lineHeight: 19 },
})


