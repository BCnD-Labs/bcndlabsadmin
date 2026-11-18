import { useState } from "react"
import { WebViewLink } from "../kit/WebViewLink.tsx"
import type { ScreenProps } from "../nav/screens.tsx"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { A11Y_KINDS, auditSite } from "../../../../blackwall-admin/shared/site-a11y.ts"
import { siteOrigin } from "../../../../blackwall-admin/shared/sitebuilder.ts"
import type { Collections } from "../../lib/shared.ts"
import { useWorkspace } from "../data/WorkspaceProvider.tsx"
import { plannerColor as c } from "../planner-theme.ts"
import { selectedItem } from "../selected-item.ts"
import { WorkspacePage, WorkspaceSection } from "../WorkspacePage.tsx"
import { Icon } from "../ui.tsx"
import { kit } from "../kit/tokens.ts"
import { DraftEditor } from "./DraftEditor.tsx"
import { PagesmithPageEditor } from "./PagesmithPageEditor.tsx"
import { publishPagesmithSite, type PublishResult } from "./pagesmith-publish.ts"
import { SiteEditor } from "./SiteEditor.tsx"

type Site = Collections["sites"][number]
type Draft = Collections["drafts"][number]

/** A live CMS overview; pages and drafts come from the same workspace as the web view. */
export function WebsiteScreen({ onOpenSettings, onUseWeb }: ScreenProps) {
  const { data, address, status, message, pending, mutate, refreshing, refresh } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const [pageOpen, setPageOpen] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ value: Draft | "new"; siteId?: string } | null>(null)
  const [siteEditor, setSiteEditor] = useState<Site | "new" | null>(null)
  const [notice, setNotice] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState<Record<string, PublishResult>>({})
  const pageEditor = data?.pages.find(page => page.id === pageOpen)
  const pageSite = data?.sites.find(site => site.id === pageEditor?.siteId)
  async function publish(site: Site) {
    if (status !== "ok" || pending || publishing) return
    setPublishing(true); setNotice("")
    try {
      const result = await publishPagesmithSite(address, site.id)
      setPublished(current => ({ ...current, [site.id]: result }))
      const ok = await mutate(["sites"], current => ({ ...current, sites: current.sites.map(item => item.id === site.id ? { ...item, publishedAt: new Date().toISOString(), publishedSha: result.sha } : item) }))
      setNotice(ok ? `Published ${result.files} files to ${result.repo}${result.removed ? `; removed ${result.removed} old files` : ""}.` : `Published ${result.files} files, but the date could not be saved in the workspace.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : "Publishing failed.") }
    finally { setPublishing(false) }
  }
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
  return <WorkspacePage page="Website" onOpenSettings={onOpenSettings} onRefresh={() => void refresh()} refreshing={refreshing}>
    {notice ? <Text style={s.error}>{notice}</Text> : null}
    {data ? <>
      <Text style={s.meta}>{data.sites.length} {data.sites.length === 1 ? "site" : "sites"} · {data.pages.length} {data.pages.length === 1 ? "page" : "pages"} · {data.drafts.length} {data.drafts.length === 1 ? "draft" : "drafts"}</Text>
      <WorkspaceSection title="Sites" icon="globe-outline" tint={kit.hue.website} count={String(data.sites.length)}>
        {data.sites.map(site => {
          const pages = data.pages.filter(p => p.siteId === site.id).sort((a, b) => a.order - b.order)
          const drafts = data.drafts.filter(d => d.siteId === site.id && d.kind === "post")
          const expanded = open === site.id
          const url = siteOrigin(site.domain)
          const report = expanded ? auditSite(site, data.pages, data.assets, data.drafts) : null
          return <View key={site.id} style={[selectedItem.item, expanded && selectedItem.itemOn, expanded && s.siteSelected]}>
            <Pressable onPress={() => setOpen(expanded ? null : site.id)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={site.name + ", " + pages.length + " pages"}>
              <View style={s.siteMark}><Icon name="globe-outline" size={17} tint={kit.hue.website} /></View><View style={s.flex}><Text style={s.title} numberOfLines={1}>{site.name}</Text><Text style={s.meta} numberOfLines={1}>{site.domain || "No domain"} · {pages.length} pages · {drafts.length} posts</Text></View><Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} tint={c.muted} />
            </Pressable>
            {expanded ? <View style={selectedItem.preview}>
              <View style={s.summary}><Text style={s.meta}>{site.publishedAt ? "Published " + site.publishedAt.slice(0, 10) : "Not published yet"}{published[site.id] ? ` · ${published[site.id].files} files committed` : ""}</Text>{url && site.publishedAt ? <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={selectedItem.action}><Text style={selectedItem.actionText}>Open site</Text><Icon name="open-outline" size={13} tint={c.accent} /></Pressable> : null}</View>
              <Text style={s.groupTitle}>Pages</Text>
              {pages.map(page => <Pressable key={page.id} onPress={() => setPageOpen(page.id)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${page.title}`}><Icon name="document-outline" size={15} tint={kit.hue.website} /><Text style={s.subTitle} numberOfLines={1}>{page.title}</Text><Text style={s.meta}>/{page.slug}</Text></Pressable>)}
              {!pages.length ? <WebViewLink text="No pages yet." action="Create in Web view" path="/cms/pages" onUseWeb={onUseWeb} /> : null}
              <Text style={s.groupTitle}>Posts</Text>
              {drafts.map(draft => <Pressable key={draft.id} onPress={() => edit(draft)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${draft.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{draft.title}</Text><Text style={s.meta}>{draft.status}</Text></Pressable>)}
              {!drafts.length ? <Text style={s.empty}>No posts for this site yet.</Text> : null}
              <View style={s.actions}><Pressable onPress={() => edit("new", site.id)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>+ New post</Text></Pressable><Pressable onPress={() => editSite(site)} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>Look & settings</Text></Pressable></View>
              <Text style={s.groupTitle}>Accessibility</Text>
              <View style={s.counts}>{A11Y_KINDS.map(kind => <View key={kind} style={s.count}><Text style={s.countNumber}>{report?.counts[kind] ?? 0}</Text><Text style={s.meta}>{kind}</Text></View>)}</View>
              <Text style={s.meta}>Custom HTML and CSS need a live-site accessibility review.</Text>
              <Text style={s.groupTitle}>Publish</Text>
              <Pressable onPress={() => void publish(site)} disabled={status !== "ok" || pending || publishing} style={[s.publish, (status !== "ok" || pending || publishing) && s.disabled]} accessibilityRole="button" accessibilityLabel={`Publish ${site.name}`}><Text style={s.publishText}>{publishing ? "Publishing…" : "Publish"}</Text></Pressable>
              {pending ? <Text style={s.meta}>Waiting for workspace edits to save.</Text> : status !== "ok" ? <Text style={s.meta}>Connect and sync to publish.</Text> : null}
            </View> : null}
          </View>
        })}
        {!data.sites.length ? <Pressable onPress={() => editSite("new")} style={selectedItem.action} accessibilityRole="button"><Text style={selectedItem.actionText}>+ Create a site</Text></Pressable> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Other website tools" icon="grid-outline">
        <View style={s.toolRow}><Text style={s.subTitle}>Forms</Text><WebViewLink text={`${data.forms.length} saved ·`} action="Inbox" path="/cms/pages?panel=forms" onUseWeb={onUseWeb} /></View>
        <View style={s.toolRow}><Text style={s.subTitle}>Media</Text><WebViewLink action="Open" path="/cms/pages?panel=files" onUseWeb={onUseWeb} /></View>
        <View style={s.toolRow}><Text style={s.subTitle}>Traffic</Text><WebViewLink action="Open" path="/analytics" onUseWeb={onUseWeb} /></View>
        <Text style={s.meta}>These open in Web view.</Text>
      </WorkspaceSection>
      {data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).length ? <WorkspaceSection title="Unassigned drafts" icon="create-outline" tint={c.amber}>{data.drafts.filter(d => !d.siteId || !data.sites.some(site => site.id === d.siteId)).map(d => <Pressable key={d.id} onPress={() => edit(d)} style={s.subrow} accessibilityRole="button" accessibilityLabel={`Edit ${d.title}`}><Icon name="create-outline" size={15} tint={c.amber} /><Text style={s.subTitle} numberOfLines={1}>{d.title}</Text><Text style={s.meta}>{d.status}</Text></Pressable>)}</WorkspaceSection> : null}
    </> : <Text style={s.empty}>{status === "signed-out" ? "Sign in under Settings to see your sites." : message ?? "Loading your workspace…"}</Text>}
    {data && editor ? <DraftEditor key={editor.value === "new" ? `new-${editor.siteId ?? "none"}` : editor.value.id} value={editor.value} siteId={editor.siteId} data={data} onClose={() => setEditor(null)} /> : null}
    {siteEditor ? <SiteEditor key={siteEditor === "new" ? "new" : siteEditor.id} value={siteEditor} onClose={() => setSiteEditor(null)} /> : null}
    {data && pageEditor && pageSite ? <PagesmithPageEditor key={pageEditor.id} data={data} site={pageSite} page={pageEditor} onClose={() => setPageOpen(null)} /> : null}
  </WorkspacePage>
}

