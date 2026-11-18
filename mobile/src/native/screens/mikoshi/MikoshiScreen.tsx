import { useEffect, useMemo, useRef, useState } from "react"
import { BackHandler, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { ServiceStatus } from "../../../lib/service-status.ts"
import { useWorkspace } from "../../data/WorkspaceProvider.tsx"
import type { Collections } from "../../../lib/shared.ts"
import { plannerColor as c } from "../../planner-theme.ts"
import { selectedItem } from "../../selected-item.ts"
import type { ScreenProps } from "../../nav/screens.tsx"
import { WorkspacePage, WorkspaceSection } from "../../WorkspacePage.tsx"
import { Icon, type IconName } from "../../ui.tsx"
import { PropChip } from "../../kit/PropChip.tsx"
import { addressLabel, closeTool, groupServices, noTools, openTool, pruneTools, showList, statusSummary, toolTarget, type Tools } from "./mikoshi-rules.ts"
import { ToolWebView, type ToolHandle } from "./ToolWebView.tsx"
import { ServiceEditor } from "./ServiceEditor.tsx"
import { ServiceLogo } from "./ServiceLogo.tsx"
import { useServiceStatus } from "./useServiceStatus.ts"

/** Room kept under an open tool for the floating nav pill, so it never covers the page. */
const PILL_RESERVE = 66
const GROUP_ICON: Record<string, IconName> = { Infrastructure: "server-outline", AI: "sparkles-outline", Media: "film-outline" }
type Service = Collections["services"][number]

/**
 * Mikoshi: your homelab tools. The list is the workspace's own services (the same records as the web launcher)
 * with an up/down dot checked from your server. An https tool opens inside the app under a toolbar: back, the
 * tools you have open to switch between, reload, and the list. Open tools stay loaded in the background. A plain
 * http tool can only be handed to the browser for now.
 */
export function MikoshiScreen({ onOpenSettings, focused = true }: ScreenProps) {
  const { data, address, status, message, refreshing, refresh } = useWorkspace()
  const services = useMemo(() => data?.services ?? [], [data?.services])
  const [tools, setTools] = useState<Tools>(noTools)
  const [sel, setSel] = useState<string | null>(null)
  const [editor, setEditor] = useState<Service | "new" | null>(null)
  const handles = useRef(new Map<string, ToolHandle | null>())
  const [keyboard, setKeyboard] = useState(0)
  const urls = useMemo(() => services.map((s) => s.url), [services])
  const live = useServiceStatus(address, urls, focused && !tools.active)
  const summary = statusSummary(urls, live.byUrl)

  useEffect(() => { setTools((t) => pruneTools(t, new Set(services.map((s) => s.id)))) }, [services])
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0))
    return () => { show.remove(); hide.remove() }
  }, [])
  // Android back: a page back inside the tool first, then out to the list.
  useEffect(() => {
    if (!focused || !tools.active) return
    const active = tools.active
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!handles.current.get(active)?.goBack()) setTools(showList)
      return true
    })
    return () => sub.remove()
  }, [focused, tools.active])

  const openServices = services.filter((s) => tools.open.includes(s.id))
  const act = (id: string) => {
    const svc = services.find((s) => s.id === id)
    if (!svc) return
    if (toolTarget(svc.url).kind === "app") { setSel(null); setTools((t) => openTool(t, id)) }
    else setSel((s) => (s === id ? null : id))
  }
  const active = tools.active

  return (
    <View style={s.fill}>
      <View style={active ? s.hidden : s.fill}>
        <WorkspacePage page="Mikoshi" onOpenSettings={onOpenSettings} onRefresh={() => { void refresh(); void live.check() }} refreshing={refreshing}>
          {!data ? <View style={s.empty}><Text style={s.title}>{status === "signed-out" ? "Sign in to use Mikoshi" : "Loading your workspace"}</Text><Text style={s.meta}>{status === "signed-out" ? "Your tools will appear here after sign-in." : message ?? "Pull down to try again."}</Text></View> : null}
          {data && !services.length ? <View style={s.empty}><Text style={s.title}>No tools yet</Text><Text style={s.meta}>Use the + button to add your first tool.</Text></View> : null}
          {data && services.length ? <Text style={s.meta}>{summaryText(summary, live.checkedAt)}</Text> : null}
          {live.error ? <Text style={s.error}>{live.error}</Text> : null}
          {groupServices(services).map(({ group, items }) => (
            <WorkspaceSection key={group} title={group} icon={GROUP_ICON[group] ?? "apps-outline"} count={`${items.length}`}>
              {items.map((svc) => <ToolRow key={svc.id} address={address} logo={svc.logo} customLogo={svc.customLogo} name={svc.name} description={svc.description} url={svc.url} status={live.byUrl.get(svc.url)} isOpen={tools.open.includes(svc.id)} selected={sel === svc.id} onPress={() => act(svc.id)} onEdit={() => setEditor(svc)} />)}
            </WorkspaceSection>
          ))}
        </WorkspacePage>
        {data && editor ? <ServiceEditor key={editor === "new" ? "new" : editor.id} value={editor} groups={services.map(svc => svc.group)} onClose={() => setEditor(null)} /> : null}
      </View>
      {openServices.length ? (
        <View style={active ? s.fill : s.hidden}>
          <ToolBar
            tools={openServices.map((x) => ({ id: x.id, name: x.name }))}
            active={active}
            onSwitch={(id) => setTools((t) => openTool(t, id))}
            onBack={() => { if (active && !handles.current.get(active)?.goBack()) setTools(showList) }}
            onReload={() => { if (active) handles.current.get(active)?.reload() }}
            onClose={() => { if (active) setTools((t) => closeTool(t, active)) }}
            onList={() => setTools(showList)}
          />
          <View style={[s.stack, { marginBottom: keyboard > 0 ? keyboard : PILL_RESERVE }]}>
            {openServices.map((svc) => <ToolWebView key={svc.id} ref={(h) => { handles.current.set(svc.id, h) }} url={svc.url} name={svc.name} visible={svc.id === active} />)}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function summaryText(x: { up: number; down: number; unchecked: number }, checkedAt?: string): string {
  if (!checkedAt) return "Checking your tools…"
  const at = new Date(checkedAt)
  const time = Number.isNaN(at.getTime()) ? "" : ` · checked ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  return `${x.up} up · ${x.down} down${x.unchecked ? ` · ${x.unchecked} unchecked` : ""}${time}`
}

function ToolRow({ address, logo, customLogo, name, description, url, status, isOpen, selected, onPress, onEdit }: { address: string | null; logo?: string; customLogo?: string; name: string; description: string; url: string; status?: ServiceStatus; isOpen: boolean; selected: boolean; onPress: () => void; onEdit: () => void }) {
  const target = toolTarget(url)
  const label = !status ? "not checked yet" : status.up ? `up${status.ms != null ? `, ${status.ms} milliseconds` : ""}` : "down"
  return (
    <View style={[selectedItem.item, selected && selectedItem.itemOn]}>
      <View style={s.rowWrap}><Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={`${name}, ${label}${isOpen ? ", open" : ""}${target.kind === "app" ? "" : ", opens in the browser"}`}>
        <ServiceLogo address={address} name={name} logo={logo} customLogo={customLogo} />
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={1}>{name}</Text>
          <Text style={s.meta} numberOfLines={1}>{[description, addressLabel(url)].filter(Boolean).join(" · ")}</Text>
        </View>
        {isOpen ? <PropChip kind="tag" value="Open" /> : null}
        {target.kind !== "app" ? <PropChip kind="neutral" value="http" /> : null}
        <View style={[s.dot, { backgroundColor: !status ? c.muted : status.up ? c.green : c.danger }]} />
      </Pressable><Pressable onPress={onEdit} style={s.edit} accessibilityRole="button" accessibilityLabel={`Edit ${name}`}><Icon name="create-outline" size={15} tint={c.muted} /></Pressable></View>
      {selected ? (
        <View style={selectedItem.preview}>
          <Text style={s.detail}>{target.kind === "browser" ? "Plain http:// isn't loaded inside the app yet." : "This isn't a web address. Tap the edit button to fix it."}</Text>
          {target.kind === "browser" ? <Pressable onPress={() => void Linking.openURL(target.url).catch(() => undefined)} style={selectedItem.action} accessibilityRole="button" accessibilityLabel={`Open ${name} in the browser`}><Icon name="open-outline" size={12} tint={c.accent} /><Text style={selectedItem.actionText}>Open in browser</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  )
}

function ToolBar({ tools, active, onSwitch, onBack, onReload, onClose, onList }: { tools: { id: string; name: string }[]; active: string | null; onSwitch: (id: string) => void; onBack: () => void; onReload: () => void; onClose: () => void; onList: () => void }) {
  return (
    <View style={s.bar}>
      <Pressable onPress={onBack} style={s.barButton} accessibilityRole="button" accessibilityLabel="Back"><Icon name="chevron-back" size={19} tint={c.text2} /></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
        {tools.map((t) => {
          const on = t.id === active
          return (
            <View key={t.id} style={[s.chip, on && s.chipOn]}>
              <Pressable onPress={() => onSwitch(t.id)} style={s.chipMain} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Switch to ${t.name}`}><Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{t.name}</Text></Pressable>
              {on ? <Pressable onPress={onClose} style={s.chipClose} accessibilityRole="button" accessibilityLabel={`Close ${t.name}`}><Icon name="close" size={13} tint={c.accent} /></Pressable> : null}
            </View>
          )
        })}
      </ScrollView>
      <Pressable onPress={onReload} style={s.barButton} accessibilityRole="button" accessibilityLabel="Reload"><Icon name="refresh" size={17} tint={c.text2} /></Pressable>
      <Pressable onPress={onList} style={s.barButton} accessibilityRole="button" accessibilityLabel="All tools"><Icon name="grid-outline" size={17} tint={c.text2} /></Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.ground }, hidden: { display: "none" },
  add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line },
  empty: { gap: 8, paddingVertical: 16 }, title: { color: c.text, fontSize: 15, fontWeight: "700" }, meta: { color: c.muted, fontSize: 11, lineHeight: 16 }, error: { color: c.errorText, fontSize: 12 },
  rowWrap: { flexDirection: "row", alignItems: "center" }, row: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 }, edit: { width: 32, height: 32, alignItems: "center", justifyContent: "center" }, rowBody: { flex: 1, minWidth: 0 }, rowTitle: { color: c.text, fontSize: 14, fontWeight: "600" },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 4 },
  detail: { color: c.text2, fontSize: 12, lineHeight: 17 },
  bar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  barButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel },
  chipScroll: { flex: 1 }, chips: { gap: 5, alignItems: "center", paddingHorizontal: 2 },
  chip: { minHeight: 32, flexDirection: "row", alignItems: "center", borderRadius: 16, backgroundColor: c.panel }, chipOn: { backgroundColor: c.selected },
  chipMain: { minHeight: 32, justifyContent: "center", paddingHorizontal: 11, maxWidth: 150 }, chipText: { color: c.text2, fontSize: 12, fontWeight: "500" }, chipTextOn: { color: c.accent, fontWeight: "600" },
  chipClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  stack: { flex: 1 },
})
