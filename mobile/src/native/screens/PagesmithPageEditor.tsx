import { useMemo, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { WebView as RNWebView } from "react-native-webview"
import { BLOCKS, renderPage } from "../../../../blackwall-admin/shared/sitebuilder.ts"
import { LIBRARY, LIBRARY_GROUPS } from "../../../../blackwall-admin/shared/site-library.ts"
import { findBlock } from "../../../../blackwall-admin/shared/sitebuilder-tree.ts"
import type { Collections } from "../../lib/shared.ts"
import { shape } from "../../shape.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { TextInput } from "../editing/keyboard.tsx"
import { kit } from "../kit/tokens.ts"
import { plannerColor as c } from "../planner-theme.ts"
import { Icon } from "../ui.tsx"
import { addPageBlock, editPageBlock } from "./pagesmith-records.ts"

const WebView = RNWebView<{}>
type Page = Collections["pages"][number]
type Site = Collections["sites"][number]
type Panel = "add" | "fields" | null

const TAP_SCRIPT = `<script>(function(){document.addEventListener('click',function(event){
  var target=event.target instanceof Element?event.target:null;
  var block=target&&target.closest('[data-bw]');
  var insert=target&&target.closest('[data-bw-insert]');
  if(block||insert){event.preventDefault();event.stopPropagation();
    window.ReactNativeWebView.postMessage(JSON.stringify(block?{block:block.getAttribute('data-bw')}:{add:true}));}
  else if(target&&target.closest('a,button,form')){event.preventDefault();event.stopPropagation();}
},true)})();</script>`

export function PagesmithPageEditor({ data, site, page, onClose }: { data: Collections; site: Site; page: Page; onClose: () => void }) {
  const { mutate, status } = useWorkspace()
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const block = selected ? findBlock(page.sections, selected) : undefined
  const definition = block && BLOCKS[block.type]
  const canEdit = status !== "conflict" && !busy
  const html = useMemo(() => renderPage(site, data.pages, page, { preview: true, edit: true, posts: data.drafts, forms: data.forms, assets: data.assets }).replace("</body>", `${TAP_SCRIPT}</body>`), [site, data.pages, page, data.drafts, data.forms, data.assets])
  const source = useMemo(() => ({ html }), [html])

  function select(id: string) {
    const found = findBlock(page.sections, id)
    if (!found) return
    setSelected(id)
    setFields(Object.fromEntries((BLOCKS[found.type]?.edit ?? []).map(field => [field.k, String(found[field.k] ?? "")])))
    setError("")
    setPanel("fields")
  }
  async function save() {
    if (!block || !definition || !canEdit) return
    setBusy(true); setError("")
    const patch = Object.fromEntries((definition.edit ?? []).map(field => [field.k, field.kind === "number" ? Number(fields[field.k]) || "" : fields[field.k] ?? ""]))
    const ok = await mutate(["pages"], current => editPageBlock(current, page.id, block.id, patch))
    setBusy(false)
    if (ok) setPanel(null)
    else setError("Couldn't save this block. Your edits are still here.")
  }
  async function add(libraryId: string) {
    if (!canEdit) return
    setBusy(true); setError("")
    const ok = await mutate(["pages"], current => addPageBlock(current, page.id, selected, libraryId))
    setBusy(false)
    if (ok) { setPanel(null); setSelected(null) }
    else setError("Couldn't add this component. Try again.")
  }
  return <Modal visible animationType="slide" onRequestClose={panel ? () => setPanel(null) : onClose}>
    <View style={s.root}>
      <View style={s.head}><Pressable onPress={onClose} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Close page editor"><Icon name="chevron-back" tint={c.text2} /></Pressable><View style={s.grow}><Text style={s.title} numberOfLines={1}>{page.title}</Text><Text style={s.hint} numberOfLines={1}>{site.name} · /{page.slug}</Text></View><Pressable onPress={() => { setError(""); setPanel("add") }} style={s.addButton} accessibilityRole="button" accessibilityLabel="Add component"><Icon name="add" tint={kit.hue.website} size={19} /><Text style={s.addText}>Add</Text></Pressable></View>
      <Text style={s.instruction}>Tap a component in the preview to edit it.</Text>
      <WebView source={source} style={s.preview} originWhitelist={["about:blank"]} javaScriptEnabled onMessage={event => { try { const value = JSON.parse(event.nativeEvent.data) as { block?: string; add?: boolean }; if (value.block) select(value.block); else if (value.add) setPanel("add") } catch { /* Ignore page messages outside the editor bridge. */ } }} onShouldStartLoadWithRequest={request => request.url === "about:blank"} setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never" />
      {panel ? <View style={s.sheet}>
        <View style={s.sheetHead}><Text style={s.sheetTitle}>{panel === "add" ? "Add component" : definition?.name ?? "Edit component"}</Text><Pressable onPress={() => setPanel(null)} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Close sheet"><Icon name="close" tint={c.text2} size={18} /></Pressable></View>
        {panel === "add" ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>{LIBRARY_GROUPS.map(group => <View key={group} style={s.group}><Text style={s.groupTitle}>{group}</Text>{LIBRARY.filter(item => item.group === group).map(item => <Pressable key={item.id} onPress={() => void add(item.id)} disabled={!canEdit} style={s.libraryItem} accessibilityRole="button" accessibilityLabel={`Add ${item.name}`}><Text style={s.itemTitle}>{item.name}</Text><Text style={s.hint}>{item.about}</Text></Pressable>)}</View>)}</ScrollView> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
          {definition?.edit?.length ? definition.edit.map(field => <View key={field.k} style={s.field}><Text style={s.label}>{field.l}</Text>{field.kind === "select" || field.kind === "form" ? <View style={s.choices}>{(field.kind === "form" ? [{ value: "", label: "None" }, ...data.forms.map(form => ({ value: form.id, label: form.name }))] : field.options ?? []).map(choice => <Pressable key={choice.value} onPress={() => setFields(previous => ({ ...previous, [field.k]: choice.value }))} style={[s.choice, (fields[field.k] || field.options?.[0]?.value || "") === choice.value && s.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: fields[field.k] === choice.value }}><Text style={s.choiceText}>{choice.label}</Text></Pressable>)}</View> : <TextInput value={fields[field.k] ?? ""} onChangeText={value => setFields(previous => ({ ...previous, [field.k]: value }))} style={[s.input, field.kind === "big" && s.bigInput]} multiline={field.kind === "big"} keyboardType={field.kind === "number" ? "numeric" : field.kind === "url" ? "url" : "default"} autoCapitalize={field.kind === "url" ? "none" : "sentences"} accessibilityLabel={field.l} placeholder={field.kind === "asset" ? "Image path (choose media in Web view)" : undefined} placeholderTextColor={c.muted} />}{field.note ? <Text style={s.hint}>{field.note}</Text> : null}</View>) : <Text style={s.hint}>This component has no editable fields on the phone. Tap Add to place content inside it.</Text>}
        </ScrollView>}
        {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        {panel === "fields" && definition?.edit?.length ? <Pressable onPress={() => void save()} disabled={!canEdit} style={[s.save, !canEdit && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{busy ? "Saving…" : "Save component"}</Text></Pressable> : null}
      </View> : null}
    </View>
  </Modal>
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.ground }, head: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: c.panel, borderBottomWidth: 1, borderColor: c.line }, grow: { flex: 1, minWidth: 0 }, iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, hint: { color: c.muted, fontSize: 11, lineHeight: 16 }, addButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, borderRadius: shape.card, backgroundColor: c.raised }, addText: { color: kit.hue.website, fontSize: 12, fontWeight: "700" }, instruction: { paddingHorizontal: 12, paddingVertical: 8, color: c.muted, fontSize: 11 }, preview: { flex: 1, backgroundColor: "#fff" }, sheet: { position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "72%", backgroundColor: c.panel, borderTopLeftRadius: shape.dialog, borderTopRightRadius: shape.dialog, borderWidth: 1, borderColor: c.border, overflow: "hidden" }, sheetHead: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 14, paddingRight: 8, borderBottomWidth: 1, borderColor: c.line }, sheetTitle: { color: c.text, fontSize: 15, fontWeight: "700" }, sheetBody: { padding: 14, paddingBottom: 26, gap: 12 }, group: { gap: 4 }, groupTitle: { color: kit.hue.website, fontSize: 11, fontWeight: "700", textTransform: "uppercase", paddingTop: 8 }, libraryItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: shape.card, backgroundColor: c.raised }, itemTitle: { color: c.text, fontSize: 13, fontWeight: "600" }, field: { gap: 5 }, label: { color: c.text2, fontSize: 12, fontWeight: "600" }, input: { minHeight: 38, paddingHorizontal: 10, paddingVertical: 7, color: c.text, backgroundColor: c.ground, borderWidth: 1, borderColor: c.line, borderRadius: 8, fontSize: 13 }, bigInput: { minHeight: 110, textAlignVertical: "top" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, choice: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.raised }, choiceOn: { backgroundColor: "#563829", borderWidth: 1, borderColor: kit.hue.website }, choiceText: { color: c.text2, fontSize: 12 }, error: { color: "#ffa8a8", fontSize: 12, paddingHorizontal: 14, paddingBottom: 5 }, save: { minHeight: 42, alignItems: "center", justifyContent: "center", margin: 12, borderRadius: 9, backgroundColor: c.action }, saveText: { color: "#fff", fontWeight: "700" }, disabled: { opacity: 0.5 },
})
