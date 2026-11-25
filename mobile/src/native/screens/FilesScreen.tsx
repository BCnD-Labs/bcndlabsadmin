import { useCallback, useEffect, useState } from "react"
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { canEditFile, formatSize, isOffice, parentOf, type EditingInfo, type FolderListing, type StorageEntry, type StorageInfo } from "../../lib/shared.ts"
import { crumbs, fetchEditingInfo, fetchFolder, fetchStorageInfo, fetchText, fileAction, nextcloudLink, quotaLine, viewText } from "../../lib/storage-client.ts"
import { mono } from "../../theme.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import type { ScreenProps } from "../nav/screens.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { Icon, type IconName } from "../ui.tsx"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { DocEditor, NewDocument, type EditTarget } from "./DocEditor.tsx"

type Load<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "error"; message: string; notConnected?: boolean }
type Viewer = { entry: StorageEntry; load: Load<string> }

/**
 * Files: your Nextcloud, browsed through the Blackwall server. Folders open, text files show in a viewer, office
 * files edit in Nextcloud's office editor (Collabora) when it is set up, other files open in Nextcloud in the
 * browser. Uploads, renames and deletes stay in Web view.
 */
export function FilesScreen({ onOpenSettings, onUseWeb, focused = true }: ScreenProps) {
  const { address } = useWorkspace()
  const [info, setInfo] = useState<Load<StorageInfo>>({ state: "loading" })
  const [path, setPath] = useState("/")
  const [listing, setListing] = useState<Load<FolderListing>>({ state: "loading" })
  const [sel, setSel] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState<EditingInfo | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (dir: string) => {
    if (!address) return
    setListing({ state: "loading" })
    const i = await fetchStorageInfo(address)
    if (!i.ok) { setInfo({ state: "error", message: i.message }); setListing({ state: "error", message: i.message }); return }
    setInfo({ state: "ok", value: i.value })
    if (!i.value.connected) { setListing({ state: "error", message: "Nextcloud isn't connected. Connect it in Web view under Settings → Connections.", notConnected: true }); return }
    const [r, e] = await Promise.all([fetchFolder(address, dir), fetchEditingInfo(address)])
    setEditing(e.ok ? e.value : null)
    setListing(r.ok ? { state: "ok", value: r.value } : { state: "error", message: r.message, notConnected: r.kind === "not-connected" })
  }, [address])

  useEffect(() => { if (focused && !editTarget) void load(path) }, [focused, path, load, editTarget])

  const go = (dir: string) => { setSel(null); setViewer(null); setCreating(false); setNotice(null); setPath(dir) }
  const closeEditor = useCallback((message?: string) => { setEditTarget(null); setNotice(message ?? null) }, [])
  const openText = async (entry: StorageEntry) => {
    if (!address) return
    setViewer({ entry, load: { state: "loading" } })
    const r = await fetchText(address, entry.path)
    setViewer((v) => (v?.entry.path === entry.path ? { entry, load: r.ok ? { state: "ok", value: r.value } : { state: "error", message: r.message } } : v))
  }
  const nc = info.state === "ok" ? info.value : null
  const open = (entry: StorageEntry) => {
    const action = fileAction(entry, nc)
    if (action === "folder") go(entry.path)
    else if (action === "text") void openText(entry)
    else if (action === "nextcloud") void Linking.openURL(nextcloudLink(nc, entry)!).catch(() => undefined)
  }

  // Android back: close the viewer, then go up a folder; at the top, let the shell handle it.
  useEffect(() => {
    if (!focused || editTarget || (!viewer && !creating && path === "/")) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (viewer) setViewer(null); else if (creating) setCreating(false); else go(parentOf(path)); return true })
    return () => sub.remove()
  }, [focused, viewer, creating, path, editTarget])

  const refresh = async () => { setRefreshing(true); await load(path); setRefreshing(false) }
  const entries = listing.state === "ok" ? listing.value.entries : []
  const quota = listing.state === "ok" ? quotaLine(listing.value.quota, formatSize) : null
  const folderName = path === "/" ? "Files" : path.split("/").pop() ?? "Files"
  const creators = editing?.available ? editing.creators : []

  if (editTarget && address) return <DocEditor address={address} target={editTarget} onClose={closeEditor} />

  return (
    <WorkspacePage page="Files" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.crumbs}>
        {crumbs(path).map((cr, i, all) => {
          const last = i === all.length - 1
          return <View key={cr.path} style={s.crumbItem}>
            {i ? <Icon name="chevron-forward" size={12} tint={c.muted} /> : null}
            <Pressable onPress={() => go(cr.path)} disabled={last && !viewer} style={[s.crumb, last && s.crumbOn]} accessibilityRole="button" accessibilityLabel={`Go to ${cr.label}`}><Text style={[s.crumbText, last && s.crumbTextOn]} numberOfLines={1}>{cr.label}</Text></Pressable>
          </View>
        })}
      </ScrollView>

      {viewer ? (
        <WorkspaceSection title={viewer.entry.name} icon="document-text-outline" right={<Pressable onPress={() => setViewer(null)} style={s.close} accessibilityRole="button" accessibilityLabel="Close file"><Icon name="close" size={16} tint={c.text2} /></Pressable>}>
          {viewer.load.state === "loading" ? <Text style={s.meta}>Loading…</Text> : viewer.load.state === "error" ? <Text style={s.error}>{viewer.load.message}</Text> : <TextBody text={viewer.load.value} />}
        </WorkspaceSection>
      ) : listing.state === "loading" ? (
        <Text style={s.meta}>Loading {folderName}…</Text>
      ) : listing.state === "error" ? (
        <View style={s.empty}><Text style={s.title}>{listing.notConnected ? "Nextcloud isn't connected" : "Couldn't open this folder"}</Text><Text style={s.meta}>{listing.message}</Text>{listing.notConnected && onUseWeb ? <Pressable onPress={() => onUseWeb("/settings/connections")} style={s.newButton} accessibilityRole="button" accessibilityLabel="Connect Nextcloud in Web view"><Text style={s.newText}>Connect</Text></Pressable> : null}</View>
      ) : (<>
        {notice ? <Text style={s.meta}>{notice}</Text> : null}
        {creating && creators.length ? <NewDocument dir={path} creators={creators} onCreate={(t) => { setCreating(false); setEditTarget(t) }} onCancel={() => setCreating(false)} /> : null}
        <WorkspaceSection title={folderName} icon="folder-open-outline" count={`${entries.length}`} flush right={creators.length && !creating ? <Pressable onPress={() => setCreating(true)} style={s.newButton} accessibilityRole="button" accessibilityLabel="New document"><Icon name="add" size={14} tint={c.accent} /><Text style={s.newText}>New</Text></Pressable> : undefined}>
          {!entries.length ? <Text style={[s.meta, s.pad]}>This folder is empty.</Text> : null}
          {entries.map((e) => <FileRow key={e.path} entry={e} info={nc} editing={editing} selected={sel === e.path} onPress={() => (e.type === "dir" ? go(e.path) : setSel((x) => (x === e.path ? null : e.path)))} onOpen={() => open(e)} onEdit={() => setEditTarget({ name: e.name, path: e.path })} />)}
        </WorkspaceSection>
      </>)}
      {!viewer && quota ? <Text style={s.meta}>{quota} · uploads, renames and deletes are in Web view.</Text> : null}
    </WorkspacePage>
  )
}

