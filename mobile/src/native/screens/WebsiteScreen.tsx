import { shape } from "../../shape.ts"
import { useState } from "react"
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { DraftEditor } from "./DraftEditor.tsx"
import { SiteEditor } from "./SiteEditor.tsx"

type Site = Collections["sites"][number]
type Draft = Collections["drafts"][number]
function publicUrl(site: Site): string | null {
  const domain = site.domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "")
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain) ? "https://" + domain : null
}

/** A live CMS overview; pages and drafts come from the same workspace as the web view. */
export function WebsiteScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, status, message, refreshing, refresh } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const [pageOpen, setPageOpen] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ value: Draft | "new"; siteId?: string } | null>(null)
  const [siteEditor, setSiteEditor] = useState<Site | "new" | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [notice, setNotice] = useState("")
  function edit(value: Draft | "new", siteId?: string) {
    if (status === "conflict") setNotice("Resolve the sync conflict before editing.")
    else if (!data) setNotice("Load your workspace first.")
    else { setNotice(""); setEditor({ value, siteId }) }
  }
  function editSite(value: Site | "new") {
    if (status === "conflict") setNotice("Resolve the sync conflict before editing.")
    else if (!data) setNotice("Load your workspace first.")
    else { setNotice(""); setSiteEditor(value) }
  }
  const add = <Pressable onPress={() => setAddOpen(true)} style={s.add} accessibilityRole="button" accessibilityLabel="Add website item"><Icon name="add" size={20} tint={c.accent} /></Pressable>
  return <WorkspacePage page="Website" onOpenSettings={onOpenSettings} action={add} onRefresh={() => void refresh()} refreshing={refreshing}>
    {notice ? <Text style={s.error}>{notice}</Text> : null}
    {data ? <>
      <Text style={s.meta}>{data.sites.length} {data.sites.length === 1 ? "site" : "sites"} · {data.pages.length} {data.pages.length === 1 ? "page" : "pages"} · {data.drafts.length} {data.drafts.length === 1 ? "draft" : "drafts"}</Text>
      <WorkspaceSection title="Sites" icon="globe-outline" count={String(data.sites.length)}>
        {data.sites.map(site => {
          const pages = data.pages.filter(p => p.siteId === site.id).sort((a, b) => a.order - b.order)
          const drafts = data.drafts.filter(d => d.siteId === site.id)
          const expanded = open === site.id
          const url = publicUrl(site)
          return <View key={site.id} style={[selectedItem.item, expanded && selectedItem.itemOn]}>
            <Pressable onPress={() => setOpen(expanded ? null : site.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={site.name + ", " + pages.length + " pages"}>
              <View style={s.siteMark}><Icon name="globe-outline" size={17} tint={c.blue} /></View><View style={s.flex}><Text style={s.title} numberOfLines={1}>{site.name}</Text><Text style={s.meta} numberOfLines={1}>{site.domain || "No domain"} · {pages.length} pages · {drafts.length} drafts</Text></View><Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
            </Pressable>
            {expanded ? <View style={selectedItem.preview}>
              <View style={s.summary}><Text style={s.meta}>{site.publishedAt ? "Published " + site.publishedAt.slice(0, 10) : "Not published yet"}</Text>{url && site.publishedAt ? <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={selectedItem.action}><Text style={selectedItem.actionText}>Open site</Text><Icon name="open-outline" size={13} tint={c.accent} /></Pressable> : null}</View>
              <Pressable onPress={() => editSite(site)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>Edit site details</Text></Pressable>
              {drafts.map(draft => <Pressable key={draft.id} onPress={() => edit(draft)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${draft.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{draft.title}</Text><Text style={s.meta}>{draft.status}</Text></Pressable>)}
              <Pressable onPress={() => edit("new", site.id)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>+ New draft for this site</Text></Pressable>
              {!pages.length && !drafts.length ? <Text style={s.meta}>No pages or drafts yet.</Text> : null}
            </View> : null}
          </View>
        })}
        {!data.sites.length ? <Pressable onPress={() => editSite("new")} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>+ Create a site</Text></Pressable> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Pagesmith" icon="layers-outline" count={String(data.pages.length)}>
        <Text style={s.meta}>Page layouts and publishing controls are in Web view.</Text>
        {data.pages.slice().sort((a, b) => a.siteId.localeCompare(b.siteId) || a.order - b.order).map(page => {
          const selected = pageOpen === page.id
          const site = data.sites.find(item => item.id === page.siteId)
          return <View key={page.id} style={[selectedItem.item, selected && selectedItem.itemOn]}>
            <Pressable onPress={() => setPageOpen(selected ? null : page.id)} style={s.pageRow} accessibilityRole="button" accessibilityState={{ expanded: selected }} accessibilityLabel={`Preview page ${page.title}`}>
              <Icon name="document-outline" size={16} tint={c.accent} /><View style={s.flex}><Text style={s.title} numberOfLines={1}>{page.title}</Text><Text style={s.meta} numberOfLines={1}>{site?.name ?? "Site removed"} · /{page.slug}</Text></View><Icon name={selected ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
            </Pressable>
            {selected ? <View style={selectedItem.preview}><Text style={s.meta} numberOfLines={2}>{page.description || "No description yet."}</Text><Text style={s.meta}>{page.sections.length} layout {page.sections.length === 1 ? "block" : "blocks"} · {page.inMenu ? "In menu" : "Hidden from menu"}</Text></View> : null}
          </View>
        })}
        {!data.pages.length ? <Text style={s.empty}>No pages yet. Create a page in Web view.</Text> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Other website tools" icon="grid-outline">
        <View style={s.toolRow}><Text style={s.subTitle}>Posts</Text><Text style={s.meta}>{data.drafts.filter(d => d.kind === "post").length} saved</Text></View>
        <View style={s.toolRow}><Text style={s.subTitle}>Forms</Text><Text style={s.meta}>{data.forms.length} saved</Text></View>
        <View style={s.toolRow}><Text style={s.subTitle}>Media</Text><Text style={s.meta}>Web view</Text></View>
        <View style={s.toolRow}><Text style={s.subTitle}>Traffic</Text><Text style={s.meta}>Web view</Text></View>
        <Text style={s.meta}>Form inbox, media uploads, traffic and publishing are available in Web view.</Text>
      </WorkspaceSection>
      {data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).length ? <WorkspaceSection title="Unassigned drafts" icon="create-outline" tint={c.amber}>{data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).map(d => <Pressable key={d.id} onPress={() => edit(d)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${d.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{d.title}</Text><Text style={s.meta}>{d.status}</Text></Pressable>)}</WorkspaceSection> : null}
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see your sites." : message ?? "Loading your workspace…"}</Text>}
    {data && editor ? <DraftEditor key={editor.value === "new" ? `new-${editor.siteId ?? "none"}` : editor.value.id} value={editor.value} siteId={editor.siteId} data={data} onClose={() => setEditor(null)} /> : null}
    {siteEditor ? <SiteEditor key={siteEditor === "new" ? "new" : siteEditor.id} value={siteEditor} onClose={() => setSiteEditor(null)} /> : null}
    <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}><View style={s.menuBackdrop}><Pressable style={s.menuDismiss} onPress={() => setAddOpen(false)} accessibilityLabel="Close add menu" /><View style={s.menu}><Text style={s.menuLabel}>CREATE</Text><Pressable onPress={() => { setAddOpen(false); edit("new", data?.sites.length === 1 ? data.sites[0]?.id : undefined) }} style={s.menuItem} accessibilityRole="button"><Icon name="create-outline" size={17} tint={c.amber} /><Text style={s.menuText}>Draft</Text></Pressable><Pressable onPress={() => { setAddOpen(false); editSite("new") }} style={s.menuItem} accessibilityRole="button"><Icon name="globe-outline" size={17} tint={c.blue} /><Text style={s.menuText}>Site</Text></Pressable></View></View></Modal>
  </WorkspacePage>
}

const s = StyleSheet.create({ add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }, menuDismiss: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, menu: { position: "absolute", top: 89, right: 16, width: 158, padding: 9, borderRadius: shape.menu, backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }, menuLabel: { color: c.muted, fontSize: 10, paddingHorizontal: 7, paddingBottom: 3 }, menuItem: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 7 }, menuText: { color: c.text, fontSize: 13 }, error: { color: "#ffa8a8", fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9 }, siteMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#2196f326", alignItems: "center", justifyContent: "center" }, flex: { flex: 1, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, subrow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8 }, pageRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9 }, toolRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, subTitle: { color: c.text2, fontSize: 12, flex: 1 }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9 } })