const s = StyleSheet.create({
  error: { color: "#ffa8a8", fontSize: 12 }, meta: { color: c.muted, fontSize: 11 }, row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9 }, siteMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#4b3025", alignItems: "center", justifyContent: "center" }, flex: { flex: 1, gap: 3 }, title: { color: c.text, fontSize: 14, fontWeight: "600" }, summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }, subrow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8 }, toolRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, subTitle: { color: c.text2, fontSize: 12, flex: 1 }, empty: { color: kit.hue.website, fontSize: 12, paddingVertical: 9 }, siteSelected: { backgroundColor: "#3b302e", borderLeftColor: kit.hue.website }, groupTitle: { color: kit.hue.website, fontSize: 11, fontWeight: "700", textTransform: "uppercase", paddingTop: 5 }, actions: { flexDirection: "row", gap: 7, flexWrap: "wrap" }, counts: { flexDirection: "row", gap: 4 }, count: { flex: 1, alignItems: "center", backgroundColor: c.panel, paddingVertical: 7, borderRadius: 8 }, countNumber: { color: c.text, fontSize: 16, fontWeight: "700" }, publish: { alignSelf: "flex-start", minHeight: 34, justifyContent: "center", backgroundColor: c.action, borderRadius: 17, paddingHorizontal: 14 }, publishText: { color: "#fff", fontSize: 12, fontWeight: "700" }, disabled: { opacity: 0.45 },
})

