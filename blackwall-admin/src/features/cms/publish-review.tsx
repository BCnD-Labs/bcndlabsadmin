import { ChevronDown, ChevronRight, GitPullRequest, Rocket, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { lineDiff, type PlanFile } from "@shared/publish-plan"
import { closeReview as close, useReview } from "@/services/publish-review"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const STATUS = { added: "Added", changed: "Changed", removed: "Removed" } as const
const WHY = { "not-blackwalls": "Isn't Blackwall's: publishing replaces your file", "edited-elsewhere": "Edited since Blackwall wrote it: publishing replaces your edit" } as const

function FileRow({ file, agreed, onAgree }: { file: PlanFile; agreed: boolean; onAgree: (yes: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => (open && !file.hidden ? lineDiff(file.before ?? "", file.after ?? "") : []), [open, file])
  return (
    <li className="border-t border-line-soft first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} changes to ${file.path}`} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          <span className={cn("shrink-0 rounded-full px-1.5 text-[10px] font-bold uppercase", file.status === "removed" ? "bg-red-text/15 text-red-text" : file.status === "added" ? "bg-green/15 text-green" : "bg-amber/15 text-amber")}>{STATUS[file.status]}</span>
          <span className="truncate font-mono text-[12px] text-ink">{file.path}</span>
        </button>
        {file.conflict && (
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-amber" title={WHY[file.conflict]}>
            <Checkbox checked={agreed} onCheckedChange={(v) => onAgree(v === true)} aria-label={`Replace ${file.path}`} /> Replace
          </label>
        )}
      </div>
      {file.conflict && <p className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] text-amber"><TriangleAlert className="size-3" />{WHY[file.conflict]}</p>}
      {open && (
        <div className="max-h-64 overflow-auto border-t border-line-soft bg-well px-0 py-1 font-mono text-[11.5px] leading-snug">
          {file.hidden ? <p className="px-3 py-2 text-muted-foreground">This file isn't shown as text (a picture, or too large).</p> : rows.map((r, i) =>
            r.kind === "gap" ? <p key={i} className="px-3 text-faint">… {r.hidden} unchanged {r.hidden === 1 ? "line" : "lines"}</p> : (
              <pre key={i} className={cn("px-3 whitespace-pre-wrap", r.kind === "add" && "bg-green/10 text-green", r.kind === "del" && "bg-red-text/10 text-red-text")}>{r.kind === "add" ? "+ " : r.kind === "del" ? "- " : "  "}{r.text}</pre>
            ))}
        </div>
      )}
    </li>
  )
}

/** Mounted once for the whole app. */
export function PublishReviewHost() {
  const { req, plan, error, busy } = useReview()
  const [agreed, setAgreed] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<"direct" | "pr">("direct")
  const conflicts = plan?.files.filter((f) => f.conflict) ?? []
  const ready = !!plan && conflicts.every((f) => agreed.has(f.path))
  const counts = plan ? (["added", "changed", "removed"] as const).map((s) => [s, plan.files.filter((f) => f.status === s).length] as const).filter(([, n]) => n) : []
  const go = async () => {
    if (!req || !plan) return
    useReview.setState({ busy: true, error: undefined })
    try {
      close(await req.run({ mode, expectedHead: plan.head, acknowledge: [...agreed] }))
    } catch (e) {
      useReview.setState({ busy: false, error: (e as Error).message })
    }
  }
  return (
    <Dialog open={!!req} onOpenChange={(o) => { if (!o && !busy) close() }}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" aria-describedby="review-about">
        <div className="border-b border-line py-3 pr-12 pl-4">
          <DialogTitle className="font-heading text-base font-bold">{req?.title ?? "Review changes"}</DialogTitle>
          <DialogDescription id="review-about" className="text-xs">Nothing is written until you confirm. Open a file to see exactly what changes in it.</DialogDescription>
        </div>
        <div className="grid max-h-[70dvh] gap-3 overflow-y-auto px-4 py-3">
          {!plan ? <p className="py-6 text-center text-sm text-muted-foreground">Working out what would change…</p> : plan.files.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-testid="review-empty">Nothing would change: the repository already matches. {plan.unchanged ? `${plan.unchanged} files are identical.` : ""}</p>
          ) : (
            <>
              <p className="text-[13px] text-ink" data-testid="review-summary">{plan.files.length} {plan.files.length === 1 ? "file" : "files"}: {counts.map(([s, n]) => `${n} ${s}`).join(", ")}{plan.unchanged ? ` · ${plan.unchanged} unchanged` : ""}</p>
              <ul className="overflow-hidden rounded-[8px] border border-line-soft" aria-label="Files that would change">
                {plan.files.map((f) => <FileRow key={f.path} file={f} agreed={agreed.has(f.path)} onAgree={(yes) => setAgreed((s) => { const n = new Set(s); if (yes) n.add(f.path); else n.delete(f.path); return n })} />)}
              </ul>
              {conflicts.length > 0 && <p className="flex items-start gap-1.5 text-[12px] text-amber"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {conflicts.length === 1 ? "One file isn't" : `${conflicts.length} files aren't`} Blackwall's to replace. Tick Replace to agree, or cancel and change {conflicts.length === 1 ? "it" : "them"} in the repository first.</p>}
              <div role="radiogroup" aria-label="Where to put it" className="grid gap-1.5 sm:grid-cols-2">
                {([["direct", Rocket, `Commit to ${req?.branch ?? "the branch"}`, "Goes live when your host deploys."], ["pr", GitPullRequest, "Open a pull request", "Goes to a new branch; nothing changes until you merge it."]] as const).map(([v, Icon, label, about]) => (
                  <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn("rounded-xl bg-raised px-3 py-2 text-left", mode === v && "ring-2 ring-[var(--bw-red)]")}>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"><Icon className="size-3.5" />{label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{about}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p role="alert" className="text-[12.5px] text-red-text">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="outline" disabled={busy} onClick={() => close()}>Cancel</Button>
          <Button disabled={!plan || plan.files.length === 0 || !ready || busy} onClick={() => void go()}>{busy ? "Working…" : mode === "pr" ? "Open pull request" : "Publish"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
