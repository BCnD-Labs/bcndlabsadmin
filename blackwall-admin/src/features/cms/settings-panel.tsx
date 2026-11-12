import { Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { OptionSelect } from "@/components/forms/fields"
import { siteAnalyticsConnection } from "@shared/site-links"
import { sitesHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { useConnections } from "@/services/connector"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-2.5 @2xl:flex-row @2xl:items-center @2xl:gap-6">
      <div className="min-w-0 flex-1"><Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{label}</Label>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 @2xl:w-80">{children}</div>
    </div>
  )
}

export function SettingsPanel({ site }: { site: Site }) {
  const { update, remove } = useWorkspace.getState()
  const { list, refresh } = useConnections()
  const navigate = useNavigate()
  useEffect(() => { void refresh() }, [refresh])
  const set = (patch: Partial<Site>) => update("sites", site.id, patch)
  const repos = list.filter((c) => c.provider === "website")
  const sources = list.filter((c) => c.provider === "analytics")
  const mapped = siteAnalyticsConnection(site, list)

  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]">
          <Panel category="website" title="Site" bodyClassName="divide-y divide-line-soft">
            <Row label="Name" htmlFor="ss-name" hint="Shown in the header and page titles."><Input id="ss-name" className="h-8" value={site.name} onChange={(e) => set({ name: e.target.value })} /></Row>
            <Row label="Domain" htmlFor="ss-domain" hint="Used for the sitemap and Open site."><Input id="ss-domain" className="h-8 font-mono text-xs" value={site.domain} onChange={(e) => set({ domain: e.target.value.replace(/^https?:\/\//, "").replace(/\/+$/, "") })} placeholder="bcndlabs.dev" /></Row>
            <Row label="Built with" htmlFor="ss-framework" hint={site.framework === "bootstrap" ? "Bootstrap 5 from its CDN, then your css/style.css. Pages are flat .html files with relative links, so the folder works anywhere (any web host, GitHub Pages, your disk)." : "Pagesmith's own light styles. Pick Bootstrap if you want its components, or a site that must use it."}>
              <OptionSelect id="ss-framework" value={site.framework ?? "own"} onChange={(v) => set({ framework: v === "bootstrap" ? "bootstrap" : undefined })} options={[{ value: "own", label: "Pagesmith's own styles" }, { value: "bootstrap", label: "Bootstrap 5" }]} className="w-full" />
            </Row>
            <Row label="Footer text" htmlFor="ss-footer" hint="Empty shows © year and the site name."><Input id="ss-footer" className="h-8" value={site.footerText} onChange={(e) => set({ footerText: e.target.value })} /></Row>
          </Panel>
          <Panel category="website" title="Publishing" bodyClassName="divide-y divide-line-soft">
            <Row label="Repository" htmlFor="ss-repo" hint="A Website publishing connection (GitHub repo and branch). Your host deploys from it.">
              {repos.length ? (
                <OptionSelect id="ss-repo" value={site.connectionId ?? "auto"} onChange={(v) => set({ connectionId: v === "auto" ? undefined : v })} options={[{ value: "auto", label: "First working connection" }, ...repos.map((c) => ({ value: c.id, label: `${c.label}${c.account ? ` · ${c.account}` : ""}` }))]} className="w-full" />
              ) : <Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("connections", "website")}>Connect a repository</Button>}
            </Row>
            <Row label="Folder" htmlFor="ss-root" hint="Where in the repo the site goes. Empty is the repository root."><Input id="ss-root" className="h-8 font-mono text-xs" value={site.root} onChange={(e) => set({ root: e.target.value.replace(/^\/+/, "") })} placeholder="(root)" /></Row>
          </Panel>
          <Panel category="website" title="Forms" bodyClassName="divide-y divide-line-soft">
            <Row label="Form receiver" htmlFor="ss-forms" hint="Your form receiver Worker's address (worker/forms). Forms, comments and sign-ups post here."><Input id="ss-forms" className="h-8 font-mono text-xs" value={site.formEndpoint ?? ""} onChange={(e) => set({ formEndpoint: e.target.value.trim() || undefined })} placeholder="https://forms.example.workers.dev" /></Row>
            <Row label="Turnstile site key" htmlFor="ss-turnstile" hint="From Cloudflare Turnstile; shows the bot check on forms."><Input id="ss-turnstile" className="h-8 font-mono text-xs" value={site.turnstileKey ?? ""} onChange={(e) => set({ turnstileKey: e.target.value.trim() || undefined })} /></Row>
            <Row label="Comments on posts" htmlFor="ss-comments" hint="Visitors can comment under posts. Comments show after you approve them and publish."><Switch id="ss-comments" checked={!!site.comments} onCheckedChange={(comments) => set({ comments })} /></Row>
          </Panel>
          <Panel category="website" title="Traffic" bodyClassName="divide-y divide-line-soft">
            <Row label="Analytics source" htmlFor="ss-analytics" hint={mapped ? `Showing ${mapped.label} in Insights and on this site's card.` : "None is reporting on this site yet, so Insights shows no numbers for it."}>
              {sources.length ? <OptionSelect id="ss-analytics" value={site.analyticsConnectionId ?? "auto"} onChange={(v) => set({ analyticsConnectionId: v === "auto" ? undefined : v })} options={[{ value: "auto", label: "Match by domain" }, ...sources.map((c) => ({ value: c.id, label: c.label }))]} className="w-full" />
                : <Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("connections", "analytics")}>Connect analytics</Button>}
            </Row>
          </Panel>
          <Panel category="website" title="Redirects" meta="Renaming a published page adds one" bodyClassName="grid gap-1.5 px-3.5 py-3">
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
          <Panel category="website" title="Template" bodyClassName="divide-y divide-line-soft">
            <Row label="Offer this site as a template" htmlFor="ss-template" hint="New sites can start as a copy of it: same look, same pages, none of your posts."><Switch id="ss-template" checked={!!site.template} onCheckedChange={(template) => set({ template })} /></Row>
            {site.template && <Row label="What it is" htmlFor="ss-template-about" hint="One line shown when you pick a template."><Input id="ss-template-about" className="h-8" value={site.templateAbout ?? ""} onChange={(e) => set({ templateAbout: e.target.value })} placeholder="e.g. My blog layout" /></Row>}
          </Panel>
          <Panel category="website" title="Danger zone" bodyClassName="px-3.5 py-3">
            <Button variant="outline" className="text-red-text" onClick={() => { if (!confirm(`Delete ${site.name} and its pages from Blackwall? The published site and its repository aren't touched.`)) return; remove("sites", site.id); toast(`${site.name} deleted`); navigate(sitesHref) }}><Trash2 /> Delete site</Button>
          </Panel>
    </div>
  )
}
