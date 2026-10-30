import { Activity } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { RangeToggle, TrafficChart, TrafficSummary } from "@/features/analytics/traffic-chart"
import { services } from "@/services"
import type { TrafficRange } from "@/services/types"
import { useServiceData } from "@/services/use-service"

export function TrafficPanel({ className }: { className?: string }) {
  const [range, setRange] = useState<TrafficRange>(30)
  const data = useServiceData(() => services.analytics.getTraffic(range), [range])

  return (
    <Panel
      id="traffic"
      title="Website traffic"
      icon={<Activity />}
      badge={<SourceBadge status={services.analytics.source.status} hint="Generated sample series. Not bcndlabs.com traffic." />}
      className={className}
      actions={
        <>
          <RangeToggle value={range} onChange={setRange} />
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/analytics">Details</Link>
          </Button>
        </>
      }
      bodyClassName="flex flex-col gap-2 px-3 pt-2 pb-2"
    >
      {data ? (
        <>
          <TrafficSummary data={data} />
          <TrafficChart data={data} range={range} className="h-60 sm:h-64 lg:h-auto lg:min-h-72 lg:flex-1" />
        </>
      ) : (
        <Skeleton className="h-72" />
      )}
      <p className="text-xs text-muted-foreground">
        Daily counts, last {range} days ending yesterday. Sample data until an analytics provider is connected.
      </p>
    </Panel>
  )
}
