import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { addDays, format, subDays } from "date-fns"
import { ArrowRight, CircleCheck, ExternalLink, Plus } from "lucide-react"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { FeedFallback } from "@/components/common/feed-fallback"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { AccountAvatar, AccountChip, type AccountLook } from "@/components/accounts/account-appearance"
import { Button } from "@/components/ui/button"
import { learningType } from "@/features/learning/learning-utils"
import { daysUntil, formatTime, parseKey, timeAgo, toDateKey } from "@/lib/dates"
import { DEVELOPMENT, courseHref, logHref, plannerHref } from "@/lib/routes"
import type { CourseColor, Task } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useGitHubAccounts, type GitHubAccountView } from "@/services/data"
import type { PullRequestSummary } from "@/services/types"
import { useNow } from "@/hooks/use-now"
import { useUi } from "@/stores/ui"
import { useCourseMap, useWorkspace } from "@/stores/workspace"

/*
 * Home's overview panels. Designs (approved mock, docs/design/BLACKWALL_DESIGN.md):
 *  - Pull requests: Devias Kit "Our subscriptions" list; content per Port's homepage guidance.
 *  - This week: Microsoft Fluent 2 card + agenda list.
 *  - Repositories: Ant Design card with Statistic row and a table with Tiny.Column sparklines.
 * One shared token for accounts: the color + Material Symbol picked per GitHub connection.
 */

type Tone = "blue" | "red" | "green" | "yellow" | "grey"
const TONE: Record<Tone, string> = { blue: "#8ab4f8", red: "#f28b82", green: "#81c995", yellow: "#fdd663", grey: "#bdc1c6" }
const TONE_BG: Record<Tone, string> = { blue: "#4285f4", red: "#ea4335", green: "#34a853", yellow: "#fbbc04", grey: "#9aa0a6" }

/** Flat Material tonal pill: bright text on a ~16% fill of the same hue. No outline. */
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: TONE[tone], background: `color-mix(in srgb, ${TONE_BG[tone]} 16%, transparent)` }}>
      {children}
    </span>
  )
}

function PanelFooter({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <footer className="mx-5 mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft py-3.5 text-[13px] text-muted-foreground">
      <span>{left}</span>
      {children}
    </footer>
  )
}

const footerLink = "inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"

// ---------------------------------------------------------------- Pull requests

type PrFilter = "needs" | "mine" | "all"
interface PrRow extends PullRequestSummary { look: AccountLook; account: string }

function prStatus(p: PullRequestSummary): [Tone, string] {
  if (p.kind === "review-requested") return ["blue", "Review requested"]
  if (p.checks === "failing") return ["red", "Checks failing"]
  if (p.checks === "pending") return ["yellow", "Checks running"]
  if (p.checks === "passing") return ["green", "Checks passing"]
  return ["grey", "Open"]
}

function accountsLine(accounts: GitHubAccountView[] | undefined, noun: string, count: number) {
  const n = accounts?.length ?? 0
  return `${n > 1 ? `Across ${n} accounts` : n === 1 ? accounts![0].label : "GitHub"} · ${count} ${noun}`
}

