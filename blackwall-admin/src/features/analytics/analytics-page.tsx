import { useState } from "react"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { services } from "@/services"
import type { TrafficRange } from "@/services/types"
import { useServiceData } from "@/services/use-service"
import { RangeToggle, TrafficChart, TrafficSummary } from "./traffic-chart"

const fmt = new Intl.NumberFormat("en")

export function AnalyticsPage() {
  const [range, setRange] = useState<TrafficRange>(30)
  const a = services.analytics
  const traffic = useServiceData(() => a.getTraffic(range), [range])
  const pages = useServiceData(() => a.getTopPages(range), [range])
  const refs = useServiceData(() => a.getReferrers(range), [range])
  const badge = <SourceBadge status={a.source.status} hint="Generated sample data. Not bcndlabs.com traffic." />
  const maxRef = Math.max(1, ...(refs ?? []).map((r) => r.visitors))

  return (
    <>
      <PageHeader
        title="Website traffic"
        badge={badge}
        description={
          <>
            Sample series until an analytics provider is chosen.{" "}
            <Link to="/settings/integrations" className="text-teal hover:underline">What's needed</Link>
          </>
        }
        actions={<RangeToggle value={range} onChange={setRange} />}
      />
      <div className="grid gap-3 lg:grid-cols-12">
        <Panel title="Visitors & pageviews per day" badge={badge} className="lg:col-span-12" bodyClassName="flex flex-col gap-2 p-3">
          {traffic ? (
            <>
              <TrafficSummary data={traffic} />
              <TrafficChart data={traffic} range={range} className="h-80" />
            </>
          ) : (
            <Skeleton className="h-80" />
          )}
        </Panel>
        <Panel title="Top pages" badge={badge} className="lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow border-b text-left">
                  <th className="px-3 py-2 font-normal">Path</th>
                  <th className="px-3 py-2 text-right font-normal">Pageviews</th>
                  <th className="px-3 py-2 text-right font-normal">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {(pages ?? []).map((p) => (
                  <tr key={p.path} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-1.5 font-mono text-xs">{p.path}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt.format(p.pageviews)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt.format(p.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Referrers (visitors)" badge={badge} className="lg:col-span-5" bodyClassName="p-3">
          <ul className="space-y-2">
            {(refs ?? []).map((r) => (
              <li key={r.source} className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2 text-sm">
                <span className="text-muted-foreground">{r.source}</span>
                <span className="h-2.5 rounded-r-sm bg-recessed">
                  <span className="block h-full rounded-r-sm bg-chart-1" style={{ width: `${(r.visitors / maxRef) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-xs tabular-nums">{fmt.format(r.visitors)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
