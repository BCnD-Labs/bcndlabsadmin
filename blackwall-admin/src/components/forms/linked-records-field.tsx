import { FileText, Globe, ListChecks, NotebookPen, PenLine, X } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { draftHref, sitePageHref } from "@/lib/routes"
import type { RecordLink, Task } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { MAX_RECORD_LINKS, hasLink, noteTitle, withLink } from "@shared/links"

const SELECT = "h-9 w-full rounded-md border border-line bg-well px-2 text-[13px] text-ink"

/** Notes, other tasks and day logs this task is linked to. Linking is the same record the Planner uses; "Linked from" shows tasks that point here. */
export function LinkedRecordsField({ value, onChange, selfId, backlinks = [], onOpenSite }: { value: RecordLink[]; onChange: (next: RecordLink[]) => void; selfId?: string; backlinks?: Task[]; /** Open a linked page or post in its editor. */ onOpenSite?: (href: string) => void }) {
  const notes = useWorkspace((s) => s.notes)
  const tasks = useWorkspace((s) => s.tasks)
  const sites = useWorkspace((s) => s.sites)
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const posts = useMemo(() => drafts.filter((d) => d.siteId && d.kind === "post"), [drafts])
  const options = useMemo(() => ({
    notes: notes.filter((n) => !hasLink(value, "note", n.id)).slice(0, 150),
    tasks: tasks.filter((t) => t.id !== selfId && t.kind !== "event" && !hasLink(value, "task", t.id)).slice(0, 150),
  }), [notes, tasks, value, selfId])
  const label = (l: RecordLink): { text: string; icon: typeof Globe; href?: string } => {
    if (l.kind === "note") { const n = notes.find((x) => x.id === l.id); return { text: n ? noteTitle(n) : "Deleted note", icon: NotebookPen } }
    if (l.kind === "task") { const t = tasks.find((x) => x.id === l.id); return { text: t ? t.title : "Deleted task", icon: ListChecks } }
    if (l.kind === "page") { const p = pages.find((x) => x.id === l.id); return { text: p ? p.title || "Untitled page" : "Deleted page", icon: Globe, href: p && sitePageHref(p.id) } }
    if (l.kind === "post") { const d = drafts.find((x) => x.id === l.id); return { text: d ? d.title || "Untitled post" : "Deleted post", icon: PenLine, href: d && draftHref(d.id) } }
    return { text: `Log: ${l.id}`, icon: FileText }
  }
  const add = (raw: string) => {
    const [kind, id] = raw.split(":") as [RecordLink["kind"], string]
    if (id) onChange(withLink(value, { kind, id }, true))
  }
  return (
    <div className="grid gap-2" data-testid="linked-records">
      {value.length > 0 && (
        <ul className="grid gap-1">{value.map((l) => {
          const { text, icon: Icon, href } = label(l)
          return <li key={`${l.kind}:${l.id}`} className="flex items-center gap-2 rounded-md border border-line-soft px-2 py-1 text-[13px]"><Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />{href && onOpenSite ? <button type="button" className="min-w-0 flex-1 truncate text-ink-2 text-left hover:underline" onClick={() => onOpenSite(href)}>{text}</button> : <span className="min-w-0 flex-1 truncate text-ink-2">{text}</span>}<Button type="button" variant="quiet" size="icon-sm" aria-label={`Unlink ${text}`} onClick={() => onChange(withLink(value, l, false))}><X /></Button></li>
        })}</ul>
      )}
      <select aria-label="Link a note or task" className={SELECT} value="" disabled={value.length >= MAX_RECORD_LINKS} onChange={(e) => add(e.target.value)}>
        <option value="">+ Link a note or task…</option>
        {options.notes.length > 0 && <optgroup label="Notes">{options.notes.map((n) => <option key={n.id} value={`note:${n.id}`}>{noteTitle(n).slice(0, 80)}</option>)}</optgroup>}
        {options.tasks.length > 0 && <optgroup label="Tasks and coursework">{options.tasks.map((t) => <option key={t.id} value={`task:${t.id}`}>{t.title.slice(0, 80)}</option>)}</optgroup>}
      </select>
      {sites.length > 0 && (
        <select aria-label="Link a page or post" className={SELECT} value="" disabled={value.length >= MAX_RECORD_LINKS} onChange={(e) => add(e.target.value)}>
          <option value="">+ Link a page or post…</option>
          {sites.map((site) => {
            const ownPages = pages.filter((p) => p.siteId === site.id && !hasLink(value, "page", p.id)).sort((a, b) => a.order - b.order)
            const ownPosts = posts.filter((d) => d.siteId === site.id && !hasLink(value, "post", d.id))
            return (ownPages.length > 0 || ownPosts.length > 0) && <optgroup key={site.id} label={site.name}>
              {ownPages.map((p) => <option key={p.id} value={`page:${p.id}`}>Page: {(p.title || "Untitled").slice(0, 70)}</option>)}
              {ownPosts.map((d) => <option key={d.id} value={`post:${d.id}`}>Post: {(d.title || "Untitled").slice(0, 70)}</option>)}
            </optgroup>
          })}
        </select>
      )}
      {backlinks.length > 0 && <p className="text-[11px] text-muted-foreground">Linked from: {backlinks.map((t) => t.title).join(", ")}</p>}
    </div>
  )
}
