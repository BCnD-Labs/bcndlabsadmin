import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { FeedFallback, hasData } from "@/components/common/feed-fallback"
import { SourceBadge } from "@/components/common/source-badge"
import { RangeToggle, TrafficChart, TrafficSummary } from "@/features/analytics/traffic-chart"
import { useAnalytics } from "@/services/data"
import type { TrafficRange } from "@/services/types"

export function TrafficPanel({ className }: { className?: string }) {
  const [range, setRange] = useState<TrafficRange>(30)
  const feed = useAnalytics(range)

  return (
    <Panel
      id="traffic"
      tool="site" command="traffic"
      badge={<SourceBadge status={feed.status} detail={feed.status === "live" ? feed.provider : undefined} />}
      className={className}
      actions={
        <>
          <RangeToggle value={range} onChange={setRange} />
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/analytics?view=website">Details</Link>
          </Button>
        </>
      }
      bodyClassName="flex flex-col gap-2 px-3 pt-2 pb-2"
    >
      {hasData(feed) ? (
        <>
          <TrafficSummary data={feed.data.traffic} />
          <TrafficChart data={feed.data.traffic} range={range} className="h-60 sm:h-64 lg:h-auto lg:min-h-72 lg:flex-1" />
          <p className="text-xs text-muted-foreground">Daily counts for the last {range} days, ending yesterday.</p>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <FeedFallback feed={feed} provider="analytics" what="visitors and pageviews" />
        </div>
      )}
    </Panel>
  )
}
