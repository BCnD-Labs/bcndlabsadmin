import { Check, ChevronRight, ListChecks } from "lucide-react"
import { useMemo, useState } from "react"
import { STARTERS, checkSite } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sitePageHref } from "@/lib/routes"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useCreateDraft } from "@/features/content/use-create-draft"
import { useNavigate } from "react-router-dom"
import type { WorkspacePanel } from "./site-workspace"

interface Step { id: string; title: string; why: string; done: boolean; label: string; run: () => void }

/** "Set up your site": the few things every site needs, in order, each done from here and ticked off by what you've actually done. */
export function SetupGuide({ site, onPanel }: { site: Site; onPanel: (panel: WorkspacePanel) => void }) {
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const forms = useWorkspace((s) => s.forms)
  const assets = useWorkspace((s) => s.assets)
  const { update } = useWorkspace.getState()
  const openForm = useUi((s) => s.openForm)
  const createDraft = useCreateDraft()
  const navigate = useNavigate()

  const steps = useMemo<Step[]>(() => {
    const own = pages.filter((p) => p.siteId === site.id)
    const issues = checkSite(site, pages, drafts, forms, assets)
    const placeholders = issues.filter((i) => i.pageId && /placeholder|no image yet/.test(i.text))
    const unfinishedPages = new Set(placeholders.map((i) => i.pageId)).size
    const firstUnfinished = [...own].sort((a, b) => a.order - b.order).find((p) => placeholders.some((i) => i.pageId === p.id)) ?? own.find((p) => p.slug === "") ?? own[0]
    const palette = STARTERS[site.starter]
    const restyled = !!site.font || !!site.corners || !!site.width || !palette || JSON.stringify(palette.light) !== JSON.stringify(site.light) || JSON.stringify(palette.dark) !== JSON.stringify(site.dark)
    const fresh = Date.parse(site.createdAt) + 3000
    const post = drafts.find((d) => d.siteId === site.id && d.kind === "post")
    return [
      { id: "look", title: "Choose how it looks", why: "Pick colors, type and corners. You'll see the result as you click.", done: restyled, label: "Open Look", run: () => onPanel("look") },
      { id: "fill", title: "Replace the placeholder text", why: placeholders.length ? `${unfinishedPages} ${unfinishedPages === 1 ? "page still has" : "pages still have"} sample text or empty pictures. Click anything in the preview to write your own.` : "Every page has your own words and pictures.", done: !placeholders.length && own.length > 0, label: firstUnfinished ? `Edit ${firstUnfinished.title || "page"}` : "Add a page", run: () => (firstUnfinished ? navigate(sitePageHref(firstUnfinished.id)) : openForm({ kind: "sitePage" })) },
      { id: "page", title: "Add a page of your own", why: "About, Projects, Services… pick one and it arrives with sections already laid out.", done: own.some((p) => Date.parse(p.createdAt) > fresh), label: "Add a page", run: () => openForm({ kind: "sitePage" }) },
      { id: "post", title: "Write your first post", why: "Posts are written in plain text with simple formatting and show up on your blog and course pages.", done: !!post, label: "New post", run: () => navigate(`/cms/posts/${createDraft({ siteId: site.id }).id}`) },
      { id: "details", title: "Add your domain and footer", why: "So the sitemap, links and footer say the right things.", done: !!site.domain.trim() && !!site.footerText.trim(), label: "Site settings", run: () => onPanel("settings") },
      { id: "files", title: "Check it and publish", why: "Blackwall looks for problems, then publishes the site or gives you the files for your host.", done: !!site.exportedAt || !!site.publishedAt, label: "Publish", run: () => onPanel("files") },
    ]
  }, [site, pages, drafts, forms, assets, openForm, createDraft, navigate, onPanel])

  const [open, setOpen] = useState(false)
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  const showCount = !site.guideHidden && done < steps.length
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={showCount ? "outline" : "quiet"} size="sm" aria-label={`Set up your site, ${done} of ${steps.length} done`} title="Set up your site"><ListChecks /><span className="hidden @5xl/top:inline">Setup</span>{showCount && <span className="tabular-nums">{done}/{steps.length}</span>}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] gap-0 p-0">
        <div className="flex items-baseline justify-between px-3.5 pt-3 pb-2"><b className="text-[13px] text-ink">Set up your site</b><span className="text-[11px] text-muted-foreground">{done} of {steps.length} done</span></div>
        <div className="h-1 bg-well" aria-hidden><div className="h-full bg-[var(--bw-category)] transition-[width]" data-category="website" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <ol className="max-h-[60dvh] divide-y divide-line-soft overflow-y-auto">
          {steps.map((s) => (
            <li key={s.id} className={cn("flex items-center gap-3 px-3.5 py-2.5", s === next && "bg-raised/60")} data-testid={`guide-${s.id}`} data-done={s.done}>
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", s.done ? "border-transparent bg-green/20 text-green" : "border-line text-transparent")} aria-hidden><Check className="size-3" /></span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-semibold", s.done ? "text-muted-foreground line-through decoration-faint" : "text-ink")}>{s.title}</span>
                {(!s.done || s === next) && <span className="block text-xs leading-snug text-muted-foreground">{s.why}</span>}
              </span>
              {s.done ? <span className="sr-only">Done</span> : <Button size="xs" variant={s === next ? "default" : "outline"} onClick={() => { setOpen(false); s.run() }}>{s.label}<ChevronRight /></Button>}
            </li>
          ))}
        </ol>
        <div className="border-t border-line-soft px-2 py-1.5"><Button variant="quiet" size="xs" className="text-muted-foreground" onClick={() => update("sites", site.id, { guideHidden: !site.guideHidden })}>{site.guideHidden ? "Show the count in the top bar" : "Hide the count from the top bar"}</Button></div>
      </PopoverContent>
    </Popover>
  )
}
