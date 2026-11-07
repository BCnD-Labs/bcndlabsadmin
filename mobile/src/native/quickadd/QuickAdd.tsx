import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BackHandler, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { shape } from "../../shape.ts"
import { mono } from "../../theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { todayKey } from "../data/sync-view.ts"
import { KeyboardFrame, TextInput } from "../editing/keyboard.tsx"
import { PropChip } from "../kit/PropChip.tsx"
import { FAB, FAB_EDGE } from "../nav/layout.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { DraftEditor } from "../screens/DraftEditor.tsx"
import { LearningReflectionSheet } from "../screens/LearningReflections.tsx"
import { ProjectEditor } from "../screens/ProjectEditor.tsx"
import { SiteEditor } from "../screens/SiteEditor.tsx"
import { CourseEditor } from "../screens/learning/CourseEditor.tsx"
import { ServiceEditor } from "../screens/mikoshi/ServiceEditor.tsx"
import { NoteSheet } from "../screens/planner/notes/NoteSheet.tsx"
import { TaskSheet } from "../screens/planner/TaskSheet.tsx"
import { Icon } from "../ui.tsx"
import { QUICK_ACTIONS, QUICK_GROUPS, reflectTargets, type QuickKind, type ReflectTarget } from "./actions.ts"

/**
 * The Planner tells quick add which day it is looking at, so a new task or event starts on that day.
 * Everything else about quick add ignores which screen is open.
 */
const DueContext = createContext<{ set: (due: string | undefined) => void; get: () => string | undefined }>({ set: () => {}, get: () => undefined })
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const due = useRef<string | undefined>(undefined)
  const value = useMemo(() => ({ set: (d: string | undefined) => { due.current = d }, get: () => due.current }), [])
  return <DueContext.Provider value={value}>{children}</DueContext.Provider>
}
/** While `active`, new tasks and events from quick add start on `due`. */
export function useQuickAddDue(due: string | undefined, active: boolean) {
  const { set } = useContext(DueContext)
  useEffect(() => {
    if (!active) return
    set(due)
    return () => set(undefined)
  }, [due, active, set])
}

