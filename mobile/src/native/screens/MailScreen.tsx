import { useEffect, useState } from "react"
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { displayName, type MailMessage, type MailSummary } from "../../lib/shared.ts"
import { fetchMailFolders, fetchMailMessage, fetchMailPage, type MailFolders, type MailResult } from "../../lib/mail-client.ts"
import { mono } from "../../theme.ts"
import { Tabs } from "../kit/Tabs.tsx"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import type { ScreenProps } from "../nav/screens.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { Icon } from "../ui.tsx"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { SmallButton } from "./learning/LearningControls.tsx"

type Page = Awaited<ReturnType<typeof fetchMailPage>>
const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { month: "short", day: "numeric" }) }

/** Native Mail uses the same server mailbox as the Mac app; no message content is stored on the phone. */
export function MailScreen({ onOpenSettings, onUseWeb }: ScreenProps) {
  const { address } = useWorkspace()
  const [folders, setFolders] = useState<MailResult<MailFolders> | null>(null)
  const [folder, setFolder] = useState("INBOX")
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [list, setList] = useState<Page | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [message, setMessage] = useState<MailResult<MailMessage> | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!address) return
    let active = true
    void fetchMailFolders(address).then(result => {
      if (!active) return
      setFolders(result)
      if (!result.ok) setRefreshing(false)
      if (result.ok && !result.value.folders.some(f => f.path === folder)) setFolder(result.value.folders.find(f => f.specialUse === "\\Inbox")?.path ?? result.value.folders[0]?.path ?? "INBOX")
    })
    return () => { active = false }
  }, [address, refreshKey])

  useEffect(() => {
    if (!address || !folders?.ok) return
    let active = true
    setList(null)
    void fetchMailPage(address, folder, page, query).then(result => { if (active) { setList(result); setRefreshing(false) } })
    return () => { active = false }
  }, [address, folders?.ok, folder, page, query, refreshKey])

  useEffect(() => {
    if (!address || open === null) return
    let active = true
    setMessage(null)
    void fetchMailMessage(address, folder, open).then(result => { if (active) setMessage(result) })
    return () => { active = false }
  }, [address, folder, open, refreshKey])

  useEffect(() => {
    if (open === null) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setOpen(null); return true })
    return () => sub.remove()
  }, [open])

  const switchFolder = (path: string) => { setFolder(path); setPage(0); setSelected(null); setOpen(null) }
  const search = () => { setQuery(draft.trim()); setPage(0); setSelected(null); setOpen(null) }
  const refresh = () => { setRefreshing(true); setRefreshKey(n => n + 1) }
  const folderItems = folders?.ok ? folders.value.folders.map(f => ({ key: f.path, label: f.name, count: f.unread || undefined })) : []
  const currentFolder = folders?.ok ? folders.value.folders.find(f => f.path === folder) : undefined
  const rows = list?.ok ? list.value.messages : []

  return <WorkspacePage page="Mail" onOpenSettings={onOpenSettings} onRefresh={refresh} refreshing={refreshing}
    action={onUseWeb ? <SmallButton label="Web" onPress={() => onUseWeb("/mail")} /> : undefined}>
    {!address ? <Text style={s.empty}>Set the Blackwall server address under Settings to see mail.</Text> : null}
    {folders && !folders.ok ? <View style={s.status}><Text style={s.error}>{folders.message}</Text>{folders.kind === "not-connected" && onUseWeb ? <SmallButton label="Connect Bridge" onPress={() => onUseWeb("/settings/connections")} /> : null}</View> : null}
    {!folders && address ? <Text style={s.empty}>Loading mail folders…</Text> : null}
    {folders?.ok ? <>
      <Tabs items={folderItems} value={folder} onChange={switchFolder} label="Mail folders" scrollable />
      {open === null ? <>
        <View style={s.search}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={search} returnKeyType="search" placeholder="Search this folder" placeholderTextColor={c.muted} style={s.input} accessibilityLabel="Search this mail folder" /><SmallButton label="Search" onPress={search} />{query ? <SmallButton label="Clear" onPress={() => { setDraft(""); setQuery(""); setPage(0) }} /> : null}</View>
        <WorkspaceSection title={query ? `Results in ${currentFolder?.name ?? folder}` : currentFolder?.name ?? folder} icon="mail-outline" count={list?.ok ? String(list.value.total) : undefined} flush>
          {!list ? <Text style={s.empty}>Loading messages…</Text> : !list.ok ? <Text style={s.error}>{list.message}</Text> : !rows.length ? <Text style={s.empty}>{query ? "No matching messages." : "This folder is empty."}</Text> : rows.map(row => <MessageRow key={row.uid} row={row} selected={selected === row.uid} onPress={() => selected === row.uid ? setOpen(row.uid) : setSelected(row.uid)} onOpen={() => setOpen(row.uid)} />)}
        </WorkspaceSection>
        {list?.ok && list.value.total > list.value.pageSize ? <View style={s.paging}>{page > 0 ? <SmallButton label="Previous" onPress={() => setPage(n => n - 1)} /> : <View />}<Text style={s.meta}>Page {page + 1} of {Math.ceil(list.value.total / list.value.pageSize)}</Text>{(page + 1) * list.value.pageSize < list.value.total ? <SmallButton label="Next" onPress={() => setPage(n => n + 1)} /> : <View />}</View> : null}
      </> : <>
        <SmallButton label="← Messages" onPress={() => setOpen(null)} />
        {!message ? <Text style={s.empty}>Opening message…</Text> : !message.ok ? <Text style={s.error}>{message.message}</Text> : <Reader message={message.value} onUseWeb={onUseWeb} />}
      </>}
    </> : null}
  </WorkspacePage>
}

