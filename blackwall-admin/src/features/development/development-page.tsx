import { addDays, format, isToday, isYesterday, startOfWeek } from "date-fns"
import { CheckCircle2, CircleDot, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Globe, Lock, Pencil, Plus, RotateCw, Star, XCircle } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/common/empty-state"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { StatStrip } from "@/components/common/stat-strip"
import { ProjectTag, StatusMarker } from "@/components/common/tags"
import { ACTIVITY_ICON, CHECK_TONE } from "@/features/home/dev-attention"
import { shortAgo, timeAgo, toDateKey } from "@/lib/dates"
import type { RepoLink } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useDevelopment } from "@/services/data"
import type { DevelopmentOverview, RepoActivity, RepoSummary } from "@/services/types"
import { useUi } from "@/stores/ui"
import { useProjectMap, useWorkspace } from "@/stores/workspace"

/** GitHub's own language colours, for the language bar. */
const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  HTML: "#e34c26",
  CSS: "#663399",
  SCSS: "#c6538c",
  Python: "#3572A5",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C#": "#178600",
  C: "#555555",
  "C++": "#f34b7d",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5a03",
  MDX: "#fcb32c",
  PLpgSQL: "#336790",
}
const langColor = (name: string) => LANG_COLOR[name] ?? "#8b949e"

/** Commit counts → heatmap shade (GitHub-style greens, toned for the dark theme). */
const SHADES = ["bg-off", "bg-green/30", "bg-green/50", "bg-green/75", "bg-green"]
const shade = (n: number, max: number) => (n <= 0 ? SHADES[0] : SHADES[Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4))])

/**
 * Development: counts, a card per tracked repository (languages, recent commits,
 * status, links), commit history across them, what needs you and recent commits.
 */
export function DevelopmentPage() {
  const repos = useWorkspace((s) => s.repos)
  const feed = useDevelopment()
  const openForm = useUi((s) => s.openForm)
  const data = hasData(feed) ? feed.data : undefined
  const track = () => openForm({ kind: "repo" })

  const reviews = data?.prs.filter((p) => p.kind === "review-requested").length ?? 0
  const allDays = useMemo(() => mergeDays(data?.repos ?? []), [data])
  const commits30 = sumSince(allDays, 30)
  const commits7 = sumSince(allDays, 7)
  const dash = <span className="text-faint">—</span>
  const single = repos.length <= 1

  return (
    <>
      <PageHeader
        title="Development"
        badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
        subtitle="Repositories you track: what changed, what needs you, and where they're deployed."
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
      <div className="flex flex-col gap-3">
        <StatStrip
          items={[
            { label: "Repositories", value: repos.length, icon: <GitBranch className="size-3" aria-hidden /> },
            { label: "Commits, 30 days", value: data?.repos ? commits30 : dash, sub: data?.repos ? `${commits7} this week` : undefined, icon: <GitCommitHorizontal className="size-3" aria-hidden /> },
            { label: "Open pull requests", value: data ? data.prs.length : dash, sub: data ? (reviews ? `${reviews} waiting on your review` : "none waiting on you") : undefined, icon: <GitPullRequest className="size-3" aria-hidden /> },
            { label: "Failed runs", value: data ? data.failures.length : dash, tone: data?.failures.length ? "error" : undefined, sub: data && !data.failures.length ? "latest runs passing" : undefined, icon: <XCircle className="size-3" aria-hidden /> },
            { label: "Open issues", value: data ? data.issues.length : dash, icon: <CircleDot className="size-3" aria-hidden /> },
          ]}
        />

        <div className={cn("grid gap-3", data?.repos && "xl:grid-cols-[minmax(0,1fr)_auto]")}>
          {repos.length ? (
            <ul className={cn("grid content-start gap-3", repos.length > 1 && "sm:grid-cols-2")} aria-label="Tracked repositories">
              {repos.map((r) => (
                <RepoCard key={r.id} repo={r} data={data} summary={data?.repos?.find((s) => s.repo.toLowerCase() === r.fullName.toLowerCase())} />
              ))}
            </ul>
          ) : (
            <Panel tool="repos" command="ls">
              <EmptyState icon={GitBranch} title="No repositories tracked" action={<Button variant="outline" onClick={track}><Plus /> Track repository</Button>}>
                Add the ones you work on; their commits, status and links show up here.
              </EmptyState>
            </Panel>
          )}
          {data?.repos && <CommitHeatmap days={allDays} />}
        </div>

        {data ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Attention data={data} single={single} />
            <Activity data={data} single={single} />
          </div>
        ) : (
          <Panel tool="github" command="status">
            <FeedFallback feed={feed} provider="github" what="commits, pull requests, failed runs and issues" />
          </Panel>
        )}
      </div>
    </>
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
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-[6px] border border-line bg-well px-2 text-[11px] text-ink-2 hover:border-rim hover:text-ink">
      {icon}
      <span className="truncate">{children}</span>
    </a>
  )
}

