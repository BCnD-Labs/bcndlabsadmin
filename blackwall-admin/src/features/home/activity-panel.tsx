import { TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { CompletedChart, Stat } from "@/features/analytics/personal-charts"
import { usePersonalStats } from "@/features/analytics/personal-stats"

export function ActivityPanel({ className }: { className?: string }) {
  const s = usePersonalStats(14)
  const diff = s.thisWeek - s.lastWeek
  return (
    <Panel
      id="activity"
      title="Your activity"
      icon={<TrendingUp />}
      accent="teal"
      className={className}
      bodyClassName="flex flex-col gap-3 p-3"
      actions={
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/analytics">More charts</Link>
        </Button>
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Done this week" value={s.thisWeek} sub={s.lastWeek || s.thisWeek ? `${diff >= 0 ? "+" : ""}${diff} vs last` : undefined} />
        <Stat label="Task streak" value={s.doneStreak} sub={s.doneStreak === 1 ? "day" : "days"} />
        <Stat label="Log streak" value={s.logStreak} sub={s.logStreak === 1 ? "day" : "days"} />
      </dl>
      <div>
        <h3 className="eyebrow mb-1">Tasks completed · last 14 days</h3>
        <CompletedChart data={s.completed} className="h-40" />
      </div>
    </Panel>
  )
}
