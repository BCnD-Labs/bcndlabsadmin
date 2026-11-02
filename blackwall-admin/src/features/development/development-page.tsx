import { addDays, format, isToday, isYesterday, startOfWeek } from "date-fns"
import { CheckCircle2, CircleDot, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Globe, Lock, Pencil, Plus, RotateCw, XCircle } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/common/empty-state"
import { FeedFallback } from "@/components/common/feed-fallback"
import { PageHeader } from "@/components/common/page-header"
import { PhoneDisclosure } from "@/components/common/phone-disclosure"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { ProjectTag, StatusMarker } from "@/components/common/tags"
import { ACTIVITY_ICON } from "@/features/home/dev-attention"
import { shortAgo, timeAgo, toDateKey } from "@/lib/dates"
import type { RepoLink } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useGitHubAccounts, type GitHubAccountView } from "@/services/data"
import { AccountAvatar, AccountChip, type AccountLook } from "@/components/accounts/account-appearance"
import { Sparkline, lastDays } from "@/features/home/overview-panels"
import type { DevelopmentOverview, RepoActivity, RepoSummary } from "@/services/types"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"


/** Commit counts → heatmap shade (GitHub-style greens, toned for the dark theme). */
const SHADES = ["bg-off", "bg-green/30", "bg-green/50", "bg-green/75", "bg-green"]
const shade = (n: number, max: number) => (n <= 0 ? SHADES[0] : SHADES[Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4))])

/**
 * Development: counts, a card per tracked repository (languages, recent commits,
 * status, links), commit history across them, what needs you and recent commits.
 */
export function DevelopmentPage() {
  const repos = useWorkspace((s) => s.repos)
  const feed = useGitHubAccounts()
  const openForm = useUi((s) => s.openForm)
  const accounts = useMemo(() => feed.data ?? [], [feed.data])
  const data = useMemo(() => mergeAccounts(accounts), [accounts])
  const track = () => openForm({ kind: "repo" })

  const reviews = data?.prs.filter((p) => p.kind === "review-requested").length ?? 0
  const allDays = useMemo(() => mergeDays(data?.repos ?? []), [data])
  const commits30 = sumSince(allDays, 30)
  const commits7 = sumSince(allDays, 7)
  const dash = <span className="text-faint">—</span>
  const single = repos.length <= 1
  const accountOf = (fullName: string) => accounts.find((a) => a.repos.some((r) => r.toLowerCase() === fullName.toLowerCase()))
  const failing = data?.failures[0]

  return (
    <>
      <PageHeader
        title="GitHub activity"
        badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
        actions={
          <>
            {feed.status === "live" && (
              <Button variant="ghost" onClick={feed.refresh}>
                <RotateCw /> Refresh
              </Button>
            )}
            <Button onClick={track}>
              <Plus /> Track repository
            </Button>
          </>
        }
      />
      {/* Layout follows Ant Design's Statistic row + Card.Grid + Activity list (docs/design). */}
      <div className="@container/main mx-auto grid w-full max-w-[var(--bw-page-max)] pb-6" style={{ gap: "var(--bw-grid-gap)" }}>
        {repos.length > 0 && (
          <section aria-label="Summary" className="grid grid-cols-2 @3xl/main:grid-cols-3 @6xl/main:grid-cols-5" style={{ gap: "var(--bw-grid-gap)" }}>
            <StatCard label="Repositories" value={repos.length} sub={accounts.length > 1 ? `across ${accounts.length} accounts` : undefined} />
            <StatCard label="Commits · 30 days" value={data?.repos ? commits30 : dash} sub={data?.repos ? `${commits7} this week` : undefined} />
            <StatCard label="Open pull requests" value={data ? data.prs.length : dash} sub={data ? (reviews ? `${reviews} waiting on you` : "none waiting on you") : undefined} />
            <StatCard label="Failed runs" value={data ? data.failures.length : dash} tone={data?.failures.length ? "error" : undefined} sub={data ? (failing ? `${shortRepo(failing.repo, single)} · ${failing.branch}` : "latest runs passing") : undefined} />
            <StatCard label="Open issues" value={data ? data.issues.length : dash} />
          </section>
        )}

        <div className="grid grid-cols-1 items-start @5xl/main:grid-cols-[minmax(0,1fr)_25rem]" style={{ gap: "var(--bw-grid-gap)" }}>
          <div className="grid min-w-0" style={{ gap: "var(--bw-grid-gap)" }}>
            <Panel category="development" title="Repositories" subtitle={repos.length ? `${repos.length} tracked` : undefined} tool="repos" command="ls"
              actions={repos.length ? <Button variant="outline" size="sm" onClick={track}><Plus /> Track repository</Button> : undefined}
              bodyClassName="@container">
              {repos.length ? (
                <ul aria-label="Tracked repositories" className="grid grid-cols-1 gap-4 p-4 @lg:grid-cols-2 @3xl:grid-cols-3">
                  {repos.map((r) => {
                    const acct = accountOf(r.fullName)
                    return <RepoCard key={r.id} repo={r} data={data} look={acct?.look} account={accounts.length > 1 ? acct?.label : undefined} summary={data?.repos?.find((s) => s.repo.toLowerCase() === r.fullName.toLowerCase())} />
                  })}
                </ul>
              ) : (
                <EmptyState roomy icon={GitBranch} title="No repositories tracked" action={<Button variant="outline" onClick={track}><Plus /> Track repository</Button>}>
                  Add the ones you work on; their commits, status and links show up here.
                </EmptyState>
              )}
            </Panel>
            {data && <Attention data={data} single={single} />}
          </div>
          {data ? (
            <PhoneDisclosure label="Recent commits"><Activity data={data} single={single} /></PhoneDisclosure>
          ) : (
            repos.length > 0 && <Panel category="development" title="GitHub activity" tool="github" command="status" bodyClassName="px-4 py-3">
              <FeedFallback feed={feed} provider="github" what="commits, pull requests, failed runs and issues" />
            </Panel>
          )}
        </div>
        {repos.length > 0 && data?.repos && <PhoneDisclosure label="History · 26 weeks"><CommitHeatmap days={allDays} /></PhoneDisclosure>}
      </div>
    </>
  )
}

