import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { CategoryIcon, type Category } from "@/components/common/category-icon"
import { SourceBadge } from "@/components/common/source-badge"
import { hasData } from "@/components/common/feed-fallback"
import { useNow } from "@/hooks/use-now"
import { daysUntil, toDateKey } from "@/lib/dates"
import { DEVELOPMENT, learningHref, plannerHref, siteAnalyticsHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useAnalytics, useDevelopment } from "@/services/data"
import { useWorkspace } from "@/stores/workspace"

/**
 * Home's KPI row, after shadcn's dashboard-01 SectionCards: equal cards with a
 * label, one large number, a status in the top-right and two lines of context.
 * External numbers keep their source badge; unavailable numbers show a dash.
 */
function StatCard({ to, category, label, value, action, line, sub, summary }: {
  to: string
  /** Spoken name for the whole card link, e.g. "Open tasks: 12, 4 overdue. Open Planner". */
  summary: string
  category: Category
  label: string
  value: ReactNode
  action?: ReactNode
  line: ReactNode
  sub: ReactNode
}) {
  return (
    <Link
      to={to}
      aria-label={summary}
      data-category={category}
      className="bw-panel group flex min-w-0 flex-col gap-3 p-3.5 transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start gap-2.5">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-heading text-[26px] leading-none font-bold tabular-nums text-ink">{value}</p>
        </div>
        {action}
      </div>
      <div className="mt-auto min-w-0 text-xs">
        <p className="flex items-center gap-1.5 truncate font-medium text-ink-2">{line}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-muted-foreground">
          {sub}
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none" aria-hidden />
        </p>
      </div>
    </Link>
  )
}

const dash = <span className="text-faint">—</span>
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`

export function StatCards() {
  const tasks = useWorkspace((s) => s.tasks)
  const drafts = useWorkspace((s) => s.drafts)
  const today = toDateKey(useNow())
  const dev = useDevelopment()
  const traffic = useAnalytics(30)

  const open = tasks.filter((t) => !t.done)
  const overdue = open.filter((t) => t.due && t.due < today).length
  const dueToday = open.filter((t) => t.due === today).length
  // "This week" = due today through the next 7 days; overdue coursework is flagged separately.
  const courseOpen = open.filter((t) => t.courseId && t.due)
  const coursework = courseOpen.filter((t) => { const n = daysUntil(t.due!); return n >= 0 && n <= 7 })
  const courseOverdue = courseOpen.filter((t) => daysUntil(t.due!) < 0).length
  const nextUp = [...coursework].sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))[0]

  const d = hasData(dev) ? dev.data : undefined
  const reviews = d?.prs.filter((p) => p.kind === "review-requested").length ?? 0
  const t = hasData(traffic) ? traffic.data.traffic : undefined
  const visitors = t?.reduce((a, p) => a + p.visitors, 0)
  const pageviews = t?.reduce((a, p) => a + p.pageviews, 0)
  const postDrafts = drafts.filter((x) => x.kind === "post").length

  return (
    <section aria-label="Overview" className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        to={plannerHref}
        category="tasks"
        label="Open tasks"
        summary={`Open tasks: ${open.length}${overdue ? `, ${overdue} overdue` : ""}. Open Planner`}
        value={open.length}
        action={overdue > 0 ? <Pill tone="amber">{overdue} overdue</Pill> : undefined}
        line={dueToday ? `${plural(dueToday, "task")} due today` : "Nothing due today"}
        sub="Planner"
      />
      <StatCard
        to={learningHref}
        category="learning"
        label="Coursework due this week"
        summary={`Coursework due this week: ${coursework.length}${courseOverdue ? `, ${courseOverdue} overdue` : ""}. Open Learning`}
        value={coursework.length}
        action={courseOverdue > 0 ? <Pill tone="amber">{courseOverdue} overdue</Pill> : undefined}
        line={nextUp ? <span className="truncate">Next: {nextUp.title}</span> : "Nothing due in 7 days"}
        sub="Learning"
      />
      <StatCard
        to={DEVELOPMENT}
        category="development"
        label="Open pull requests"
        summary={d ? `Open pull requests: ${d.prs.length}, ${plural(d.failures.length, "failed run")}. Open GitHub activity` : "Open pull requests: unavailable. Open GitHub activity"}
        value={d ? d.prs.length : dash}
        action={<SourceBadge status={dev.status} focusable={false} />}
        line={d ? (d.failures.length ? <span className="text-red-text">{plural(d.failures.length, "failed run")}</span> : "Latest runs passing") : "GitHub data unavailable"}
        sub={d ? (reviews ? `${reviews} waiting on your review` : "None waiting on you") : "GitHub activity"}
      />
      <StatCard
        to={siteAnalyticsHref}
        category="analytics"
        label="Visitors · 30 days"
        summary={visitors !== undefined ? `Visitors in the last 30 days: ${visitors}, ${pageviews} pageviews. Open Website traffic` : "Visitors: unavailable. Open Website traffic"}
        value={visitors ?? dash}
        action={<SourceBadge status={traffic.status} focusable={false} />}
        line={pageviews !== undefined ? `${pageviews} pageviews` : "Traffic unavailable"}
        sub={plural(postDrafts, "post draft")}
      />
    </section>
  )
}

function Pill({ tone, children }: { tone: "amber"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium", tone === "amber" && "bg-amber/12 text-amber")}>
      <span className="size-1.5 rounded-[1.5px] bg-amber" aria-hidden />
      {children}
    </span>
  )
}