function TextBody({ text }: { text: string }) {
  const v = viewText(text)
  return <View style={s.textWrap}>
    {v.cut ? <Text style={s.meta}>Showing the first 200 KB.</Text> : null}
    <ScrollView horizontal><Text style={s.text} selectable>{v.text || " "}</Text></ScrollView>
  </View>
}

function iconFor(e: StorageEntry): IconName {
  if (e.type === "dir") return "folder-outline"
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(e.name)) return "image-outline"
  if (/\.(xlsx?|ods|csv)$/i.test(e.name)) return "grid-outline"
  if (/\.(docx?|odt|rtf|md|txt|pdf)$/i.test(e.name)) return "document-text-outline"
  return "document-outline"
}

function FileRow({ entry, info, editing, selected, onPress, onOpen, onEdit }: { entry: StorageEntry; info: StorageInfo | null; editing: EditingInfo | null; selected: boolean; onPress: () => void; onOpen: () => void; onEdit: () => void }) {
  const action = fileAction(entry, info)
  const editable = entry.type === "file" && canEditFile(editing, entry.name)
  const when = new Date(entry.modified)
  const meta = [entry.type === "dir" ? null : formatSize(entry.size), Number.isNaN(when.getTime()) ? null : when.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")
  return (
    <View style={[selectedItem.item, selected && selectedItem.itemOn]}>
      <Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={`${entry.name}${entry.type === "dir" ? ", folder" : ""}`} accessibilityState={{ selected }}>
        <Icon name={iconFor(entry)} size={17} tint={entry.type === "dir" ? c.accent : c.muted} />
        <View style={s.rowBody}><Text style={s.rowTitle} numberOfLines={1}>{entry.name}</Text>{meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}</View>
        {entry.type === "dir" ? <Icon name="chevron-forward" size={15} tint={c.muted} /> : null}
      </Pressable>
      {selected ? (
        <View style={selectedItem.preview}>
          <View style={s.actions}>
            {editable ? <Pressable onPress={onEdit} style={selectedItem.action} accessibilityRole="button" accessibilityLabel={`Edit ${entry.name}`}><Icon name="create-outline" size={12} tint={c.accent} /><Text style={selectedItem.actionText}>Edit</Text></Pressable> : null}
            {action === "text" || action === "nextcloud" ? (
              <Pressable onPress={onOpen} style={selectedItem.action} accessibilityRole="button" accessibilityLabel={action === "text" ? `View ${entry.name}` : `Open ${entry.name} in Nextcloud`}>
                <Icon name={action === "text" ? "eye-outline" : "open-outline"} size={12} tint={c.accent} /><Text style={selectedItem.actionText}>{action === "text" ? "View" : "Open in Nextcloud"}</Text>
              </Pressable>
            ) : null}
          </View>
          {!editable && isOffice(entry) && editing && !editing.available ? <Text style={s.meta}>Editing isn't set up yet. Nextcloud needs its Office app connected to Collabora.</Text> : null}
          {!editable && action === "none" ? <Text style={s.meta}>This file can't be opened on the phone yet. Use Web view.</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  crumbs: { alignItems: "center", gap: 2 }, crumbItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  crumb: { minHeight: 32, justifyContent: "center", paddingHorizontal: 8, borderRadius: 16, maxWidth: 160 }, crumbOn: { backgroundColor: c.panel },
  crumbText: { color: c.muted, fontSize: 12, fontWeight: "500" }, crumbTextOn: { color: c.text, fontWeight: "600" },
  empty: { gap: 6, paddingVertical: 12 }, title: { color: c.text, fontSize: 15, fontWeight: "700" },
  meta: { color: c.muted, fontSize: 11, lineHeight: 16 }, error: { color: c.errorText, fontSize: 12 }, pad: { padding: 10 },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 4 },
  rowBody: { flex: 1, minWidth: 0 }, rowTitle: { color: c.text, fontSize: 14, fontWeight: "500" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  newButton: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, borderRadius: 14, backgroundColor: c.panel },
  newText: { color: c.accent, fontSize: 12, fontWeight: "600" },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  textWrap: { gap: 6 }, text: { color: c.text2, fontFamily: mono, fontSize: 12, lineHeight: 17 },
})