/** Every account's slice merged into one overview (a PR found by two searches counts once). */
function mergeAccounts(accounts: GitHubAccountView[]): DevelopmentOverview | undefined {
  const parts = accounts.flatMap((a) => (a.overview ? [a.overview] : []))
  if (!parts.length) return undefined
  const prs = new Map<string, DevelopmentOverview["prs"][number]>()
  for (const p of parts.flatMap((o) => o.prs)) if (!prs.has(p.id)) prs.set(p.id, p)
  return {
    prs: [...prs.values()],
    failures: parts.flatMap((o) => o.failures),
    issues: parts.flatMap((o) => o.issues),
    activity: parts.flatMap((o) => o.activity).sort((x, y) => y.at.localeCompare(x.at)),
    repos: parts.flatMap((o) => o.repos ?? []),
  }
}

function StatCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: "error" }) {
  return (
    <div className="bw-panel min-w-0 px-4 py-3.5">
      <p className="truncate text-[12.5px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-[26px] leading-none font-semibold tabular-nums", tone === "error" ? "text-red-light" : "text-ink")}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function mergeDays(repos: RepoSummary[]) {
  const out: Record<string, number> = {}
  for (const r of repos) for (const [d, n] of Object.entries(r.commitsByDay)) out[d] = (out[d] ?? 0) + n
  return out
}

function sumSince(days: Record<string, number>, n: number) {
  const from = toDateKey(addDays(new Date(), -(n - 1)))
  return Object.entries(days).reduce((a, [d, c]) => (d >= from ? a + c : a), 0)
}

/* ------------------------------------------------------------- repo card */

function Pill({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="bw-action-link min-w-0 gap-1.5 rounded-[6px] border border-line bg-well px-2 text-[11px] text-ink-2 hover:border-rim hover:text-ink">
      {icon}
      <span className="truncate">{children}</span>
    </a>
  )
}




