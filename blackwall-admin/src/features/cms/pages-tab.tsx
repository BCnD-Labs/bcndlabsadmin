import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, FileDown, Globe, LayoutTemplate, MoreHorizontal, Plus, Rocket, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { StatusMarker } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { sitePageHref, siteFilesHref, siteSettingsHref } from "@/lib/routes"
import type { Site, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { STARTERS } from "@shared/sitebuilder"
import { useConnections } from "@/services/connector"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { SetupGuide, ShowGuide } from "./setup-guide"
import { SiteSwitcher } from "./site-switcher"
import { SiteTabs } from "./site-tabs"
import { deployedAt, duplicatePage, publishSite, useCurrentSite, useUnpublished } from "./use-cms"

export function pageState(p: SitePage, site: Site): "published" | "changed" | "draft" {
  const since = deployedAt(site)
  if (!since || p.createdAt > since) return "draft"
  return p.updatedAt > since ? "changed" : "published"
}
export const STATE_LABEL = { published: "Up to date", changed: "Changed", draft: "New" } as const
const TONE = { published: "ok", changed: "warn", draft: "off" } as const

export function StateChip({ state }: { state: keyof typeof STATE_LABEL }) {
  return <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase" title={state === "published" ? "Nothing changed since you last got or published the files" : state === "changed" ? "Edited since you last got or published the files" : "Not in your last files yet"}><StatusMarker tone={TONE[state]} />{STATE_LABEL[state]}</span>
}

/** What has changed since the files last left Blackwall, with the ways to get them out: copy/download always, publish when a repository is connected. */
export function PublishBar({ site, hideFiles }: { site: Site; hideFiles?: boolean }) {
  const changes = useUnpublished(site)
  const { list, refresh } = useConnections()
  const [busy, setBusy] = useState(false)
  useEffect(() => { void refresh() }, [refresh])
  const since = deployedAt(site)
  const repo = list.some((c) => c.provider === "website")
  const what = [changes.pages.length && `${changes.pages.length} page${changes.pages.length === 1 ? "" : "s"}`, changes.posts.length && `${changes.posts.length} post${changes.posts.length === 1 ? "" : "s"}`, changes.settings && !since ? "the whole site" : changes.settings && "site settings"].filter(Boolean).join(", ")
  const dirty = !!what
  const last = site.publishedAt && site.publishedAt === since ? `Last published ${timeAgo(site.publishedAt)}${site.publishedSha ? ` (${site.publishedSha.slice(0, 7)})` : ""}.` : site.exportedAt && site.exportedAt === since ? `You last got the files ${timeAgo(site.exportedAt)}.` : "Get the files when you're ready to put it online."
  return (
    <div className="bw-panel flex flex-wrap items-center gap-3 px-4 py-3" role="status">
      <StatusMarker tone={dirty ? "warn" : "ok"} />
      <span className="min-w-[15rem] flex-1 text-[13px]">
        {!since ? <b className="text-ink">Nothing has left Blackwall yet. </b> : dirty ? <><b className="text-ink">Changed since then: {what}.</b> </> : <b className="text-ink">Everything is up to date. </b>}
        <span className="text-muted-foreground">{last}</span>
      </span>
      {site.domain && <Button variant="ghost" size="sm" asChild><a href={`https://${site.domain}`} target="_blank" rel="noreferrer"><Globe /> Open site</a></Button>}
      {!hideFiles && <Button size="sm" variant={repo ? "outline" : "default"} asChild><Link to={siteFilesHref}><FileDown /> Get files</Link></Button>}
      {repo && <Button size="sm" disabled={busy || !dirty} onClick={async () => { setBusy(true); try { await publishSite(site) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}>
        <Rocket /> {busy ? "Publishing…" : "Publish changes"}
      </Button>}
    </div>
  )
}

export function CmsPagesPage() {
  const site = useCurrentSite()
  const all = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const { update, remove } = useWorkspace.getState()
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()

  if (!site) {
    return (
      <>
        <PageHeader title="Website" />
        <WorkspaceGrid><GridItem span={2}><Panel category="website" title="Sites">
          <EmptyState roomy icon={LayoutTemplate} title="Build and run your websites from here" action={<Button onClick={() => openForm({ kind: "site" })}><Plus /> New site</Button>}>
            Pick a starting point, make it yours with ready-made sections, write posts, then get the finished files to put on your host (or publish to GitHub in one click). A short checklist walks you through it.
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      </>
    )
  }

  const pages = all.filter((p) => p.siteId === site.id).sort((a, b) => a.order - b.order)
  const posts = drafts.filter((d) => d.siteId === site.id)
  const move = (p: SitePage, d: -1 | 1) => {
    const i = pages.indexOf(p), j = i + d
    if (j < 0 || j >= pages.length) return
    update("pages", p.id, { order: pages[j].order })
    update("pages", pages[j].id, { order: p.order })
  }
  const redirectsTo = (p: SitePage) => site.redirects.filter((r) => r.to.replace(/^\/|\/$/g, "") === p.slug)

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} actions={<Button onClick={() => openForm({ kind: "sitePage" })}><Plus /> Page</Button>} />
      <WorkspaceGrid>
        <GridItem span="full"><SiteTabs current="pages" /></GridItem>
        <GridItem span="full"><PublishBar site={site} /></GridItem>
        <GridItem span="full"><SetupGuide site={site} /><ShowGuide site={site} /></GridItem>
        <GridItem span={3}>
          <Panel category="website" title="Pages" meta={`${pages.length} · in menu order`}>
            {pages.length ? (
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="text-[11px] text-faint"><tr><th className="py-2 pl-3.5 font-normal">Page</th><th className="hidden w-40 font-normal sm:table-cell">Address</th><th className="w-36 font-normal">Status</th><th className="hidden w-28 font-normal md:table-cell">Edited</th><th className="w-12" /></tr></thead>
                <tbody>
                  {pages.map((p, i) => {
                    const r = redirectsTo(p)
                    return (
                      <tr key={p.id} className="border-t border-line-soft hover:bg-raised" data-testid="site-page-row">
                        <td className="py-2 pl-3.5">
                          <Link to={sitePageHref(p.id)} className="block min-w-0">
                            <span className="flex items-center gap-1.5 font-semibold text-ink">{p.title}{!p.inMenu && <EyeOff className="size-3 text-faint" aria-label="Not in the menu" />}</span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">{[p.sections.length ? `${p.sections.length} section${p.sections.length === 1 ? "" : "s"}` : "Empty", ...r.map((x) => `redirect ${x.from} → /${p.slug}`)].join(" · ")}</span>
                          </Link>
                        </td>
                        <td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">/{p.slug}</td>
                        <td><StateChip state={pageState(p, site)} /></td>
                        <td className="hidden text-xs text-muted-foreground md:table-cell">{timeAgo(p.updatedAt)}</td>
                        <td className="pr-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label={`Actions for ${p.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => navigate(sitePageHref(p.id))}><LayoutTemplate /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { const c = duplicatePage(p); toast.success(`Duplicated as ${c.title}`) }}><Copy /> Duplicate</DropdownMenuItem>
                              <DropdownMenuItem disabled={i === 0} onSelect={() => move(p, -1)}><ArrowUp /> Move up</DropdownMenuItem>
                              <DropdownMenuItem disabled={i === pages.length - 1} onSelect={() => move(p, 1)}><ArrowDown /> Move down</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => update("pages", p.id, { inMenu: !p.inMenu })}>{p.inMenu ? <><EyeOff /> Hide from menu</> : <><Eye /> Show in menu</>}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-text" disabled={!p.slug} onSelect={() => { remove("pages", p.id); toast(`${p.title} deleted`, { description: "It leaves the site when you next get the files.", action: { label: "Undo", onClick: () => useWorkspace.setState((st) => ({ pages: [p, ...st.pages] })) } }) }}><Trash2 /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={LayoutTemplate} title="No pages yet" action={<Button variant="outline" onClick={() => openForm({ kind: "sitePage" })}><Plus /> Page</Button>} />
            )}
          </Panel>
        </GridItem>
        <GridItem>
          <Panel category="website" title="Site" bodyClassName="px-3.5 py-3">
            <dl className="grid gap-1 text-[13px]">
              {[
                ["Domain", site.domain || "Not set"],
                ["Colors", `${STARTERS[site.starter]?.name ?? "Custom"}${site.darkMode ? " · light + dark" : ""}`],
                ["Menu", pages.filter((p) => p.inMenu).map((p) => p.title).join(", ") || "Empty"],
                ["Posts", `${posts.filter((p) => p.publishedAt).length} published · ${posts.filter((p) => !p.publishedAt).length} drafts`],
                ["Forms in library", String(forms.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-0.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 truncate text-right text-ink">{v}</dd></div>
              ))}
            </dl>
            <div className={cn("mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3")}>
<Button size="sm" variant="outline" asChild><Link to={siteSettingsHref}>Site settings</Link></Button>
            </div>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
