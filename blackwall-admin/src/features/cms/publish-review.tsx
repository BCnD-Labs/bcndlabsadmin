import { ChevronDown, ChevronRight, GitBranch, GitPullRequest, Globe, Rocket, TriangleAlert, UserRound } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { lineDiff, type PlanFile } from "@shared/publish-plan"
import { closeReview as close, useReview } from "@/services/publish-review"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="grid gap-1 text-[12px] font-semibold text-ink">{label}{children}</label>
)

/** Mounted once for the whole app. Step 1: the changes and the commit message. Step 2: where it goes (the branch, or a pull request with its own wording). */
export function PublishReviewHost() {
  const { req, plan, error, busy } = useReview()
  const [agreed, setAgreed] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<"direct" | "pr">("direct")
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState<{ message?: string; prTitle?: string; prBody?: string; branch?: string }>({})
  // A new review starts from the top; the owner's own wording is kept while they go back and forth or re-review.
  useEffect(() => { setAgreed(new Set()); setMode("direct"); setStep(1); setTyped({}) }, [req])
  const message = typed.message ?? plan?.suggested.message ?? ""
  const prTitle = typed.prTitle ?? (typed.message !== undefined ? typed.message.split("\n")[0] : plan?.suggested.prTitle) ?? ""
  const prBody = typed.prBody ?? plan?.suggested.prBody ?? ""
  const branchName = typed.branch ?? plan?.suggested.branch ?? ""
  const target = plan?.target
  const where = target ? `${target.repo}@${target.branch}` : "the repository"
  const conflicts = plan?.files.filter((f) => f.conflict) ?? []
  const changes = !!plan && plan.files.length > 0
  const stepOne = changes && conflicts.every((f) => agreed.has(f.path)) && message.trim().length > 0
  const ready = stepOne && (mode === "direct" || (branchName.trim().length > 0 && prTitle.trim().length > 0))
  const counts = plan ? (["added", "changed", "removed"] as const).map((s) => [s, plan.files.filter((f) => f.status === s).length] as const).filter(([, n]) => n) : []
  const replan = () => {
    if (!req) return
    useReview.setState({ plan: undefined, error: undefined })
    setStep(1)
    req.plan().then((p) => useReview.setState({ plan: p }), (e: Error) => useReview.setState({ error: e.message }))
  }
  const go = async () => {
    if (!req || !plan) return
    useReview.setState({ busy: true, error: undefined })
    try {
      close(await req.run({ mode, expectedHead: plan.head, token: plan.token, acknowledge: [...agreed], message: message.trim(), ...(plan.stamp ? { stamp: plan.stamp } : {}), ...(mode === "pr" ? { prTitle: prTitle.trim(), prBody, branch: branchName.trim() } : {}) }))
    } catch (e) {
      useReview.setState({ busy: false, error: (e as Error).message })
    }
  }
  const stale = !!error && /review them again|no longer the ones|branch changed/i.test(error)
  return (
    <Dialog open={!!req} onOpenChange={(o) => { if (!o && !busy) close() }}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" aria-describedby="review-about">
        <div className="border-b border-line py-3 pr-12 pl-4">
          <DialogTitle className="font-heading text-base font-bold">{req?.title ?? "Review changes"}</DialogTitle>
          <DialogDescription id="review-about" className="text-xs">Nothing is written until you confirm. {step === 1 ? "Open a file to see exactly what changes in it, then write the commit message." : "Choose how it reaches the repository."}</DialogDescription>
        </div>
        {target && (
          <div className="grid gap-1 border-b border-line bg-raised px-4 py-2.5 text-[12.5px]" data-testid="review-target">
            <p className="flex items-center gap-1.5 text-ink"><GitBranch className="size-3.5 shrink-0" /><b className="font-mono text-[13px]" data-testid="review-repo">{target.repo}</b><span className="text-muted-foreground">branch</span><b className="font-mono" data-testid="review-branch">{target.branch}</b></p>
            <p className="flex items-center gap-1.5 text-ink-2"><Globe className="size-3.5 shrink-0" /><span className="text-muted-foreground">Public site</span><span className="truncate font-mono" data-testid="review-url">{target.siteUrl || "not set"}</span></p>
            <p className="flex items-center gap-1.5 text-ink-2" data-testid="review-action">{mode === "pr" ? <GitPullRequest className="size-3.5 shrink-0" /> : <Rocket className="size-3.5 shrink-0" />}{mode === "pr" ? <>Opens a pull request into <b className="font-mono">{target.branch}</b>; nothing changes until it is merged.</> : <>Commits straight to <b className="font-mono">{target.branch}</b>; it goes live when your host deploys.</>}</p>
          </div>
        )}
        <div className="grid max-h-[62dvh] gap-3 overflow-y-auto px-4 py-3">
          {!plan ? <p className="py-6 text-center text-sm text-muted-foreground">{error ? "" : "Working out what would change…"}</p> : !changes ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-testid="review-empty">Nothing would change: the repository already matches. {plan.unchanged ? `${plan.unchanged} files are identical.` : ""}</p>
          ) : step === 1 ? (
            <>
              {plan.warnings.map((w) => <p key={w.code} className="flex items-start gap-1.5 text-[12px] text-amber" role="status"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{w.message}</p>)}
              <p className="text-[13px] text-ink" data-testid="review-summary">{plan.files.length} {plan.files.length === 1 ? "file" : "files"}: {counts.map(([s, n]) => `${n} ${s}`).join(", ")}{plan.unchanged ? ` · ${plan.unchanged} unchanged` : ""}</p>
              {req?.preview && <img src={req.preview.src} alt={req.preview.alt} className="max-h-40 w-fit rounded-md border border-line-soft object-contain" />}
              <ul className="overflow-hidden rounded-[8px] border border-line-soft" aria-label="Files that would change">
                {plan.files.map((f) => <FileRow key={f.path} file={f} agreed={agreed.has(f.path)} onAgree={(yes) => setAgreed((s) => { const n = new Set(s); if (yes) n.add(f.path); else n.delete(f.path); return n })} />)}
              </ul>
              {conflicts.length > 0 && <p className="flex items-start gap-1.5 text-[12px] text-amber"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {conflicts.length === 1 ? "One file isn't" : `${conflicts.length} files aren't`} Blackwall's to replace. Tick Replace to agree, or cancel and change {conflicts.length === 1 ? "it" : "them"} in the repository first.</p>}
              <Field label="Commit message">
                <Textarea value={message} onChange={(e) => setTyped((t) => ({ ...t, message: e.target.value }))} rows={3} maxLength={5000} aria-label="Commit message" data-testid="review-message" className="font-mono text-[12.5px] font-normal" />
              </Field>
              <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground" data-testid="review-author"><UserRound className="size-3.5" />{plan.author ? <>Committed as {plan.author.name} &lt;{plan.author.email}&gt;</> : "Committed as the account the token belongs to."}</p>
            </>
          ) : (
            <>
              <div role="radiogroup" aria-label="Where to put it" className="grid gap-1.5 sm:grid-cols-2">
                {([["direct", Rocket, `Commit to ${target?.branch ?? "the branch"}`, "Goes live when your host deploys."], ["pr", GitPullRequest, "Open a pull request", "Goes to a new branch; nothing changes until you merge it."]] as const).map(([v, Icon, label, about]) => (
                  <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn("rounded-xl bg-raised px-3 py-2 text-left", mode === v && "ring-2 ring-[var(--bw-red)]")}>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"><Icon className="size-3.5" />{label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{about}</span>
                  </button>
                ))}
              </div>
              {mode === "pr" && (
                <div className="grid gap-2.5">
                  <Field label="Branch name"><Input value={branchName} onChange={(e) => setTyped((t) => ({ ...t, branch: e.target.value }))} aria-label="Branch name" data-testid="review-branch-name" className="font-mono text-[12.5px] font-normal" /></Field>
                  <Field label="Pull request title"><Input value={prTitle} onChange={(e) => setTyped((t) => ({ ...t, prTitle: e.target.value }))} aria-label="Pull request title" data-testid="review-pr-title" className="text-[13px] font-normal" /></Field>
                  <Field label="Pull request description"><Textarea value={prBody} onChange={(e) => setTyped((t) => ({ ...t, prBody: e.target.value }))} rows={5} aria-label="Pull request description" data-testid="review-pr-body" className="text-[12.5px] font-normal" /></Field>
                </div>
              )}
              <div className="rounded-[8px] border border-line-soft px-3 py-2 text-[12px] text-ink-2">
                <p className="font-semibold text-ink">Your commit message</p>
                <pre className="whitespace-pre-wrap font-mono text-[12px]">{message.trim()}</pre>
              </div>
            </>
          )}
          {error && <p role="alert" className="text-[12.5px] text-red-text">{error}</p>}
          {stale && <div><Button variant="outline" size="sm" onClick={replan}>Review the changes again</Button></div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="outline" disabled={busy} onClick={() => close()}>Cancel</Button>
          {step === 2 && <Button variant="outline" disabled={busy} onClick={() => setStep(1)}>Back</Button>}
          {step === 1 ? (
            <Button disabled={!stepOne || busy} onClick={() => setStep(2)} data-testid="review-next">Next: where it goes</Button>
          ) : (
            <Button disabled={!ready || busy} onClick={() => void go()} data-testid="review-confirm">{busy ? "Working…" : mode === "pr" ? `Open pull request in ${target?.repo ?? "the repository"}` : `Commit to ${where}`}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
