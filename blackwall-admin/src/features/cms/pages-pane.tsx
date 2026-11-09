import { Copy, Eye, EyeOff, FileText, Home, MoreHorizontal, PenLine, Plus, Trash2 } from "lucide-react"
import { useMemo, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { canNest, movePage, pageTree, type TreeRow } from "@shared/sitebuilder-tree"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { draftHref, cmsPagesHref, sitePageHref } from "@/lib/routes"
import type { Site, SitePage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useNewPost } from "./posts-panel"
import { SortableTree } from "./sortable-tree"
import { duplicatePage } from "./use-cms"
import type { WorkspacePanel } from "./site-workspace"

type PageRow = TreeRow & { page: SitePage }

export function placePage(pages: SitePage[], id: string, parentId: string | null, beforeId: string | null) {
  const { update } = useWorkspace.getState()
  for (const { id: pid, order, parentId: parent } of movePage(pages, id, parentId, beforeId)) update("pages", pid, { order, parentId: parent })
}

export function PaneHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="flex h-8 shrink-0 items-center justify-between gap-2 pr-1.5 pl-3"><h2 className="bw-label">{title}</h2><span className="flex items-center gap-0.5">{children}</span></div>
}

/** Pages: the site's pages in menu order (drag to reorder, drag right to make a drop-down), then its posts. */
export function PagesPane({ site, pages, currentId, onDragging, onPanel }: { site: Site; pages: SitePage[]; currentId?: string; onDragging: (on: boolean) => void; onPanel: (p: WorkspacePanel) => void }) {
  const { update, remove } = useWorkspace.getState()
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const drafts = useWorkspace((s) => s.drafts)
  const newPost = useNewPost(site)
  const posts = useMemo(() => drafts.filter((d) => d.siteId === site.id && d.kind === "post").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [drafts, site.id])
  const rows = useMemo<PageRow[]>(() => pageTree(pages).flatMap(({ page, kids }) => [{ id: page.id, depth: 0, parentId: null, page }, ...kids.map((k) => ({ id: k.id, depth: 1, parentId: page.id, page: k }))]), [pages])

  const del = (p: SitePage) => {
    remove("pages", p.id)
    if (p.id === currentId) navigate(cmsPagesHref)
    toast(`${p.title} deleted`, { description: "It leaves the site when you next get the files.", action: { label: "Undo", onClick: () => useWorkspace.setState((st) => ({ pages: [p, ...st.pages] })) } })
  }

  /** Alt+arrows, for doing without a mouse what dragging does. */
  const onKey = (row: PageRow, e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) return void navigate(sitePageHref(row.id))
    if (!e.altKey || !e.key.startsWith("Arrow")) return
    e.preventDefault()
    e.stopPropagation()
    const sibs = rows.filter((r) => r.parentId === row.parentId)
    const i = sibs.findIndex((r) => r.id === row.id)
    if (e.key === "ArrowUp" && i > 0) placePage(pages, row.id, row.parentId, sibs[i - 1].id)
    if (e.key === "ArrowDown" && i < sibs.length - 1) placePage(pages, row.id, row.parentId, sibs[i + 2]?.id ?? null)
    if (e.key === "ArrowRight" && !row.parentId && i > 0 && canNest(row.page, pages)) placePage(pages, row.id, sibs[i - 1].id, null)
    if (e.key === "ArrowLeft" && row.parentId) placePage(pages, row.id, null, rows.filter((r) => !r.parentId)[rows.filter((r) => !r.parentId).findIndex((r) => r.id === row.parentId) + 1]?.id ?? null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="pages-pane">
      <PaneHead title="Pages"><Button variant="quiet" size="icon-xs" aria-label="New page" title="New page" onClick={() => openForm({ kind: "sitePage" })}><Plus /></Button></PaneHead>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {rows.length ? (
          <SortableTree<PageRow> rows={rows} label="Pages" selectedId={currentId} onDragging={onDragging} onRowKey={onKey}
            canDrop={(active, parent) => parent === null || (parent.depth === 0 && canNest(active.page, pages))}
            onMove={(id, parentId, beforeId) => placePage(pages, id, parentId, beforeId)}
            render={({ page: p }) => (
              <>
                <button type="button" tabIndex={-1} onClick={() => navigate(sitePageHref(p.id))} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
                  {p.slug ? <FileText className="size-3.5 shrink-0 text-faint" /> : <Home className="size-3.5 shrink-0 text-faint" />}
                  <span className={cn("min-w-0 truncate text-[12.5px]", p.id === currentId ? "font-semibold text-ink" : "text-ink-2")}>{p.title || "Untitled"}</span>
                  {!p.inMenu && <EyeOff className="size-3 shrink-0 text-faint" aria-label="Not in the menu" />}
                </button>
                <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="quiet" size="icon-xs" aria-pressed={p.inMenu} aria-label={p.inMenu ? `Hide ${p.title} from the menu` : `Show ${p.title} in the menu`} title={p.inMenu ? "In the menu" : "Not in the menu"} onClick={() => update("pages", p.id, { inMenu: !p.inMenu })}>{p.inMenu ? <Eye /> : <EyeOff />}</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="quiet" size="icon-xs" aria-label={`Actions for ${p.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => { const c = duplicatePage(p); toast.success(`Duplicated as ${c.title}`); navigate(sitePageHref(c.id)) }}><Copy /> Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-text" disabled={!p.slug} onSelect={() => del(p)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </>
            )}
          />
        ) : <p className="px-2 py-3 text-xs text-muted-foreground">No pages yet.</p>}
        <div className="mt-2 flex items-center justify-between pr-0.5 pl-1.5"><h2 className="bw-label">Posts</h2><Button variant="quiet" size="icon-xs" aria-label="New post" title="New post" onClick={newPost}><Plus /></Button></div>
        <ul className="mt-0.5 grid min-w-0 gap-px">
          {posts.slice(0, 8).map((d) => (
            <li key={d.id}><button type="button" onClick={() => navigate(draftHref(d.id))} className="flex w-full min-w-0 items-center gap-1.5 rounded-[6px] py-1 pr-1 pl-1 text-left hover:bg-raised"><PenLine className="size-3.5 shrink-0 text-faint" /><span className="min-w-0 truncate text-[12.5px] text-ink-2">{d.title || "Untitled"}</span>{!d.publishedAt && <span className="ml-auto shrink-0 text-[10px] text-faint">draft</span>}</button></li>
          ))}
        </ul>
        {posts.length ? <Button variant="quiet" size="xs" className="mt-0.5 text-muted-foreground" onClick={() => onPanel("posts")}>All posts ({posts.length})</Button> : <p className="px-1.5 py-1 text-xs text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  )
}
