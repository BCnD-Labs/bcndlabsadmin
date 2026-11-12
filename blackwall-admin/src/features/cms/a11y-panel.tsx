import { AlertTriangle, CircleCheck, CircleX, Contrast, ListTree } from "lucide-react"
import { useMemo, useState } from "react"
import { A11Y_KINDS, auditSite, type A11yItem, type A11yKind } from "@shared/site-a11y"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import type { Site } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

/** WAVE's five kinds, in the order WAVE lists them. The badge colours are also what the page marks use. */
export const KIND_INFO: Record<A11yKind, { title: string; one: string; icon: typeof CircleX; tone: string; badge: string; glyph: string }> = {
  error: { title: "Errors", one: "Fix these. They stop some people using the page.", icon: CircleX, tone: "text-red-text", badge: "#d62d20", glyph: "✕" },
  contrast: { title: "Contrast errors", one: "Text that is too faint against its background.", icon: Contrast, tone: "text-red-text", badge: "#8e1b13", glyph: "◐" },
  alert: { title: "Alerts", one: "Worth a look. They may or may not be a problem.", icon: AlertTriangle, tone: "text-amber", badge: "#e0a800", glyph: "!" },
  feature: { title: "Features", one: "Things that are already right.", icon: CircleCheck, tone: "text-green", badge: "#1e8e3e", glyph: "✓" },
  structure: { title: "Structure", one: "The headings, as a screen reader hears them.", icon: ListTree, tone: "text-muted-foreground", badge: "#3b6fe0", glyph: "§" },
}

/** The accessibility check, WAVE-style: counts by kind, a list to work through, and marks on the page itself. */
export function A11yPanel({ site, pageId, marks, onMarks, onShow }: { site: Site; pageId?: string; marks: boolean; onMarks: (on: boolean) => void; onShow: (item: A11yItem) => void }) {
  const pages = useWorkspace((s) => s.pages)
  const assets = useWorkspace((s) => s.assets)
  const drafts = useWorkspace((s) => s.drafts)
  const [scope, setScope] = useState<"page" | "site">("page")
  const report = useMemo(() => auditSite(site, pages, assets, drafts), [site, pages, assets, drafts])
  const shown = report.items.filter((i) => scope === "site" || !i.pageId || i.pageId === pageId)
  const counts = Object.fromEntries(A11Y_KINDS.map((k) => [k, shown.filter((i) => i.kind === k).length])) as Record<A11yKind, number>
  const [open, setOpen] = useState<A11yKind | null>(null)
  const first = A11Y_KINDS.find((k) => k !== "feature" && k !== "structure" && counts[k] > 0)
  const expanded = open ?? first ?? "feature"

  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]" data-testid="a11y-panel">
      <Panel category="website" title="Accessibility" meta="like WAVE" bodyClassName="grid gap-3 px-3.5 py-3">
        <SegmentedTabs label="What to check" value={scope} onChange={setScope} tabs={[{ value: "page", label: "This page" }, { value: "site", label: "Whole site" }]} tabClassName="flex-1" />
        <div className="grid grid-cols-5 gap-1.5" role="list" aria-label="Results">
          {A11Y_KINDS.map((k) => {
            const I = KIND_INFO[k]
            return (
              <button key={k} type="button" role="listitem" onClick={() => setOpen(k)} aria-pressed={expanded === k} title={`${I.title}: ${I.one}`} className={cn("grid justify-items-center gap-0.5 rounded-[8px] bg-raised px-1 py-1.5 transition-colors hover:bg-selected", expanded === k && "ring-2 ring-[var(--bw-red)]")}>
                <I.icon className={cn("size-4", I.tone)} aria-hidden />
                <span className={cn("text-base leading-none font-semibold tabular-nums", I.tone)}>{counts[k]}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{I.title.replace(" errors", "")}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2"><Switch id="a11y-marks" checked={marks} onCheckedChange={onMarks} /><Label htmlFor="a11y-marks" className="text-xs font-normal">Show these as marks on the page</Label></div>
        {!counts.error && !counts.contrast && <p className="rounded-[8px] bg-raised px-2.5 py-2 text-xs text-ink">No errors{scope === "page" ? " on this page" : ""}. {counts.alert ? `${counts.alert} ${counts.alert === 1 ? "alert is" : "alerts are"} worth a look.` : "Nothing to look at."} Run WAVE on the live site for the final word.</p>}
      </Panel>
      <Panel category="website" title={KIND_INFO[expanded].title} meta={KIND_INFO[expanded].one} bodyClassName="divide-y divide-line-soft">
        {shown.filter((i) => i.kind === expanded).map((item, n) => {
          const I = KIND_INFO[item.kind]
          const go = !!(item.blockId || item.area || item.pageId)
          const body = <><I.icon className={cn("mt-0.5 size-3.5 shrink-0", I.tone)} aria-hidden /><span className={cn("min-w-0 flex-1 text-xs leading-snug", item.kind === "structure" && "font-mono whitespace-pre")}>{item.text}</span></>
          return go
            ? <button key={n} type="button" onClick={() => onShow(item)} className="flex w-full items-start gap-2 px-3.5 py-2 text-left transition-colors hover:bg-selected">{body}</button>
            : <div key={n} className="flex items-start gap-2 px-3.5 py-2">{body}</div>
        })}
        {!shown.some((i) => i.kind === expanded) && <p className="px-3.5 py-3 text-xs text-muted-foreground">Nothing here{scope === "page" ? " for this page" : ""}.</p>}
      </Panel>
      <Panel category="website" title="What this can't check" bodyClassName="px-3.5 py-3">
        <ul className="grid list-disc gap-1 pl-4 text-xs text-muted-foreground">{report.unchecked.map((u) => <li key={u}>{u}</li>)}</ul>
      </Panel>
    </div>
  )
}
