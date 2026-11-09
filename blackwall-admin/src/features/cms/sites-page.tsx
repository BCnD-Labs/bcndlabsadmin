import { Eye, ExternalLink, FileDown, LayoutTemplate, Monitor, Pencil, Plus, Smartphone, Tablet } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { imagePathsIn, imagePathsInPost } from "@shared/assets"
import { renderPage, renderPost } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { StatusMarker } from "@/components/common/tags"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { OptionSelect } from "@/components/forms/fields"
import { usePreviewPictures } from "@/features/assets/use-assets"
import { timeAgo } from "@/lib/dates"
import { cmsPagesHref, siteFilesHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { STARTERS } from "@shared/sitebuilder"
import { ScaledFrame, SitePreview } from "./site-preview"
import { deployedAt, selectSite, useUnpublished } from "./use-cms"

/** Everything one site is made of, gathered for its card and its viewer. */
function useSiteParts(site: Site) {
  const allPages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const assets = useWorkspace((s) => s.assets)
  const pages = useMemo(() => allPages.filter((p) => p.siteId === site.id).sort((a, b) => a.order - b.order), [allPages, site.id])
  const posts = useMemo(() => drafts.filter((d) => d.siteId === site.id && d.kind === "post"), [drafts, site.id])
  const live = useMemo(() => posts.filter((p) => p.publishedAt), [posts])
  return { pages, posts, live, forms, assets }
}

/** A site's front page as it looks, small enough for a card. */
function Thumb({ site }: { site: Site }) {
  const { pages, live, forms, assets } = useSiteParts(site)
  const home = pages.find((p) => p.slug === "") ?? pages[0]
  const pictures = usePreviewPictures(useMemo(() => (home ? imagePathsIn(home.sections) : []), [home]))
  const html = useMemo(() => (home ? renderPage(site, pages, home, { preview: true, posts: live, forms, assets, assetUrls: pictures }) : ""), [site, pages, home, live, forms, assets, pictures])
  return home ? <ScaledFrame html={html} title={`${site.name} home page`} /> : <div className="grid aspect-[16/10] place-items-center bg-well text-xs text-muted-foreground">No pages yet</div>
}

function SiteCard({ site, onView }: { site: Site; onView: () => void }) {
  const navigate = useNavigate()
  const { pages, posts } = useSiteParts(site)
  const changes = useUnpublished(site)
  const since = deployedAt(site)
  const last = [site.updatedAt, ...pages.map((p) => p.updatedAt), ...posts.map((p) => p.updatedAt)].sort().at(-1)!
  const edit = () => { selectSite(site.id); navigate(cmsPagesHref) }
  const status = !since ? { tone: "off" as const, text: "Files not taken yet" } : changes.count ? { tone: "warn" as const, text: `${changes.count} change${changes.count === 1 ? "" : "s"} since your last files` } : { tone: "ok" as const, text: "Up to date" }
  return (
    <li className="bw-panel group flex flex-col overflow-hidden" data-testid="site-card">
      <button type="button" onClick={edit} className="relative block text-left" aria-label={`Edit ${site.name}`}>
        <Thumb site={site} />
        <span className="absolute inset-0 grid place-items-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100"><span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5"><Pencil className="size-3.5" /> Edit</span></span>
      </button>
      <div className="grid gap-1 px-3.5 pt-3">
        <div className="flex items-center gap-2"><b className="min-w-0 flex-1 truncate text-[14px] text-ink">{site.name}</b>{site.template && <span className="shrink-0 rounded-full bg-ink-2/8 px-2 text-[10px] font-bold tracking-[0.03em] text-ink-2 uppercase">Template</span>}</div>
        <p className="truncate font-mono text-xs text-muted-foreground">{site.domain || "No domain yet"}</p>
        <p className="flex items-center gap-1.5 text-xs text-ink-2"><StatusMarker tone={status.tone} />{status.text}</p>
        <p className="text-[11px] text-faint">{pages.length} {pages.length === 1 ? "page" : "pages"} · {posts.length} {posts.length === 1 ? "post" : "posts"} · {STARTERS[site.starter]?.name ?? "Custom"} look · edited {timeAgo(last)}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 px-3.5 py-3">
        <Button size="sm" onClick={edit}><Pencil /> Edit</Button>
        <Button size="sm" variant="outline" onClick={onView}><Eye /> View</Button>
        <Button size="sm" variant="quiet" asChild><Link to={siteFilesHref} onClick={() => selectSite(site.id)}><FileDown /> Get files</Link></Button>
        {site.domain && <Button size="sm" variant="quiet" asChild><a href={`https://${site.domain}`} target="_blank" rel="noreferrer" aria-label={`Open ${site.domain}`}><ExternalLink /></a></Button>}
      </div>
    </li>
  )
}

const WIDTHS = { desktop: "100%", tablet: "820px", phone: "390px" } as const

/** View a whole site: its pages and posts as visitors will see them, following the menu and links, without opening the editor. */
export function SiteViewer({ site, onClose, inEditor }: { site: Site; onClose: () => void; inEditor?: boolean }) {
  const navigate = useNavigate()
  const { pages, posts, live, forms, assets } = useSiteParts(site)
  const [target, setTarget] = useState<{ kind: "page" | "post"; id: string } | null>(null)
  const [width, setWidth] = useState<keyof typeof WIDTHS>("desktop")
  const home = pages.find((p) => p.slug === "") ?? pages[0]
  const page = target?.kind === "page" ? pages.find((p) => p.id === target.id) : target ? undefined : home
  const post = target?.kind === "post" ? posts.find((p) => p.id === target.id) : undefined
  const paths = useMemo(() => (post ? imagePathsInPost(post) : page ? imagePathsIn(page.sections) : []), [page, post])
  const pictures = usePreviewPictures(paths)
  const html = useMemo(() => {
    if (post) return renderPost(site, pages, post, { preview: true, forms, assets, assetUrls: pictures })
    if (page) return renderPage(site, pages, page, { preview: true, posts: live, forms, assets, assetUrls: pictures })
    return ""
  }, [site, pages, page, post, live, forms, assets, pictures])
  const follow = (href: string) => {
    const p = pages.find((x) => (x.slug ? `/${x.slug}/` : "/") === href)
    if (p) return setTarget({ kind: "page", id: p.id })
    const d = posts.find((x) => `/posts/${x.slug}/` === href)
    if (d) setTarget({ kind: "post", id: d.id })
  }
  const options = [...pages.map((p) => ({ value: `page:${p.id}`, label: p.title || "Untitled page" })), ...posts.map((p) => ({ value: `post:${p.id}`, label: `Post: ${p.title || "Untitled"}${p.publishedAt ? "" : " (draft)"}` }))]
  const current = post ? `post:${post.id}` : page ? `page:${page.id}` : ""
  return (
    <div className="flex max-h-[90dvh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line py-3 pr-12 pl-4">
        <div className="mr-auto min-w-0"><DialogTitle className="truncate font-heading text-base font-bold">{site.name}</DialogTitle><DialogDescription className="truncate text-xs">{site.domain || "No domain yet"} · links work; this is how visitors see it</DialogDescription></div>
        <OptionSelect label="Page to view" value={current} onChange={(v) => { const [kind, id] = v.split(":"); setTarget({ kind: kind as "page" | "post", id }) }} options={options} className="w-48" />
        <div role="radiogroup" aria-label="Preview width" className="flex gap-0.5 rounded-[8px] bg-well p-0.5">
          {([["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]] as const).map(([w, Icon]) => (
            <button key={w} type="button" role="radio" aria-checked={width === w} aria-label={w} title={w} onClick={() => setWidth(w)} className={cn("flex size-7 items-center justify-center rounded-[6px]", width === w ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}><Icon className="size-3.5" /></button>
          ))}
        </div>
        {!inEditor && <Button size="sm" onClick={() => { selectSite(site.id); onClose(); navigate(cmsPagesHref) }}><Pencil /> Edit this site</Button>}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-well p-3">
        {html ? <SitePreview html={html} title={`${site.name} preview`} width={WIDTHS[width]} onLink={follow} className="h-[68dvh]" /> : <p className="grid place-items-center text-sm text-muted-foreground">This site has no pages yet.</p>}
      </div>
    </div>
  )
}

/** Websites: every site you manage as a card with its front page showing. Click one to edit it; View walks through it first. */
export function CmsSitesPage() {
  const sites = useWorkspace((s) => s.sites)
  const openForm = useUi((s) => s.openForm)
  const [viewing, setViewing] = useState<string | null>(null)
  const viewed = sites.find((s) => s.id === viewing)
  const ordered = useMemo(() => [...sites].sort((a, b) => Number(!!a.template) - Number(!!b.template) || a.name.localeCompare(b.name)), [sites])
  return (
    <>
      <PageHeader title="Websites" subtitle={sites.length ? `${sites.length} ${sites.length === 1 ? "site" : "sites"}` : undefined} actions={<Button onClick={() => openForm({ kind: "site" })}><Plus /> New site</Button>} />
      <WorkspaceGrid>
        <GridItem span="full">
          {sites.length ? (
            <ul className="grid gap-[var(--bw-grid-gap)] sm:grid-cols-2 xl:grid-cols-3" aria-label="Your sites">
              {ordered.map((s) => <SiteCard key={s.id} site={s} onView={() => setViewing(s.id)} />)}
              <li>
                <button type="button" onClick={() => openForm({ kind: "site" })} className="grid h-full min-h-56 w-full place-items-center rounded-[var(--bw-radius,12px)] border border-dashed border-line text-sm text-muted-foreground transition-colors hover:border-[var(--bw-red)] hover:text-ink"><span className="grid justify-items-center gap-1.5"><Plus className="size-5" /> New site</span></button>
              </li>
            </ul>
          ) : (
            <Panel category="website" title="Websites">
              <EmptyState roomy icon={LayoutTemplate} title="Build and run your websites from here" action={<Button onClick={() => openForm({ kind: "site" })}><Plus /> New site</Button>}>
                Start from a template or from one of your own, make it yours with ready-made sections, write posts, then get the finished files for your host. Every site you add shows up here, ready to view or edit.
              </EmptyState>
            </Panel>
          )}
        </GridItem>
      </WorkspaceGrid>
      <Dialog open={!!viewed} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-5xl" aria-describedby={undefined}>{viewed && <SiteViewer site={viewed} onClose={() => setViewing(null)} />}</DialogContent>
      </Dialog>
    </>
  )
}
