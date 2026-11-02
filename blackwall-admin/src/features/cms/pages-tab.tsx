import { ArrowDown, ArrowUp, Eye, EyeOff, Globe, LayoutTemplate, MoreHorizontal, Plus, Rocket, Trash2 } from "lucide-react"
import { useState } from "react"
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
import { formsHref, postsHref, sitePageHref, siteSettingsHref } from "@/lib/routes"
import type { Site, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { STARTERS } from "@shared/sitebuilder"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { SiteSwitcher } from "./site-switcher"
import { publishSite, useCurrentSite, useUnpublished } from "./use-cms"

export function pageState(p: SitePage, site: Site): "published" | "changed" | "draft" {
  if (!site.publishedAt || p.createdAt > site.publishedAt) return "draft"
  return p.updatedAt > site.publishedAt ? "changed" : "published"
}
export const STATE_LABEL = { published: "Published", changed: "Changed", draft: "Not published" } as const
const TONE = { published: "ok", changed: "warn", draft: "off" } as const

export function StateChip({ state }: { state: keyof typeof STATE_LABEL }) {
  return <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase"><StatusMarker tone={TONE[state]} />{STATE_LABEL[state]}</span>
}

/** Publish bar: what's unpublished, and the one button that builds and commits the site. */
export function PublishBar({ site }: { site: Site }) {
  const changes = useUnpublished(site)
  const [busy, setBusy] = useState(false)
  const what = [changes.pages.length && `${changes.pages.length} page${changes.pages.length === 1 ? "" : "s"}`, changes.posts.length && `${changes.posts.length} post${changes.posts.length === 1 ? "" : "s"}`, changes.settings && !site.publishedAt ? "the whole site" : changes.settings && "site settings"].filter(Boolean).join(", ")
  const dirty = !!what
  return (
    <div className="bw-panel flex flex-wrap items-center gap-3 px-4 py-3" role="status">
      <StatusMarker tone={dirty ? "warn" : "ok"} />
      <span className="min-w-[15rem] flex-1 text-[13px]">
        {dirty ? <><b className="text-ink">Unpublished: {what}.</b> </> : <b className="text-ink">Everything is published. </b>}
        <span className="text-muted-foreground">{site.publishedAt ? `Last published ${timeAgo(site.publishedAt)}${site.publishedSha ? ` (${site.publishedSha.slice(0, 7)})` : ""}.` : "This site hasn't been published yet."}</span>
      </span>
      {site.domain && <Button variant="ghost" size="sm" asChild><a href={`https://${site.domain}`} target="_blank" rel="noreferrer"><Globe /> Open site</a></Button>}
      <Button size="sm" disabled={busy || !dirty} onClick={async () => { setBusy(true); try { await publishSite(site) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}>
        <Rocket /> {busy ? "Publishing…" : "Publish changes"}
      </Button>
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
            Start from a template, edit pages with sections and blocks, write posts, add forms, then publish to your GitHub repository in one click.
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
        <GridItem span="full"><PublishBar site={site} /></GridItem>
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
                              <DropdownMenuItem disabled={i === 0} onSelect={() => move(p, -1)}><ArrowUp /> Move up</DropdownMenuItem>
                              <DropdownMenuItem disabled={i === pages.length - 1} onSelect={() => move(p, 1)}><ArrowDown /> Move down</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => update("pages", p.id, { inMenu: !p.inMenu })}>{p.inMenu ? <><EyeOff /> Hide from menu</> : <><Eye /> Show in menu</>}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-text" disabled={!p.slug} onSelect={() => { remove("pages", p.id); toast(`${p.title} deleted`, { description: "It leaves the site at your next publish." }) }}><Trash2 /> Delete</DropdownMenuItem>
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
              <Button size="sm" variant="outline" asChild><Link to={postsHref}>Posts</Link></Button>
              <Button size="sm" variant="outline" asChild><Link to={formsHref}>Forms</Link></Button>
            </div>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
