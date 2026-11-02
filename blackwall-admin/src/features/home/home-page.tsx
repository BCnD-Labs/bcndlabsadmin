import { useState, type DragEvent, type ReactNode } from "react"
import { ChevronDown, ChevronUp, EyeOff, GripVertical, Plus, RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { BLOCK_LABELS, DEFAULT_LAYOUT, moveBlock, patchBlock, stepBlock, type BlockId, type BlockWidth, type LayoutItem } from "@/lib/home-layout"
import { usePrefs } from "@/stores/prefs"
import { PANELS } from "./panel-registry"
import { DailyLogPanel, LinkedServicesPanel, ProjectsPanel } from "./workspace-context"
import { PullRequestsPanel, RepositoriesPanel, ThisWeekPanel } from "./overview-panels"

/** Home modules that come from the panel registry (title, icon, header meta and body). */
function ModulePanel({ id }: { id: "productivity" | "coursework" | "calendar" | "development" | "website" | "analytics" }) {
  const def = PANELS[id]
  const { Body, Meta } = def
  return (
    <Panel className="flex-1" tool={def.tool} command={def.command} title={def.label} category={def.category} meta={Meta && <Meta />} bodyClassName={cn("@container flex min-h-0 flex-1 flex-col overflow-y-auto", def.bodyClassName)}>
      <Body slot={0} />
    </Panel>
  )
}

function Block({ id }: { id: BlockId }) {
  switch (id) {
    case "prs": return <PullRequestsPanel />
    case "week": return <ThisWeekPanel />
    case "repos": return <RepositoriesPanel />
    case "projects": return <ProjectsPanel />
    case "log": return <DailyLogPanel />
    case "services": return <LinkedServicesPanel />
    default: return <ModulePanel id={id} />
  }
}

const SPAN: Record<BlockWidth, string> = { narrow: "", wide: "@2xl/main:col-span-2", full: "col-span-full" }
const WIDTH_LABEL: Record<BlockWidth, string> = { narrow: "Narrow", wide: "Wide", full: "Full" }
const MIME = "application/x-blackwall-block"

/**
 * Home: every block from your saved layout, in order, at its width (narrow = one column,
 * wide = two, full = the row). Customize switches to edit mode: drag to reorder, change
 * width, hide, or bring hidden panels back. The same choices live in Settings → Dashboard.
 */
export function HomePage() {
  const layout = usePrefs((s) => s.homeLayout)
  const set = usePrefs((s) => s.set)
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState<BlockId | null>(null)
  const [over, setOver] = useState<BlockId | null>(null)
  const save = (next: LayoutItem[]) => set({ homeLayout: next })
  const visible = layout.filter((b) => b.visible)
  const hidden = layout.filter((b) => !b.visible)

  const dropOn = (target: BlockId) => (e: DragEvent) => {
    e.preventDefault()
    const from = e.dataTransfer.getData(MIME) as BlockId
    if (from && from !== target) save(moveBlock(layout, from, target))
    setDragging(null)
    setOver(null)
  }

  return (
    <div className="@container/main mx-auto grid w-full max-w-[var(--bw-page-max)] pb-6" style={{ gap: "var(--bw-grid-gap)" }}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <>
            <p className="mr-auto text-xs text-muted-foreground">Drag panels to reorder. Width and hide controls sit on each panel. Changes save as you go.</p>
            <Button variant="quiet" size="sm" onClick={() => save(DEFAULT_LAYOUT.map((b) => ({ ...b })))}><RotateCcw /> Reset layout</Button>
            <Button size="sm" onClick={() => setEditing(false)}>Done</Button>
          </>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => setEditing(true)}><SlidersHorizontal /> Customize</Button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start @2xl/main:grid-cols-2 @5xl/main:grid-cols-3" style={{ gap: "var(--bw-grid-gap)" }} data-testid="home-grid">
        {visible.map((b, i) => (
          <div
            key={b.id}
            data-block={b.id}
            className={cn("relative flex min-w-0 flex-col", SPAN[b.width], dragging === b.id && "opacity-40")}
            draggable={editing}
            onDragStart={(e) => { e.dataTransfer.setData(MIME, b.id); e.dataTransfer.effectAllowed = "move"; setDragging(b.id) }}
            onDragEnd={() => { setDragging(null); setOver(null) }}
            onDragOver={(e) => { if (editing && dragging && dragging !== b.id) { e.preventDefault(); setOver(b.id) } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === b.id ? null : o)) }}
            onDrop={editing ? dropOn(b.id) : undefined}
          >
            <div className={cn("flex min-h-0 flex-1 flex-col", editing && "pointer-events-none select-none")} inert={editing || undefined}>
              <Block id={b.id} />
            </div>
            {editing && (
              <EditFrame active={over === b.id}>
                <span className="flex cursor-grab items-center gap-1.5 pl-1 text-xs font-medium text-ink active:cursor-grabbing" title="Drag to move">
                  <GripVertical className="size-4 text-muted-foreground" aria-hidden />{BLOCK_LABELS[b.id]}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Button variant="quiet" size="icon-sm" aria-label={`Move ${BLOCK_LABELS[b.id]} earlier`} disabled={i === 0} onClick={() => save(stepBlock(layout, b.id, -1))}><ChevronUp /></Button>
                  <Button variant="quiet" size="icon-sm" aria-label={`Move ${BLOCK_LABELS[b.id]} later`} disabled={i === visible.length - 1} onClick={() => save(stepBlock(layout, b.id, 1))}><ChevronDown /></Button>
                  <span role="radiogroup" aria-label={`${BLOCK_LABELS[b.id]} width`} className="flex rounded-full bg-well p-0.5">
                    {(["narrow", "wide", "full"] as const).map((w) => (
                      <button key={w} type="button" role="radio" aria-checked={b.width === w} onClick={() => save(patchBlock(layout, b.id, { width: w }))}
                        className={cn("h-7 rounded-full px-2.5 text-xs", b.width === w ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}>{WIDTH_LABEL[w]}</button>
                    ))}
                  </span>
                  <Button variant="quiet" size="icon-sm" aria-label={`Hide ${BLOCK_LABELS[b.id]}`} onClick={() => save(patchBlock(layout, b.id, { visible: false }))}><EyeOff /></Button>
                </span>
              </EditFrame>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <section aria-label="Hidden panels" className="rounded-2xl border border-dashed border-ledge-hi p-4">
          <p className="mb-3 text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Hidden panels</p>
          {hidden.length ? (
            <div className="flex flex-wrap gap-2">
              {hidden.map((b) => (
                <Button key={b.id} variant="outline" size="sm" onClick={() => save(patchBlock(layout, b.id, { visible: true }))}><Plus /> {BLOCK_LABELS[b.id]}</Button>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Every panel is on Home.</p>}
        </section>
      )}
    </div>
  )
}

function EditFrame({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className={cn("absolute inset-0 rounded-[var(--bw-panel-radius)] outline-2 -outline-offset-2 outline-dashed transition-colors duration-150", active ? "bg-ink-2/5 outline-ink-2" : "outline-ledge-hi")}>
      <div className="absolute inset-x-2 top-2 flex flex-wrap items-center gap-1 rounded-xl bg-raised/95 p-1 shadow-[var(--bw-shadow-float)] backdrop-blur-sm">{children}</div>
    </div>
  )
}