function MessageRow({ row, selected, onPress, onOpen }: { row: MailSummary; selected: boolean; onPress: () => void; onOpen: () => void }) {
  return <View style={[selectedItem.item, selected && selectedItem.itemOn]}>
    <Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${row.unread ? "Unread, " : ""}${displayName(row.from)}, ${row.subject}`}>
      {row.unread ? <View style={s.unread} /> : <View style={s.spacer} />}
      <View style={s.rowBody}><View style={s.line}><Text style={[s.sender, row.unread && s.bold]} numberOfLines={1}>{displayName(row.from)}</Text><Text style={s.date}>{when(row.date)}</Text></View><Text style={[s.subject, row.unread && s.bold]} numberOfLines={1}>{row.subject}</Text><Text style={s.snippet} numberOfLines={1}>{row.snippet || " "}</Text></View>
      {row.starred ? <Icon name="star" size={13} tint={c.amber} /> : null}{row.hasAttachments ? <Icon name="attach" size={13} tint={c.muted} /> : null}
    </Pressable>
    {selected ? <View style={selectedItem.preview}><Text style={s.meta} numberOfLines={3}>{row.snippet || "No preview available."}</Text><Pressable onPress={onOpen} style={selectedItem.action} accessibilityRole="button"><Icon name="open-outline" size={13} tint={c.accent} /><Text style={selectedItem.actionText}>Open</Text></Pressable></View> : null}
  </View>
}

function Reader({ message, onUseWeb }: { message: MailMessage; onUseWeb?: ScreenProps["onUseWeb"] }) {
  const body = message.text.slice(0, 200_000)
  return <WorkspaceSection title={message.subject} icon="mail-open-outline">
    <Text style={s.sender}>{message.from}</Text><Text style={s.meta}>To: {message.to}</Text>{message.cc ? <Text style={s.meta}>Cc: {message.cc}</Text> : null}<Text style={s.meta}>{new Date(message.date).toLocaleString()}</Text>
    <View style={s.body}><Text style={s.bodyText} selectable>{body || "This message has no plain-text version."}</Text></View>
    {message.text.length > body.length ? <Text style={s.meta}>Showing the first 200,000 characters. Open Web view for the rest.</Text> : null}
    {message.attachments.length ? <View style={s.attachments}><Text style={s.heading}>Attachments</Text>{message.attachments.map(a => <Text key={a.index} style={s.meta}>📎 {a.name}</Text>)}<Text style={s.meta}>Open in Web view to preview or save attachments.</Text></View> : null}
    {(message.html && !body || message.text.length > body.length || message.attachments.length > 0) && onUseWeb ? <SmallButton label="Open in Web view" onPress={() => onUseWeb("/mail")} /> : null}
  </WorkspaceSection>
}

const s = StyleSheet.create({
  status: { gap: 8 }, search: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: 10, color: c.text, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line },
  empty: { color: c.muted, fontSize: 12, padding: 10 }, error: { color: c.errorText, fontSize: 12, padding: 10 }, meta: { color: c.muted, fontSize: 11 },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9, paddingVertical: 6 }, unread: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }, spacer: { width: 6 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 }, line: { flexDirection: "row", justifyContent: "space-between", gap: 6 }, sender: { color: c.text2, fontSize: 13, flexShrink: 1 }, bold: { color: c.text, fontWeight: "700" }, date: { color: c.muted, fontSize: 10, fontFamily: mono }, subject: { color: c.text2, fontSize: 12 }, snippet: { color: c.muted, fontSize: 11 },
  paging: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, body: { paddingVertical: 12 }, bodyText: { color: c.text2, fontSize: 13, lineHeight: 20 }, attachments: { borderTopWidth: 1, borderColor: c.line, paddingVertical: 8, gap: 5 }, heading: { color: c.text, fontWeight: "700", fontSize: 12 },
})
