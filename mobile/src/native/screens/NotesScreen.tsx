import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { plannerColor as c } from "../planner-theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { WorkspacePage } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { NotesView } from "./planner/notes/NotesView.tsx"
import type { NoteEditor } from "./planner/notes/NoteSheet.tsx"

/** Top-level Notes keeps the Planner's real note rules in a compact native page. */
export function NotesScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const [editor, setEditor] = useState<NoteEditor | null>(null)
  const [notice, setNotice] = useState<string>()
  const blocked = status === "conflict"
  const add = <Pressable onPress={() => data && !blocked ? setEditor({ mode: "create" }) : setNotice(blocked ? "Resolve the sync conflict before editing." : "Load your workspace first.")} style={s.add} accessibilityRole="button" accessibilityLabel="Add note"><Icon name="add" size={20} tint={c.accent} /></Pressable>
  return <WorkspacePage page="Notes" onOpenSettings={onOpenSettings} action={add} onRefresh={() => void refresh()} refreshing={refreshing}>
    {notice ? <Text style={s.error}>{notice}</Text> : null}
    {data ? <NotesView data={data} compact hideAdd controlledEditor={editor} onEditorChange={setEditor} blocked={blocked ? "Choose which edits to keep first." : undefined} /> : <View style={s.empty}><Text style={s.title}>{status === "signed-out" ? "Sign in to use Notes" : "Loading your workspace"}</Text><Text style={s.meta}>{message ?? "Your notes will appear here."}</Text>{status === "signed-out" ? <Pressable onPress={onOpenSettings} accessibilityRole="button"><Text style={s.link}>Sign in</Text></Pressable> : null}</View>}
  </WorkspacePage>
}
const s = StyleSheet.create({ add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, empty: { gap: 8, paddingVertical: 16 }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, meta: { color: c.muted, fontSize: 12 }, link: { color: c.accent, fontSize: 12 }, error: { color: "#ffa8a8", fontSize: 12 } })
