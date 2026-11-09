import { Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { OptionSelect } from "@/components/forms/fields"
import { cmsPagesHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { useConnections } from "@/services/connector"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { SiteSwitcher } from "./site-switcher"
import { PublishBar } from "./pages-tab"
import { SiteTabs } from "./site-tabs"
import { useCurrentSite } from "./use-cms"

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1"><Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{label}</Label>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-80">{children}</div>
    </div>
  )
}

export function CmsSiteSettingsPage() {
  const site = useCurrentSite()
  const { update, remove } = useWorkspace.getState()
  const { list, refresh } = useConnections()
  const navigate = useNavigate()
  useEffect(() => { void refresh() }, [refresh])
  if (!site) return <><PageHeader title="Website" /><Panel category="website" title="Site settings"><EmptyState title="No site yet" action={<Button onClick={() => useUi.getState().openForm({ kind: "site" })}><Plus /> New site</Button>} /></Panel></>
  const set = (patch: Partial<Site>) => update("sites", site.id, patch)
  const repos = list.filter((c) => c.provider === "website")

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} />
      <WorkspaceGrid>
        <GridItem span="full"><SiteTabs current="settings" /></GridItem>
        <GridItem span="full"><PublishBar site={site} /></GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Site" bodyClassName="divide-y divide-line-soft">
            <Row label="Name" htmlFor="ss-name" hint="Shown in the header and page titles."><Input id="ss-name" className="h-8" value={site.name} onChange={(e) => set({ name: e.target.value })} /></Row>
            <Row label="Domain" htmlFor="ss-domain" hint="Used for the sitemap and Open site."><Input id="ss-domain" className="h-8 font-mono text-xs" value={site.domain} onChange={(e) => set({ domain: e.target.value.replace(/^https?:\/\//, "").replace(/\/+$/, "") })} placeholder="bcndlabs.dev" /></Row>
            <Row label="Footer text" htmlFor="ss-footer" hint="Empty shows © year and the site name."><Input id="ss-footer" className="h-8" value={site.footerText} onChange={(e) => set({ footerText: e.target.value })} /></Row>
          </Panel>
          <Panel category="website" title="Publishing" className="mt-[var(--bw-grid-gap)]" bodyClassName="divide-y divide-line-soft">
            <Row label="Repository" htmlFor="ss-repo" hint="A Website publishing connection (GitHub repo and branch). Your host deploys from it.">
              {repos.length ? (
                <OptionSelect id="ss-repo" value={site.connectionId ?? "auto"} onChange={(v) => set({ connectionId: v === "auto" ? undefined : v })} options={[{ value: "auto", label: "First working connection" }, ...repos.map((c) => ({ value: c.id, label: `${c.label}${c.account ? ` · ${c.account}` : ""}` }))]} className="w-full" />
              ) : <Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("connections", "website")}>Connect a repository</Button>}
            </Row>
            <Row label="Folder" htmlFor="ss-root" hint="Where in the repo the site goes. Empty is the repository root."><Input id="ss-root" className="h-8 font-mono text-xs" value={site.root} onChange={(e) => set({ root: e.target.value.replace(/^\/+/, "") })} placeholder="(root)" /></Row>
          </Panel>
          <Panel category="website" title="Forms" className="mt-[var(--bw-grid-gap)]" bodyClassName="divide-y divide-line-soft">
            <Row label="Form receiver" htmlFor="ss-forms" hint="Your form receiver Worker's address (worker/forms). Forms, comments and sign-ups post here."><Input id="ss-forms" className="h-8 font-mono text-xs" value={site.formEndpoint ?? ""} onChange={(e) => set({ formEndpoint: e.target.value.trim() || undefined })} placeholder="https://forms.example.workers.dev" /></Row>
            <Row label="Turnstile site key" htmlFor="ss-turnstile" hint="From Cloudflare Turnstile; shows the bot check on forms."><Input id="ss-turnstile" className="h-8 font-mono text-xs" value={site.turnstileKey ?? ""} onChange={(e) => set({ turnstileKey: e.target.value.trim() || undefined })} /></Row>
            <Row label="Comments on posts" htmlFor="ss-comments" hint="Visitors can comment under posts. Comments show after you approve them and publish."><Switch id="ss-comments" checked={!!site.comments} onCheckedChange={(comments) => set({ comments })} /></Row>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Redirects" className="mt-[var(--bw-grid-gap)]" meta="Renaming a published page adds one" bodyClassName="grid gap-1.5 px-3.5 py-3">
            {site.redirects.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                <Input className="h-8 font-mono text-xs" value={r.from} aria-label="From" onChange={(e) => set({ redirects: site.redirects.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} />
                <span className="text-muted-foreground">→</span>
                <Input className="h-8 font-mono text-xs" value={r.to} aria-label="To" onChange={(e) => set({ redirects: site.redirects.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} />
                <Button variant="quiet" size="icon-sm" aria-label="Remove redirect" onClick={() => set({ redirects: site.redirects.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => set({ redirects: [...site.redirects, { from: "/old-page", to: "/new-page/" }] })}><Plus /> Redirect</Button>
          </Panel>
          <Panel category="website" title="Template" className="mt-[var(--bw-grid-gap)]" bodyClassName="divide-y divide-line-soft">
            <Row label="Offer this site as a template" htmlFor="ss-template" hint="New sites can start as a copy of it: same look, same pages, none of your posts."><Switch id="ss-template" checked={!!site.template} onCheckedChange={(template) => set({ template })} /></Row>
            {site.template && <Row label="What it is" htmlFor="ss-template-about" hint="One line shown when you pick a template."><Input id="ss-template-about" className="h-8" value={site.templateAbout ?? ""} onChange={(e) => set({ templateAbout: e.target.value })} placeholder="e.g. My blog layout" /></Row>}
          </Panel>
          <Panel category="website" title="Danger zone" className="mt-[var(--bw-grid-gap)]" bodyClassName="px-3.5 py-3">
            <Button variant="outline" className="text-red-text" onClick={() => { if (!confirm(`Delete ${site.name} and its pages from Blackwall? The published site and its repository aren't touched.`)) return; remove("sites", site.id); toast(`${site.name} deleted`); navigate(cmsPagesHref) }}><Trash2 /> Delete site</Button>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
