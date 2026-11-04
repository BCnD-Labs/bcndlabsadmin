import { useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { DraftEditor } from "./DraftEditor.tsx"

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
  const [editor, setEditor] = useState<{ value: Draft | "new"; siteId?: string } | null>(null)
  const [notice, setNotice] = useState("")
  function edit(value: Draft | "new", siteId?: string) {
    if (status === "conflict") setNotice("Resolve the sync conflict before editing.")
    else if (!data) setNotice("Load your workspace first.")
    else { setNotice(""); setEditor({ value, siteId }) }
  }
  const add = <Pressable onPress={() => edit("new", data?.sites.length === 1 ? data.sites[0]?.id : undefined)} style={s.add} accessibilityRole="button" accessibilityLabel="New draft"><Icon name="add" size={20} tint={c.accent} /></Pressable>
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
          return <View key={site.id} style={s.site}>
            <Pressable onPress={() => setOpen(expanded ? null : site.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={site.name + ", " + pages.length + " pages"}>
              <View style={s.siteMark}><Icon name="globe-outline" size={17} tint={c.blue} /></View><View style={s.flex}><Text style={s.title} numberOfLines={1}>{site.name}</Text><Text style={s.meta} numberOfLines={1}>{site.domain || "No domain"} · {pages.length} pages · {drafts.length} drafts</Text></View><Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
            </Pressable>
            {expanded ? <View style={s.detail}>
              <View style={s.summary}><Text style={s.meta}>{site.publishedAt ? "Published " + site.publishedAt.slice(0, 10) : "Not published yet"}</Text>{url && site.publishedAt ? <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={s.open}><Text style={s.openText}>Open site</Text><Icon name="open-outline" size={13} tint={c.accent} /></Pressable> : null}</View>
              {pages.map(page => <View key={page.id} style={s.subrow}><Icon name="document-outline" size={15} tint={c.muted} /><Text style={s.subTitle} numberOfLines={1}>{page.title}</Text><Text style={s.meta}>/{page.slug}</Text></View>)}
              {drafts.map(draft => <Pressable key={draft.id} onPress={() => edit(draft)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${draft.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{draft.title}</Text><Text style={s.meta}>{draft.status}</Text></Pressable>)}
              <Pressable onPress={() => edit("new", site.id)} style={s.newDraft} accessibilityRole="button"><Text style={s.newDraftText}>+ New draft for this site</Text></Pressable>
              {!pages.length && !drafts.length ? <Text style={s.meta}>No pages or drafts yet.</Text> : null}
            </View> : null}
          </View>
        })}
        {!data.sites.length ? <Text style={s.empty}>No sites yet. Create a site in the web view.</Text> : null}
      </WorkspaceSection>
      {data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).length ? <WorkspaceSection title="Unassigned drafts" icon="create-outline" tint={c.amber}>{data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).map(d => <Pressable key={d.id} onPress={() => edit(d)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${d.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{d.title}</Text><Text style={s.meta}>{d.status}</Text></Pressable>)}</WorkspaceSection> : null}
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see your sites." : message ?? "Loading your workspace…"}</Text>}
    {data && editor ? <DraftEditor key={editor.value === "new" ? `new-${editor.siteId ?? "none"}` : editor.value.id} value={editor.value} siteId={editor.siteId} data={data} onClose={() => setEditor(null)} /> : null}
  </WorkspacePage>
}

const s = StyleSheet.create({ add: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.panel, borderWidth: 1, borderColor: c.line }, error: { color: "#ffa8a8", fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, site: { borderBottomWidth: 1, borderColor: c.line }, row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9 }, siteMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#2196f326", alignItems: "center", justifyContent: "center" }, flex: { flex: 1, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, detail: { paddingLeft: 39, paddingBottom: 8, gap: 7 }, summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, open: { flexDirection: "row", alignItems: "center", gap: 4 }, openText: { color: c.accent, fontSize: 11, fontWeight: "600" }, subrow: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 8 }, subTitle: { color: c.text2, fontSize: 12, flex: 1 }, newDraft: { minHeight: 27, alignSelf: "flex-start", justifyContent: "center" }, newDraftText: { color: c.accent, fontSize: 11, fontWeight: "600" }, empty: { color: c.muted, fontSize: 12, paddingVertical: 9 } })
