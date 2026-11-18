import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, BackHandler, Keyboard, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { EditingCreator } from "../../lib/shared.ts"
import { createForEditing, editorTarget, newDocumentPath, openForEditing } from "../../lib/storage-client.ts"
import { Tabs } from "../kit/Tabs.tsx"
import { PILL_RESERVE } from "../nav/layout.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { shape } from "../../shape.ts"
import { Icon } from "../ui.tsx"
import { WorkspaceSection } from "../WorkspacePage.tsx"
import { ToolWebView, type ToolHandle } from "./mikoshi/ToolWebView.tsx"

/** A document to edit: an existing file, or a new one the editor creates first. */
export type EditTarget = { name: string; path: string; create?: string }

type State = { kind: "loading" } | { kind: "ready"; url: string; attempt: number } | { kind: "error"; message: string }

/**
 * Nextcloud's office editor (Collabora) for one document. The server hands out a one-time editor address; it opens
 * inside the app (https) locked to its own address, or in the browser for plain http. Collabora saves as you type,
 * so Done just closes it. Reload asks for a fresh address, since each one only works once.
 */
export function DocEditor({ address, target, onClose }: { address: string; target: EditTarget; onClose: (notice?: string) => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [keyboard, setKeyboard] = useState(0)
  const path = useRef(target.path)
  const created = useRef(!target.create)
  const web = useRef<ToolHandle>(null)
  // Kept in a ref so a new onClose from the parent never re-requests a (one-time) editor address.
  const close = useRef(onClose)
  const attempts = useRef(0)
  close.current = onClose

  const fetchUrl = useCallback(async () => {
    setState({ kind: "loading" })
    const r = created.current ? await openForEditing(address, path.current) : await createForEditing(address, path.current, target.create!)
    if (!r.ok) return setState({ kind: "error", message: r.message })
    const url = typeof r.value === "string" ? r.value : r.value.url
    if (typeof r.value !== "string") { created.current = true; path.current = r.value.path }
    if (editorTarget(url) === "browser") {
      void Linking.openURL(url).catch(() => undefined)
      return close.current("The editor opened in your browser.")
    }
    attempts.current += 1
    setState({ kind: "ready", url, attempt: attempts.current })
  }, [address, target.create])

  useEffect(() => { void fetchUrl() }, [fetchUrl])
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0))
    const back = BackHandler.addEventListener("hardwareBackPress", () => { close.current(); return true })
    return () => { show.remove(); hide.remove(); back.remove() }
  }, [])

  return (
    <View style={s.fill}>
      <View style={s.bar}>
        <Pressable onPress={() => onClose()} style={s.done} accessibilityRole="button" accessibilityLabel="Done editing"><Icon name="checkmark" size={16} tint={c.accent} /><Text style={s.doneText}>Done</Text></Pressable>
        <Text style={s.name} numberOfLines={1}>{path.current.split("/").pop() || target.name}</Text>
        <Pressable onPress={() => void fetchUrl()} disabled={state.kind === "loading"} style={s.barButton} accessibilityRole="button" accessibilityLabel="Reload editor"><Icon name="refresh" size={17} tint={c.text2} /></Pressable>
      </View>
      <View style={[s.fill, { marginBottom: keyboard > 0 ? keyboard : PILL_RESERVE }]}>
        {state.kind === "ready" ? <ToolWebView key={state.attempt} ref={web} url={state.url} name="The editor" visible onRetry={() => void fetchUrl()} /> : null}
        {state.kind === "loading" ? <View style={s.center}><ActivityIndicator size="large" color={c.muted} accessibilityLabel="Opening the editor" /></View> : null}
        {state.kind === "error" ? (
          <View style={s.center}><View style={s.card}>
            <Text style={s.title} accessibilityRole="header">Couldn't open the editor</Text>
            <Text style={s.detail}>{state.message}</Text>
            <View style={s.row}>
              <Pressable onPress={() => void fetchUrl()} style={selectedItem.action} accessibilityRole="button" accessibilityLabel="Try again"><Text style={selectedItem.actionText}>Try again</Text></Pressable>
              <Pressable onPress={() => onClose()} style={selectedItem.action} accessibilityRole="button" accessibilityLabel="Back to files"><Text style={selectedItem.actionText}>Back to files</Text></Pressable>
            </View>
          </View></View>
        ) : null}
      </View>
    </View>
  )
}

/** The New document form: pick a kind Nextcloud can create, name it, and it opens in the editor. */
export function NewDocument({ dir, creators, onCreate, onCancel }: { dir: string; creators: readonly EditingCreator[]; onCreate: (target: EditTarget) => void; onCancel: () => void }) {
  const [kind, setKind] = useState(creators[0]?.id ?? "")
  const [name, setName] = useState("")
  const creator = creators.find((x) => x.id === kind) ?? creators[0]
  const path = creator ? newDocumentPath(dir, name, creator.extension) : null
  return (
    <WorkspaceSection title="New document" icon="add-circle-outline">
      <View style={s.form}>
        <Tabs items={creators.map((x) => ({ key: x.id, label: `${x.name.replace(/^new\s+/i, "")} .${x.extension}` }))} value={creator?.id ?? null} onChange={setKind} label="Kind of document" />
        <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={c.muted} style={s.input} accessibilityLabel="Document name" autoCapitalize="sentences" returnKeyType="done" />
        {name.trim() && !path ? <Text style={s.error}>Use a name without slashes.</Text> : null}
        <View style={s.row}>
          <Pressable onPress={() => creator && path && onCreate({ name: path.split("/").pop()!, path, create: creator.extension })} disabled={!path} style={[s.primary, !path && s.disabled]} accessibilityRole="button" accessibilityLabel="Create and open"><Text style={s.primaryText}>Create</Text></Pressable>
          <Pressable onPress={onCancel} style={selectedItem.action} accessibilityRole="button" accessibilityLabel="Cancel"><Text style={selectedItem.actionText}>Cancel</Text></Pressable>
        </View>
      </View>
    </WorkspaceSection>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  done: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.selected },
  doneText: { color: c.accent, fontSize: 12, fontWeight: "600" },
  name: { flex: 1, color: c.text, fontSize: 13, fontWeight: "600" },
  barButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: c.ground },
  card: { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: shape.card, padding: 16, gap: 8, maxWidth: 480, width: "100%" },
  title: { color: c.text, fontSize: 16, fontWeight: "700" }, detail: { color: c.text2, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  form: { gap: 10 },
  input: { minHeight: 40, borderRadius: shape.card, borderWidth: 1, borderColor: c.line, backgroundColor: c.ground, color: c.text, paddingHorizontal: 10, fontSize: 14 },
  error: { color: "#ffa8a8", fontSize: 12 },
  primary: { minHeight: 32, justifyContent: "center", paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.action }, primaryText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  disabled: { opacity: 0.45 },
})