export function PullRequestsPanel() {
  const feed = useGitHubAccounts()
  const [filter, setFilter] = useState<PrFilter>("needs")
  const rows: PrRow[] = useMemo(
    () => (feed.data ?? []).flatMap((a) => {
      // A PR can come back from both searches (review requested and authored): keep one, preferring "review requested".
      const byId = new Map<string, PullRequestSummary>()
      for (const p of a.overview?.prs ?? []) if (!byId.has(p.id)) byId.set(p.id, p)
      return [...byId.values()].map((p) => ({ ...p, look: a.look, account: a.label }))
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [feed.data],
  )
  const needs = rows.filter((p) => p.kind === "review-requested" || p.checks === "failing")
  const shown = (filter === "needs" ? needs : filter === "mine" ? rows.filter((p) => p.kind === "authored") : rows).slice(0, 6)
  const failed = feed.data?.filter((a) => a.error) ?? []
  const allFailed = !!feed.data?.length && failed.length === feed.data.length

  return (
    <Panel
      category="development"
      title="Pull requests"
      subtitle={feed.data ? accountsLine(feed.data, "open", rows.length) : undefined}
      tool="github"
      command="prs"
      badge={feed.status !== "live" ? <SourceBadge status={feed.status} /> : undefined}
      actions={feed.data ? <SegmentedTabs className="shrink-0 rounded-full border-0" tabClassName="flex-none rounded-full px-3" label="Pull request filter" value={filter} onChange={setFilter} tabs={[{ value: "needs", label: "Needs me", count: needs.length }, { value: "mine", label: "Mine" }, { value: "all", label: "All" }]} /> : undefined}
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {feed.data ? (
        <>
          {failed.map((a) => <p key={a.id} className="mx-5 mt-4 text-xs text-red-text">{a.label}: {a.error}</p>)}
          {allFailed ? (
            <p className="px-5 py-5 text-sm text-muted-foreground">Pull requests couldn’t be loaded from any account. Check the connections in Settings.</p>
          ) : shown.length ? (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 px-2 py-3">
              {shown.map((p) => {
                const [tone, label] = prStatus(p)
                return (
                  <li key={`${p.account}-${p.id}`} className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl px-3 py-2.5 hover:bg-raised sm:flex-nowrap">
                    <AccountAvatar look={p.look} label={p.account} />
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-[14.5px] font-medium text-ink">{p.title}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">{p.repo} #{p.number} · {timeAgo(p.updatedAt)}</span>
                    </span>
                    <span className="max-sm:ml-[50px]"><Pill tone={tone}>{label}</Pill></span>
                    {p.url && (
                      <Button asChild variant="quiet" size="icon-sm" className="max-sm:hidden" aria-label={`Open ${p.repo} #${p.number} on GitHub`}>
                        <a href={p.url} target="_blank" rel="noreferrer"><ExternalLink /></a>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground"><CircleCheck className="size-4 text-green" aria-hidden />{filter === "needs" ? "Nothing needs you right now." : "No open pull requests in your tracked repositories."}</p>
          )}
        </>
      ) : (
        <div className="px-5 py-4"><FeedFallback feed={feed} provider="github" what="pull requests from your GitHub accounts" /></div>
      )}
      <PanelFooter left={feed.status === "live" ? "Live from GitHub" : feed.status === "sample" ? "Sample data" : undefined}>
        <Link to={DEVELOPMENT} className={footerLink}>Open GitHub activity <ArrowRight className="size-3.5" aria-hidden /></Link>
      </PanelFooter>
    </Panel>
  )
}

// ---------------------------------------------------------------- This week

/** Course label colors as flat Material hues (the stored names stay the same). */
const COURSE_HEX: Record<CourseColor, string> = { blue: "#4285f4", teal: "#12b5cb", green: "#34a853", amber: "#fbbc04", red: "#ea4335", violet: "#a142f4", slate: "#9aa0a6" }
const TASK_HEX = "#4285f4"
type WeekFilter = "all" | "course" | "tasks"

export function ThisWeekPanel() {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useCourseMap()
  const today = toDateKey(useNow())
  const [filter, setFilter] = useState<WeekFilter>("all")
  const week = tasks
    .filter((t) => !t.done && t.due && daysUntil(t.due) <= 7)
    .sort((a, b) => a.due!.localeCompare(b.due!) || (a.time ?? "").localeCompare(b.time ?? ""))
  const shown = week.filter((t) => (filter === "course" ? t.courseId : filter === "tasks" ? !t.courseId : true)).slice(0, 6)
  const overdue = week.filter((t) => t.due! < today).length
  const end = format(addDays(parseKey(today), 7), "MMM d")

  return (
    <Panel
      category="calendar"
      title="This week"
      subtitle={`${week.length} due${overdue ? ` · ${overdue} overdue` : ""} · through ${end}`}
      tool="week"
      command="due"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {/* Filter tabs sit under the title bar, as in the Fluent 2 card this panel follows. */}
      <SegmentedTabs className="mx-5 mt-4 self-start rounded-full border-0" tabClassName="flex-none rounded-full px-3" label="This week filter" value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All" }, { value: "course", label: "Coursework" }, { value: "tasks", label: "Tasks" }]} />
      {shown.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 px-2 py-3">
          {shown.map((t) => <WeekRow key={t.id} task={t} course={t.courseId ? courses.get(t.courseId) : undefined} today={today} />)}
        </ul>
      ) : (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground"><CircleCheck className="size-4 text-green" aria-hidden />Nothing due in the next 7 days.</p>
      )}
      <PanelFooter left="From Planner and Learning">
        <Link to={plannerHref} className={footerLink}>Open Planner <ArrowRight className="size-3.5" aria-hidden /></Link>
      </PanelFooter>
    </Panel>
  )
}

function WeekRow({ task, course, today }: { task: Task; course?: { id: string; code: string; color: CourseColor }; today: string }) {
  const color = course ? COURSE_HEX[course.color] : TASK_HEX
  const date = parseKey(task.due!)
  const n = daysUntil(task.due!)
  const isToday = task.due === today
  const kind = course ? learningType(task.learningType) : undefined
  const KindIcon = kind?.icon ?? CircleCheck
  const [tone, label]: [Tone, string] = n < 0 ? ["red", `${-n}d overdue`] : n === 0 ? ["red", "Today"] : n === 1 ? ["yellow", "Tomorrow"] : ["grey", `${n} days`]
  const to = course ? courseHref(course.id) : logHref(task.due!)
  return (
    <li>
      <Link to={to} className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 hover:bg-raised">
        <span className={cn("flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none", !isToday && "bg-raised")} style={isToday ? { background: color, color: "#fff" } : undefined}>
          <span className="text-[10.5px] opacity-80">{format(date, "EEE")}</span>
          <span className="mt-0.5 text-lg font-semibold">{format(date, "d")}</span>
        </span>
        <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-ink">{task.title}</span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            <KindIcon className="size-3.5 shrink-0" aria-hidden />
            {course ? `${course.code} · ${kind!.label}` : "Planner task"}
            {task.time && ` · ${formatTime(task.time)}`}
          </span>
        </span>
        <Pill tone={tone}>{label}</Pill>
      </Link>
    </li>
  )
}

// ---------------------------------------------------------------- Repositories

/** Matches the server's per-account cap in githubOverview (server/providers/github.ts). */
const REPO_LIMIT = 10

export function lastDays(byDay: Record<string, number> | undefined, days: number) {
  const out: number[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) out.push(byDay?.[toDateKey(subDays(now, i))] ?? 0)
  return out
}

/** 14-day commit bars in the account's color; the last 4 days at full strength (Ant Tiny.Column). */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const w = 8, gap = 3, h = 32
  return (
    <svg width={values.length * (w + gap) - gap} height={h} aria-hidden className="shrink-0">
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * h)
        return <rect key={i} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx={2} fill={color} opacity={i < values.length - 4 ? 0.45 : 1} />
      })}
    </svg>
  )
}

export function RepositoriesPanel() {
  const feed = useGitHubAccounts()
  const links = useWorkspace((s) => s.repos)
  const [only, setOnly] = useState<string>("all")
  const accounts = feed.data ?? []
  const multi = accounts.length > 1
  const visible = accounts.filter((a) => only === "all" || a.id === only)
  // The server reads up to REPO_LIMIT repositories per account; the rest are listed but not read.
  const rows = visible.flatMap((a) => a.repos.map((repo, i) => ({ repo, a, capped: i >= REPO_LIMIT, info: a.overview?.repos?.find((r) => r.repo === repo), failures: a.overview?.failures.filter((f) => f.repo === repo).length ?? 0 })))
  const repoErrors = visible.filter((a) => a.error)
  const commits30 = rows.reduce((sum, r) => sum + lastDays(r.info?.commitsByDay, 30).reduce((x, y) => x + y, 0), 0)
  const prs = visible.reduce((sum, a) => sum + (a.overview?.prs.length ?? 0), 0)
  const failing = visible.reduce((sum, a) => sum + (a.overview?.failures.length ?? 0), 0)

  return (
    <Panel
      category="development"
      title="Repositories"
      subtitle={feed.data ? `${links.length} tracked${multi ? ` across ${accounts.length} accounts` : ""}` : undefined}
      tool="github"
      command="repos"
      badge={feed.status !== "live" ? <SourceBadge status={feed.status} /> : undefined}
      actions={multi ? (
        <div role="radiogroup" aria-label="Show account" className="flex flex-wrap gap-1.5">
          <AccountFilter active={only === "all"} onClick={() => setOnly("all")}>All</AccountFilter>
          {accounts.map((a) => <AccountFilter key={a.id} active={only === a.id} onClick={() => setOnly(a.id)}><AccountChip look={a.look} name={a.label} className="bg-transparent! px-0 py-0" /></AccountFilter>)}
        </div>
      ) : undefined}
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {!links.length ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
          Track the repositories you want to watch. Each can be read by any of your GitHub accounts.
          <Button variant="outline" size="sm" onClick={() => useUi.getState().openForm({ kind: "repo" })}><Plus /> Track a repository</Button>
        </div>
      ) : feed.data ? (
        <div className="px-5 py-5">
          {repoErrors.map((a) => <p key={a.id} className="mb-3 text-xs text-red-text">{a.label}: {a.error}</p>)}
          <div className="grid grid-cols-1 gap-4 @container sm:grid-cols-3">
            <Stat label="Commits · 30 days" value={commits30} />
            <Stat label="Open pull requests" value={prs} />
            <Stat label="Failing CI" value={failing} tone={failing ? "red" : undefined} />
          </div>
          <p className="mt-6 mb-2 text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Tracked repositories</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="text-xs text-faint">
                  <th className="py-2 pr-4 font-normal">Repository</th>
                  <th className="py-2 pr-4 font-normal">Commits · 14 days</th>
                  <th className="py-2 pr-4 font-normal">CI</th>
                  <th className="py-2 font-normal">Pushed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ repo, a, info, failures, capped }) => {
                  const days = lastDays(info?.commitsByDay, 14)
                  return (
                    <tr key={`${a.id}-${repo}`} className="border-t border-line-soft">
                      <td className="py-3 pr-4 align-middle">
                        <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="block truncate font-mono text-[13.5px] font-semibold text-ink hover:underline">{repo.split("/")[1]}</a>
                        <AccountChip look={a.look} name={multi ? a.label : repo.split("/")[0]} className="mt-1" />
                      </td>
                      <td className="py-3 pr-4"><span className="flex items-end gap-2">{info ? <><Sparkline values={days} color={a.look.color} /><span className="text-xs text-muted-foreground tabular-nums">{days.reduce((x, y) => x + y, 0)}</span></> : <span className="text-xs text-faint">{a.error ? "Unavailable" : capped ? `Not read (over ${REPO_LIMIT} per account)` : "—"}</span>}</span></td>
                      <td className="py-3 pr-4 text-[13.5px]">
                        {a.error || capped ? <span className="text-faint">—</span> : (
                          <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: failures ? TONE.red : TONE.green }} aria-hidden />{failures ? `${failures} failing` : "No failed runs"}</span>
                        )}
                      </td>
                      <td className="py-3 text-[13px] text-muted-foreground">{info?.pushedAt ? timeAgo(info.pushedAt) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4"><FeedFallback feed={feed} provider="github" what="activity for your tracked repositories" /></div>
      )}
      <PanelFooter left={feed.status === "live" ? "Live from GitHub" : feed.status === "sample" ? "Sample data" : undefined}>
        <button type="button" className={footerLink} onClick={() => useUi.getState().openForm({ kind: "repo" })}>Track a repository <Plus className="size-3.5" aria-hidden /></button>
      </PanelFooter>
    </Panel>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className="rounded-xl bg-raised px-4 py-3.5">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-[26px] leading-none font-semibold tabular-nums" style={tone ? { color: TONE[tone] } : undefined}>{value}</p>
    </div>
  )
}

function AccountFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-medium", active ? "bg-ink text-ground" : "bg-raised text-ink-2 hover:text-ink")}>
      {children}
    </button>
  )
}