function LanguageBar({ languages }: { languages: RepoSummary["languages"] }) {
  const total = languages.reduce((a, l) => a + l.bytes, 0)
  if (!total) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-off" role="img" aria-label={languages.map((l) => `${l.name} ${Math.round((l.bytes / total) * 100)}%`).join(", ")}>
        {languages.map((l) => (
          <span key={l.name} style={{ width: `${(l.bytes / total) * 100}%`, background: langColor(l.name) }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {languages.slice(0, 4).map((l) => (
          <li key={l.name} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: langColor(l.name) }} aria-hidden />
            <span className="text-ink-2">{l.name}</span> {((l.bytes / total) * 100).toFixed(l.bytes / total < 0.1 ? 1 : 0)}%
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The last 30 days of commits as tiny bars. */
function CommitSpark({ days }: { days: Record<string, number> }) {
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = toDateKey(addDays(new Date(), i - 29))
    return { d, n: days[d] ?? 0 }
  })
  const max = Math.max(1, ...series.map((s) => s.n))
  const total = series.reduce((a, s) => a + s.n, 0)
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 flex-1 items-end gap-[2px]" role="img" aria-label={`${total} commits in the last 30 days`}>
        {series.map((s) => (
          <span key={s.d} title={`${format(new Date(`${s.d}T12:00`), "MMM d")}: ${s.n} ${s.n === 1 ? "commit" : "commits"}`} className={cn("flex-1 rounded-[1.5px]", s.n ? "bg-green/80" : "bg-off")} style={{ height: s.n ? `${Math.max(18, (s.n / max) * 100)}%` : "12%" }} />
        ))}
      </div>
      <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
        <span className="block font-heading text-base font-bold text-ink tabular-nums">{total}</span>
        commits · 30d
      </span>
    </div>
  )
}

function RepoCard({ repo, data, summary }: { repo: RepoLink; data?: DevelopmentOverview; summary?: RepoSummary }) {
  const projects = useProjectMap()
  const openForm = useUi((s) => s.openForm)
  const same = (r: string) => r.toLowerCase() === repo.fullName.toLowerCase()
  const prs = data?.prs.filter((p) => same(p.repo)) ?? []
  const failures = data?.failures.filter((f) => same(f.repo)) ?? []
  const issues = data?.issues.filter((i) => same(i.repo)) ?? []
  const [owner, name] = repo.fullName.split("/")
  const tone = !data ? "off" : failures.length ? "error" : prs.some((p) => p.checks === "pending") ? "warn" : "ok"
  const status = !data ? "Needs GitHub" : failures.length ? `${failures.length} failed ${failures.length === 1 ? "run" : "runs"}` : "Checks passing"

  return (
    <li className="bw-panel flex flex-col gap-3 p-3.5" data-testid="repo-card">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-line bg-well font-heading text-sm font-bold text-ink-2 uppercase">
          {(name ?? repo.fullName).slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <a href={repo.url} target="_blank" rel="noreferrer" className="group/a inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-ink hover:underline">
              <span className="truncate">{name ?? repo.fullName}</span>
              <ExternalLink className="size-3 shrink-0 text-faint group-hover/a:text-ink-2" aria-label="opens GitHub" />
            </a>
            {summary && (
              <span className="inline-flex h-[18px] items-center gap-1 rounded-full border border-line px-1.5 text-[10px] text-muted-foreground">
                {summary.private ? <Lock className="size-2.5" aria-hidden /> : <Globe className="size-2.5" aria-hidden />}
                {summary.private ? "Private" : "Public"}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-faint">
            <span className="font-mono">{owner}</span>
            {summary && <> · {summary.defaultBranch}</>}
            {summary && summary.stars > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5"><Star className="size-2.5" aria-hidden /> {summary.stars}</span>
            )}
          </p>
        </div>
        <ProjectTag project={repo.projectId ? projects.get(repo.projectId) : undefined} />
        <Button variant="quiet" size="icon-xs" aria-label={`Edit ${repo.fullName}`} onClick={() => openForm({ kind: "repo", id: repo.id })}>
          <Pencil />
        </Button>
      </div>

      {summary?.description && <p className="-mt-1 line-clamp-2 text-xs text-muted-foreground">{summary.description}</p>}
      {summary && summary.languages.length > 0 && <LanguageBar languages={summary.languages} />}
      {summary && <CommitSpark days={summary.commitsByDay} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <StatusMarker tone={tone} /> {status}
        </span>
        {data && (
          <>
            <span className="inline-flex items-center gap-1" title="Open pull requests"><GitPullRequest className="size-3" aria-hidden /> {prs.length}</span>
            <span className="inline-flex items-center gap-1" title="Open issues"><CircleDot className="size-3" aria-hidden /> {issues.length}</span>
          </>
        )}
        {summary?.pushedAt && <span className="ml-auto">pushed {shortAgo(summary.pushedAt)} ago</span>}
      </div>
      {(repo.productionUrl || repo.previewUrl) && (
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {repo.productionUrl && <Pill href={repo.productionUrl} icon={<Globe className="size-3 shrink-0" aria-hidden />}>{repo.productionUrl.replace(/^https?:\/\//, "")}</Pill>}
          {repo.previewUrl && <Pill href={repo.previewUrl} icon={<span className="text-[9px] font-bold text-faint">PRE</span>}>{repo.previewUrl.replace(/^https?:\/\//, "")}</Pill>}
        </div>
      )}
    </li>
  )
}

/* -------------------------------------------------------------- heatmap */

/** 26 weeks of commits across tracked repos, Sunday to Saturday top to bottom (GitHub's layout). */
function CommitHeatmap({ days }: { days: Record<string, number> }) {
  const weeks = 26
  const start = startOfWeek(addDays(new Date(), -(weeks - 1) * 7))
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const max = Math.max(1, ...Object.values(days))
  const total = Object.values(days).reduce((a, b) => a + b, 0)
  const active = Object.values(days).filter(Boolean).length
  // Longest run of consecutive days with a commit.
  let best = 0
  let run = 0
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const k = toDateKey(addDays(new Date(), -i))
    run = days[k] ? run + 1 : 0
    best = Math.max(best, run)
  }
  const today = new Date()

  return (
    <Panel tool="git" command="log --26w" meta={`${total} commits`} bodyClassName="flex flex-col gap-3 px-3.5 py-3">
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="ml-7 flex gap-[3px] text-[9px] text-faint">
            {cols.map((c, i) => (
              <span key={i} className="w-[11px] overflow-visible whitespace-nowrap">
                {c[0].getDate() <= 7 ? format(c[0], "MMM") : ""}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
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
      side: (
        <span className="inline-flex items-center gap-1.5">
          {p.checks !== "unknown" && <StatusMarker tone={CHECK_TONE[p.checks]} />}
          {p.kind === "review-requested" ? "Review" : "Yours"}
        </span>
      ),
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
      side: "Failed",
      rank: 1,
      at: f.failedAt,
    })),
    ...data.issues.map((i) => ({
      id: i.id,
      icon: <CircleDot className="size-3.5 text-amber" aria-hidden />,
      title: i.title,
      meta: `${shortRepo(i.repo, single)}#${i.number}${i.labels.length ? ` · ${i.labels.join(", ")}` : ""}`,
      url: i.url,
      side: "Issue",
      rank: 3,
      at: i.updatedAt,
    })),
  ].sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at))
  const shown = all ? items : items.slice(0, 6)

  return (
    <Panel tool="github" command="needs-you" meta={items.length || undefined} className="self-start">
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
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-raised">
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
    <Panel tool="git" command="log" meta={data.activity.length || undefined}>
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