/** The round + at the bottom right, its menu, and the editors it opens. Lives in the shell so every screen shares it. */
export function QuickAdd() {
  const { data, status } = useWorkspace()
  const dueCtx = useContext(DueContext)
  const [menu, setMenu] = useState(false)
  const [active, setActive] = useState<QuickKind | null>(null)
  const [notice, setNotice] = useState("")
  const [picking, setPicking] = useState(false)
  const [reflection, setReflection] = useState<{ courseId?: string; taskId?: string }>({})
  const [keyboard, setKeyboard] = useState(false)
  const today = todayKey()

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  useEffect(() => {
    if (!menu) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setMenu(false); return true })
    return () => sub.remove()
  }, [menu])

  function open() { setNotice(""); setMenu(v => !v) }
  function choose(kind: QuickKind) {
    if (!data) return setNotice("Load your workspace first.")
    if (status === "conflict") return setNotice("Resolve the sync conflict before editing.")
    setMenu(false); setNotice("")
    if (kind === "reflect-on") setPicking(true)
    else { setReflection({}); setActive(kind) }
  }
  const close = () => { setActive(null); setReflection({}) }

  return <>
    {menu ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityRole="button" accessibilityLabel="Close quick add menu" /> : null}
    {menu ? <View style={s.menu} accessibilityViewIsModal>
      <ScrollView keyboardShouldPersistTaps="handled" style={s.menuScroll}>
        {QUICK_GROUPS.map(group => <View key={group}>
          <Text style={s.group} accessibilityRole="header">{group.toUpperCase()}</Text>
          {QUICK_ACTIONS.filter(a => a.group === group).map(a => <Pressable key={a.kind} onPress={() => choose(a.kind)} style={({ pressed }) => [s.row, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`${a.label}. ${a.hint}`}>
            <View style={s.rowIcon}><Icon name={a.icon} size={16} tint={c.accent} /></View>
            <View style={s.rowText}><Text style={s.rowLabel}>{a.label}</Text><Text style={s.rowHint} numberOfLines={1}>{a.hint}</Text></View>
          </Pressable>)}
        </View>)}
      </ScrollView>
      {notice ? <Text style={s.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View> : null}
    {keyboard && !menu ? null : <Pressable onPress={open} style={({ pressed }) => [s.fab, pressed && s.fabPressed]} accessibilityRole="button" accessibilityLabel="Quick add" accessibilityState={{ expanded: menu }}>
      <Icon name={menu ? "close" : "add"} size={26} tint="#fff" />
    </Pressable>}
    {data && (active === "task" || active === "event") ? <TaskSheet key={active} editor={{ mode: "create", kind: active, due: active === "event" ? dueCtx.get() ?? today : dueCtx.get() }} data={data} today={today} onClose={close} /> : null}
    {data && active === "note" ? <NoteSheet key="note" editor={{ mode: "create" }} data={data} onClose={close} /> : null}
    {data && active === "learning" ? <CourseEditor key="learning" value="new" onClose={close} /> : null}
    {data && active === "project" ? <ProjectEditor key="project" value="new" data={data} onClose={close} /> : null}
    {data && active === "draft" ? <DraftEditor key="draft" value="new" data={data} siteId={data.sites.length === 1 ? data.sites[0]?.id : undefined} onClose={close} /> : null}
    {data && active === "site" ? <SiteEditor key="site" value="new" onClose={close} /> : null}
    {data && active === "tool" ? <ServiceEditor key="tool" value="new" groups={data.services.map(svc => svc.group)} onClose={close} /> : null}
    {data && active === "reflection" ? <LearningReflectionSheet key={`${reflection.courseId ?? ""}/${reflection.taskId ?? ""}`} data={data} initialCourseId={reflection.courseId} initialTaskId={reflection.taskId} onClose={close} /> : null}
    {data && picking ? <ReflectOn data={data} onClose={() => setPicking(false)} onPick={target => { setPicking(false); setReflection({ courseId: target.courseId, taskId: target.taskId }); setActive("reflection") }} /> : null}
  </>
}

/** Pick what to reflect on: open tasks, events, learning items and finished work, with search. */
function ReflectOn({ data, onClose, onPick }: { data: NonNullable<ReturnType<typeof useWorkspace>["data"]>; onClose: () => void; onPick: (target: ReflectTarget) => void }) {
  const [query, setQuery] = useState("")
  const rows = useMemo(() => reflectTargets(data, query), [data, query])
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardFrame style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
      <View style={s.head}><Text style={s.dialogTitle}>Reflect on…</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" tint={c.text2} /></Pressable></View>
      <View style={s.search}><Icon name="search-outline" size={16} tint={c.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Find a task, event or learning item…" placeholderTextColor={c.muted} style={s.searchInput} accessibilityLabel="Find something to reflect on" autoCorrect={false} returnKeyType="search" />{query ? <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search"><Icon name="close-circle" size={17} tint={c.muted} /></Pressable> : null}</View>
      <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
        {rows.map(row => <Pressable key={row.key} onPress={() => onPick(row)} style={({ pressed }) => [s.target, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Reflect on ${row.title}`}>
          <View style={s.targetBody}><Text style={s.targetTitle} numberOfLines={2}>{row.title}</Text>{row.sub ? <Text style={s.rowHint} numberOfLines={1}>{row.sub}</Text> : null}</View>
          <PropChip kind={row.kind === "task" ? "tag" : row.kind === "event" ? "date" : "course"} value={row.kind === "course" ? "LEARNING" : row.kind.toUpperCase()} />
        </Pressable>)}
        {!rows.length ? <Text style={s.empty}>{query ? "Nothing matches that search." : "No tasks, events or learning items yet. Use Add reflection to write one anyway."}</Text> : null}
      </ScrollView>
    </View></KeyboardFrame>
  </Modal>
}

const s = StyleSheet.create({
  fab: { position: "absolute", right: FAB_EDGE, bottom: FAB_EDGE, width: FAB, height: FAB, borderRadius: FAB / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.action, borderWidth: 1, borderColor: c.selectedBorder, elevation: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fabPressed: { backgroundColor: c.actionPressed },
  menu: { position: "absolute", right: FAB_EDGE, bottom: FAB_EDGE + FAB + 8, width: 248, maxHeight: "70%", borderRadius: shape.menu, padding: 4, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border, elevation: 14 },
  menuScroll: { flexGrow: 0 }, group: { color: c.muted, fontFamily: mono, fontSize: 9, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 3 },
  row: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, borderRadius: 9 }, pressed: { backgroundColor: c.selected },
  rowIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, rowText: { flex: 1, minWidth: 0 }, rowLabel: { color: c.text, fontSize: 13, fontWeight: "600" }, rowHint: { color: c.muted, fontSize: 11 },
  notice: { color: "#ffa8a8", fontSize: 12, padding: 8 },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }, dialog: { maxHeight: "86%", padding: 14, borderRadius: shape.dialog, backgroundColor: c.raised, gap: 10 }, head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, dialogTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 38, borderRadius: 20, backgroundColor: c.panel, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line }, searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 5 },
  list: { flexGrow: 0 }, target: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.line }, targetBody: { flex: 1, minWidth: 0 }, targetTitle: { color: c.text, fontSize: 13.5, fontWeight: "600" }, empty: { color: c.muted, fontSize: 12, paddingVertical: 12 },
})
