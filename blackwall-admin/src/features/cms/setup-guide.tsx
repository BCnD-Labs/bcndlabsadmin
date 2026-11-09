import { Check, ChevronRight, X } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { STARTERS, checkSite } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { siteFilesHref, siteLookHref, siteSettingsHref, sitePageHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { useNavigate } from "react-router-dom"

interface Step { id: string; title: string; why: string; done: boolean; label: string; to?: string; run?: () => void }

/** "Set up your site": the few things every site needs, in order, each done from here and ticked off by what you've actually done. */
export function SetupGuide({ site }: { site: Site }) {
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const { update } = useWorkspace.getState()
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()

  const steps = useMemo<Step[]>(() => {
    const own = pages.filter((p) => p.siteId === site.id)
    const issues = checkSite(site, pages, drafts, forms)
    const placeholders = issues.filter((i) => i.pageId && /placeholder|no image yet/.test(i.text))
    const unfinishedPages = new Set(placeholders.map((i) => i.pageId)).size
    const firstUnfinished = [...own].sort((a, b) => a.order - b.order).find((p) => placeholders.some((i) => i.pageId === p.id)) ?? own.find((p) => p.slug === "") ?? own[0]
    const palette = STARTERS[site.starter]
    const restyled = !!site.font || !!site.corners || !!site.width || !palette || JSON.stringify(palette.light) !== JSON.stringify(site.light) || JSON.stringify(palette.dark) !== JSON.stringify(site.dark)
    const fresh = Date.parse(site.createdAt) + 3000
    const post = drafts.find((d) => d.siteId === site.id && d.kind === "post")
    return [
      { id: "look", title: "Choose how it looks", why: "Pick colors, type and corners. You'll see the result as you click.", done: restyled, label: "Open Look", to: siteLookHref },
      { id: "fill", title: "Replace the placeholder text", why: placeholders.length ? `${unfinishedPages} ${unfinishedPages === 1 ? "page still has" : "pages still have"} sample text or empty pictures. Click anything in the preview to write your own.` : "Every page has your own words and pictures.", done: !placeholders.length && own.length > 0, label: firstUnfinished ? `Edit ${firstUnfinished.title || "page"}` : "Add a page", to: firstUnfinished ? sitePageHref(firstUnfinished.id) : undefined, run: firstUnfinished ? undefined : () => openForm({ kind: "sitePage" }) },
      { id: "page", title: "Add a page of your own", why: "About, Projects, Services… pick one and it arrives with sections already laid out.", done: own.some((p) => Date.parse(p.createdAt) > fresh), label: "Add a page", run: () => openForm({ kind: "sitePage" }) },
      { id: "post", title: "Write your first post", why: "Posts are written in plain text with simple formatting and show up on your blog and course pages.", done: !!post, label: "New post", run: () => navigate(`/cms/posts/${createDraft({ siteId: site.id }).id}`) },
      { id: "details", title: "Add your domain and footer", why: "So the sitemap, links and footer say the right things.", done: !!site.domain.trim() && !!site.footerText.trim(), label: "Open Settings", to: siteSettingsHref },
      { id: "files", title: "Check it and get the files", why: "Blackwall looks for problems, then gives you everything to copy to your host.", done: !!site.exportedAt || !!site.publishedAt, label: "Get files", to: siteFilesHref },
    ]
  }, [site, pages, drafts, forms, openForm, createDraft, navigate])

  if (site.guideHidden) return null
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return (
    <Panel category="website" title="Set up your site" meta={`${done} of ${steps.length} done`}
      actions={<Button variant="quiet" size="icon-sm" aria-label="Hide the setup guide" title="Hide the setup guide" onClick={() => update("sites", site.id, { guideHidden: true })}><X /></Button>}
      bodyClassName="p-0">
      <div className="h-1 bg-well" aria-hidden><div className="h-full bg-[var(--bw-category)] transition-[width]" data-category="website" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="divide-y divide-line-soft">
        {steps.map((s) => (
          <li key={s.id} className={cn("flex items-center gap-3 px-3.5 py-2.5", s === next && "bg-raised/60")} data-testid={`guide-${s.id}`} data-done={s.done}>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", s.done ? "border-transparent bg-green/20 text-green" : "border-line text-transparent")} aria-hidden><Check className="size-3" /></span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[13px] font-semibold", s.done ? "text-muted-foreground line-through decoration-faint" : "text-ink")}>{s.title}</span>
              {(!s.done || s === next) && <span className="block text-xs leading-snug text-muted-foreground">{s.why}</span>}
            </span>
            {s.done ? <span className="sr-only">Done</span> : s.to ? <Button size="sm" variant={s === next ? "default" : "outline"} asChild><Link to={s.to}>{s.label}<ChevronRight /></Link></Button> : <Button size="sm" variant={s === next ? "default" : "outline"} onClick={s.run}>{s.label}<ChevronRight /></Button>}
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** After hiding the guide: a small way to bring it back. */
export function ShowGuide({ site }: { site: Site }) {
  if (!site.guideHidden) return null
  return <Button variant="quiet" size="sm" className="justify-self-start text-muted-foreground" onClick={() => useWorkspace.getState().update("sites", site.id, { guideHidden: false })}>Show the setup guide</Button>
}
