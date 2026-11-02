import { Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { STARTERS, SWATCH_INFO, SWATCH_KEYS, contrast } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { OptionSelect } from "@/components/forms/fields"
import { cmsPagesHref } from "@/lib/routes"
import type { Site, SitePalette } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { SiteSwitcher } from "./site-switcher"
import { PublishBar } from "./pages-tab"
import { useCurrentSite } from "./use-cms"

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1"><Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{label}</Label>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-80">{children}</div>
    </div>
  )
}

function Palette({ site, mode, onChange }: { site: Site; mode: "light" | "dark"; onChange: (p: SitePalette) => void }) {
  const pal = site[mode]
  return (
    <div className="grid gap-1.5 px-3.5 py-2.5 sm:grid-cols-3">
      {SWATCH_KEYS.map((k) => {
        const ratio = k === "text" || k === "muted" || k === "accent" ? contrast(pal[k], pal.bg) : undefined
        return (
          <label key={k} className="flex items-center gap-2 rounded-[8px] bg-raised px-2 py-1.5">
            <input type="color" value={pal[k]} onChange={(e) => onChange({ ...pal, [k]: e.target.value })} className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent" aria-label={`${SWATCH_INFO[k].l} (${mode})`} />
            <span className="min-w-0 flex-1"><span className="block text-xs text-ink">{SWATCH_INFO[k].l}</span><span className="block truncate font-mono text-[10.5px] text-muted-foreground">{pal[k]}</span></span>
            {ratio != null && <span className={cn("text-[10.5px] tabular-nums", ratio >= (k === "muted" ? 3 : 4.5) ? "text-green" : "text-amber")} title="Contrast against the page">{ratio.toFixed(1)}</span>}
          </label>
        )
      })}
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
            <Row label="Form receiver" htmlFor="ss-forms" hint="Your Cloudflare Worker's address. Set up in the next step."><Input id="ss-forms" className="h-8 font-mono text-xs" value={site.formEndpoint ?? ""} onChange={(e) => set({ formEndpoint: e.target.value.trim() || undefined })} placeholder="https://forms.example.workers.dev" /></Row>
            <Row label="Turnstile site key" htmlFor="ss-turnstile" hint="From Cloudflare Turnstile; shows the bot check on forms."><Input id="ss-turnstile" className="h-8 font-mono text-xs" value={site.turnstileKey ?? ""} onChange={(e) => set({ turnstileKey: e.target.value.trim() || undefined })} /></Row>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Colors" bodyClassName="py-1">
            <Row label="Start from" htmlFor="ss-starter">
              <OptionSelect id="ss-starter" value={site.starter in STARTERS ? site.starter : "midnight"} onChange={(k) => set({ starter: k, light: { ...STARTERS[k].light }, dark: { ...STARTERS[k].dark } })} options={Object.entries(STARTERS).map(([k, s]) => ({ value: k, label: s.name }))} className="w-full" />
            </Row>
            <p className="px-3.5 pt-1 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Light</p>
            <Palette site={site} mode="light" onChange={(light) => set({ light })} />
            <Row label="Dark mode" htmlFor="ss-dark" hint="Used when a visitor's device is set to dark."><Switch id="ss-dark" checked={site.darkMode} onCheckedChange={(darkMode) => set({ darkMode })} /></Row>
            {site.darkMode && <Palette site={site} mode="dark" onChange={(dark) => set({ dark })} />}
          </Panel>
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
          <Panel category="website" title="Your CSS" className="mt-[var(--bw-grid-gap)]" bodyClassName="px-3.5 py-3">
            <Textarea rows={5} value={site.customCss} onChange={(e) => set({ customCss: e.target.value })} className="font-mono text-xs" placeholder=".site-title { letter-spacing: .05em; }" aria-label="Custom CSS" />
            <p className="mt-1.5 text-[11px] text-faint">Added at the end of theme.css on every page.</p>
          </Panel>
          <Panel category="website" title="Danger zone" className="mt-[var(--bw-grid-gap)]" bodyClassName="px-3.5 py-3">
            <Button variant="outline" className="text-red-text" onClick={() => { if (!confirm(`Delete ${site.name} and its pages from Blackwall? The published site and its repository aren't touched.`)) return; remove("sites", site.id); toast(`${site.name} deleted`); navigate(cmsPagesHref) }}><Trash2 /> Delete site</Button>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