function RepoCard({ repo, data, summary, look, account }: { repo: RepoLink; data?: DevelopmentOverview; summary?: RepoSummary; look?: AccountLook; account?: string }) {
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  const same = (r: string) => r.toLowerCase() === repo.fullName.toLowerCase()
  const prs = data?.prs.filter((p) => same(p.repo)) ?? []
  const failures = data?.failures.filter((f) => same(f.repo)) ?? []
  const issues = data?.issues.filter((i) => same(i.repo)) ?? []
  const [owner, name] = repo.fullName.split("/")
  const tone = !data ? "off" : failures.length ? "error" : prs.some((p) => p.checks === "pending") ? "warn" : "ok"
  const status = !data ? "Needs GitHub" : failures.length ? `${failures.length} failed ${failures.length === 1 ? "run" : "runs"}` : "Passing"
  const days = lastDays(summary?.commitsByDay, 14)
  const total = days.reduce((x, y) => x + y, 0)
  const langs = summary?.languages ?? []
  const langBytes = langs.reduce((x, l) => x + l.bytes, 0) || 1

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl bg-raised p-4" data-testid="repo-card">
      <div className="flex items-start gap-3">
        {look ? <AccountAvatar look={look} size={38} label={account} /> : (
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-selected font-heading text-xs font-bold text-ink-2 uppercase">{(name ?? repo.fullName).slice(0, 2)}</span>
        )}
        <div className="min-w-0 flex-1">
          <a href={repo.url} target="_blank" rel="noreferrer" className="group/a inline-flex max-w-full items-center gap-1 font-mono text-sm font-semibold text-ink hover:underline">
            <span className="truncate">{name ?? repo.fullName}</span>
            <ExternalLink className="size-3 shrink-0 text-faint group-hover/a:text-ink-2" aria-label="opens GitHub" />
          </a>
          <p className="line-clamp-2 text-xs text-muted-foreground">{summary?.description || <span className="font-mono">{owner}{summary ? ` · ${summary.defaultBranch}` : ""}</span>}</p>
        </div>
        <Button variant="quiet" size="icon-xs" aria-label={`Edit ${repo.fullName}`} onClick={() => openForm({ kind: "repo", id: repo.id })}><Pencil /></Button>
      </div>
      {summary && (
        <div className="flex items-end justify-between gap-3">
          <Sparkline values={days} color={look?.color ?? "#9aa0a6"} />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{total} commits · 14d</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-ink-2"><StatusMarker tone={tone} /> {status}</span>
        {data && <span className="inline-flex items-center gap-1" title="Open pull requests"><GitPullRequest className="size-3" aria-hidden /> {prs.length}</span>}
        {data && <span className="inline-flex items-center gap-1" title="Open issues"><CircleDot className="size-3" aria-hidden /> {issues.length}</span>}
        {langs.length > 0 && <span className="ml-auto truncate">{langs.slice(0, 2).map((l) => `${l.name} ${Math.round((l.bytes / langBytes) * 100)}%`).join(" · ")}</span>}
      </div>
      {(account || repo.projectId || summary?.private !== undefined || repo.productionUrl || repo.previewUrl) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {account && look && <AccountChip look={look} name={account} />}
          {summary && (
            <span className="inline-flex h-[20px] items-center gap-1 rounded-full bg-selected px-2 text-[11px] text-muted-foreground">
              {summary.private ? <Lock className="size-2.5" aria-hidden /> : <Globe className="size-2.5" aria-hidden />}
              {summary.private ? "Private" : "Public"}
            </span>
          )}
          <ProjectTag asLink project={repo.projectId ? projects.get(repo.projectId) : undefined} />
          {repo.productionUrl && <Pill href={repo.productionUrl} icon={<Globe className="size-3 shrink-0" aria-hidden />}>{repo.productionUrl.replace(/^https?:\/\//, "")}</Pill>}
          {repo.previewUrl && <Pill href={repo.previewUrl} icon={<span className="text-[9px] font-bold text-faint">PRE</span>}>{repo.previewUrl.replace(/^https?:\/\//, "")}</Pill>}
        </div>
      )}
      {summary?.pushedAt && <p className="-mt-1 text-[11px] text-faint">pushed {shortAgo(summary.pushedAt)} ago</p>}
    </li>
  )
}

/* -------------------------------------------------------------- heatmap */

/** 26 weeks of commits across tracked repos, Sunday to Saturday top to bottom (GitHub's layout). */
function CommitHeatmap({ days }: { days: Record<string, number> }) {
  const phone = useMediaQuery("(max-width: 639px)")
  const [expanded, setExpanded] = useState(false)
  const weeks = phone && !expanded ? 12 : 26
  const start = startOfWeek(addDays(new Date(), -(weeks - 1) * 7))
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const max = Math.max(1, ...Object.values(days))
  const total = Object.values(days).reduce((a, b) => a + b, 0)
  const active = Object.values(days).filter(Boolean).length
  // Longest run of consecutive days with a commit.
  let best = 0
  let run = 0
  for (let i = 26 * 7 - 1; i >= 0; i--) {
    const k = toDateKey(addDays(new Date(), -i))
    run = days[k] ? run + 1 : 0
    best = Math.max(best, run)
  }
  const today = new Date()

  return (
    <Panel category="development" title="Commit history" tool="git" command={`log --${weeks}w`} meta={`${total} commits · 26w total`} bodyClassName="flex flex-col gap-3 px-3.5 py-3">
      <div className="overflow-x-auto">
        {phone && <Button variant="outline" className="mb-2" onClick={() => setExpanded(!expanded)}>{expanded ? "Recent 12 weeks" : "Expand history"}</Button>}
        <p className="sr-only">Showing {weeks} weeks, ending this week</p>
        <div className="inline-flex flex-col gap-1">
          <div className={cn("ml-7 flex gap-[3px] text-[9px] text-faint", phone && expanded && "hidden")}>
            {cols.map((c, i) => (
              <span key={i} className="w-[11px] overflow-visible whitespace-nowrap">
                {c[0].getDate() <= 7 ? format(c[0], "MMM") : ""}
              </span>
            ))}
          </div>
          <div className={cn("flex gap-[3px]", phone && "flex-wrap")}>
            <div className="mr-1 flex w-6 flex-col gap-[3px] text-[9px] leading-[11px] text-faint">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => <span key={i} className="h-[11px]">{l}</span>)}
            </div>
            {cols.map((c, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {c.map((d) => {
                  const k = toDateKey(d)
                  const n = days[k] ?? 0
                  if (d > today) return <span key={k} className="size-[11px]" />
                  return (
                    <Tooltip key={k}>
                      <TooltipTrigger asChild>
                        <span className={cn("size-[11px] rounded-[2px]", shade(n, max), isToday(d) && "ring-1 ring-ink-2/60")} aria-label={`${format(d, "MMM d")}: ${n} commits`} />
                      </TooltipTrigger>
                      <TooltipContent>{n ? `${n} ${n === 1 ? "commit" : "commits"}` : "No commits"} · {format(d, "EEE, MMM d")}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          <span className="text-ink-2">{active}</span> active days · longest streak <span className="text-ink-2">{best}</span> {best === 1 ? "day" : "days"}
        </span>
        <span className="inline-flex items-center gap-1">
          Less {SHADES.map((s) => <span key={s} className={cn("size-[9px] rounded-[2px]", s)} />)} More
        </span>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------ needs you */

type AttentionItem = { id: string; icon: ReactNode; title: ReactNode; meta: string; url?: string; side?: ReactNode; rank: number; at: string }

const shortRepo = (repo: string, single: boolean) => (single ? "" : repo.split("/")[1] ?? repo)

/** Review requests first, then failed runs, your own PRs and issues. */
function Attention({ data, single }: { data: DevelopmentOverview; single: boolean }) {
  const [all, setAll] = useState(false)
  const items: AttentionItem[] = [
    ...data.prs.map((p) => ({
      id: p.id,
      icon: <GitPullRequest className="size-3.5 text-green" aria-hidden />,
      title: p.title,
      meta: `${shortRepo(p.repo, single)}#${p.number} · ${p.author}`,
      url: p.url,
      side: p.kind === "review-requested" ? <TonePill tone="blue">Review requested</TonePill> : p.checks === "failing" ? <TonePill tone="red">Checks failing</TonePill> : <TonePill tone="grey">Yours</TonePill>,
      rank: p.kind === "review-requested" ? 0 : 2,
      at: p.updatedAt,
    })),
    ...data.failures.map((f) => ({
      id: f.id,
      icon: <XCircle className="size-3.5 text-red" aria-hidden />,
      title: (
        <>
          <span className="font-mono">{f.workflow}</span> failed on <span className="font-mono">{f.branch}</span>
        </>
      ),
      meta: `${shortRepo(f.repo, single)}@${f.commit}`.replace(/^@/, ""),
      url: f.url,
      side: <TonePill tone="red">Failed run</TonePill>,
      rank: 1,
      at: f.failedAt,
    })),
    ...data.issues.map((i) => ({
      id: i.id,
      icon: <CircleDot className="size-3.5 text-amber" aria-hidden />,
      title: i.title,
      meta: `${shortRepo(i.repo, single)}#${i.number}${i.labels.length ? ` · ${i.labels.join(", ")}` : ""}`,
      url: i.url,
      side: <TonePill tone="grey">Issue</TonePill>,
      rank: 3,
      at: i.updatedAt,
    })),
  ].sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at))
  const shown = all ? items : items.slice(0, 6)

  return (
    <Panel category="development" title="Needs your attention" tool="github" command="needs-you" meta={items.length || undefined} bodyClassName="overflow-y-auto">
      {items.length ? (
        <>
          <ul>
            {shown.map((it) => {
              const Title = it.url ? "a" : "span"
              return (
                <li key={it.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3 py-1.5 last:border-b-0 hover:bg-raised">
                  {it.icon}
                  <span className="min-w-0 flex-1">
                    <Title {...(it.url ? { href: it.url, target: "_blank", rel: "noreferrer" } : {})} className={cn("block truncate text-[13px] text-ink", it.url && "hover:underline")}>
                      {it.title}
                    </Title>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {it.meta} · {shortAgo(it.at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{it.side}</span>
                </li>
              )
            })}
          </ul>
          {items.length > 6 && (
            <button type="button" onClick={() => setAll(!all)} className="w-full border-t border-line px-3 py-2 text-left text-[11px] text-muted-foreground hover:text-ink">
              {all ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green/12 text-green">
            <CheckCircle2 className="size-4.5" aria-hidden />
          </span>
          <span>
            <span className="block text-[13px] text-ink">All clear</span>
            <span className="block text-[11px] text-muted-foreground">No review requests, failed runs or open issues on tracked repos.</span>
          </span>
        </div>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------- activity */

function Avatar({ a }: { a: RepoActivity }) {
  const [broken, setBroken] = useState(false)
  if (a.avatar && !broken) return <img src={a.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-6 shrink-0 rounded-full border border-line bg-well" />
  const Icon = ACTIVITY_ICON[a.kind]
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Icon className="size-3 text-muted-foreground" aria-hidden />
    </span>
  )
}

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  return isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEE, MMM d")
}

/** Recent commits (and merges, releases, new issues), grouped by day. */
function Activity({ data, single }: { data: DevelopmentOverview; single: boolean }) {
  const [all, setAll] = useState(false)
  const list = all ? data.activity : data.activity.slice(0, 10)
  const groups: { label: string; items: RepoActivity[] }[] = []
  for (const a of list) {
    const label = dayLabel(a.at)
    const g = groups.at(-1)
    if (g?.label === label) g.items.push(a)
    else groups.push({ label, items: [a] })
  }
  return (
    <Panel category="development" title="Recent activity" tool="git" command="log" meta={data.activity.length || undefined} bodyClassName="overflow-y-auto">
      {data.activity.length ? (
        <>
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="bw-label flex items-center gap-2 border-b border-line-soft bg-well/60 px-3 py-1">
                <GitCommitHorizontal className="size-3" aria-hidden /> {g.label}
              </h3>
              <ul>
                {g.items.map((a) => (
                  <li key={a.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft px-3 py-1.5 last:border-b-0 hover:bg-raised">
                    <Avatar a={a} />
                    <span className="min-w-0 flex-1">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-ink hover:underline">{a.summary}</a>
                      ) : (
                        <span className="block truncate text-[13px] text-ink">{a.summary}</span>
                      )}
                      <span className="block truncate text-[11px] text-muted-foreground" title={timeAgo(a.at)}>
                        {a.actor}
                        {!single && <> · {a.repo.split("/")[1]}</>}
                        {a.kind !== "commit" && <> · {a.kind === "merge" ? "merged" : a.kind === "release" ? "release" : a.kind === "issue" ? "new issue" : "push"}</>}
                      </span>
                    </span>
                    {a.sha && <code className="shrink-0 rounded-[4px] border border-line bg-well px-1.5 font-mono text-[10px] text-ink-2">{a.sha}</code>}
                    <span className="w-8 shrink-0 text-right text-[11px] text-faint tabular-nums">{shortAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {data.activity.length > 10 && (
            <button type="button" onClick={() => setAll(!all)} className="w-full border-t border-line px-3 py-2 text-left text-[11px] text-muted-foreground hover:text-ink">
              {all ? "Show less" : `Show all ${data.activity.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="px-3 py-3 text-[12px] text-muted-foreground">No recent commits on tracked repositories.</p>
      )}
    </Panel>
  )
}

/** Flat Material tonal pill (same as Home's overview panels). */
function TonePill({ tone, children }: { tone: "blue" | "red" | "grey"; children: ReactNode }) {
  const c = { blue: ["#8ab4f8", "#4285f4"], red: ["#f28b82", "#ea4335"], grey: ["#bdc1c6", "#9aa0a6"] }[tone]
  return <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: c[0], background: `color-mix(in srgb, ${c[1]} 16%, transparent)` }}>{children}</span>
}
