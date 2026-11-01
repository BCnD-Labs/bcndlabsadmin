import { format } from "date-fns"
import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { parseKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { TrafficPoint, TrafficRange } from "@/services/types"

/** Series colours: red (visitors) and light grey (pageviews), the two chart tokens. */
export const trafficConfig = {
  pageviews: { label: "Pageviews", color: "var(--chart-2)" },
  visitors: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig

export const RANGES: TrafficRange[] = [7, 30, 90]

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat("en")

export function RangeToggle({
  value,
  onChange,
  className,
}: {
  value: TrafficRange
  onChange: (r: TrafficRange) => void
  className?: string
}) {
  return (
    <SegmentedTabs
      label="Date range"
      value={String(value) as `${TrafficRange}`}
      onChange={(v) => onChange(Number(v) as TrafficRange)}
      tabs={RANGES.map((r) => ({ value: String(r) as `${TrafficRange}`, label: `${r}d` }))}
      className={cn("w-40", className)}
    />
  )
}

export function TrafficSummary({ data, className }: { data: TrafficPoint[]; className?: string }) {
  const totals = useMemo(() => {
    const visitors = data.reduce((a, p) => a + p.visitors, 0)
    const pageviews = data.reduce((a, p) => a + p.pageviews, 0)
    return { visitors, pageviews, depth: visitors ? pageviews / visitors : 0 }
  }, [data])
  return (
    <dl className={cn("flex flex-wrap gap-x-6 gap-y-1", className)}>
      <div className="flex items-baseline gap-2">
        <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-chart-1" aria-hidden /> Visitors
        </dt>
        <dd className="font-heading text-2xl leading-none font-bold">{full.format(totals.visitors)}</dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-chart-2" aria-hidden /> Pageviews
        </dt>
        <dd className="font-heading text-2xl leading-none font-bold">{full.format(totals.pageviews)}</dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-[11px] text-muted-foreground">Pages / visitor</dt>
        <dd className="font-heading text-2xl leading-none font-bold">{totals.depth.toFixed(2)}</dd>
      </div>
    </dl>
  )
}

type TipProps = { active?: boolean; payload?: Array<{ payload: TrafficPoint }> }

function TrafficTooltip({ active, payload }: TipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="bw-float min-w-40 rounded-[8px] border-solid bg-raised px-2.5 py-2 text-[11px]">
      <div className="mb-1.5 font-bold">{format(parseKey(p.date), "EEE, MMM d, yyyy")}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-[2px] bg-chart-1" aria-hidden />
        <span className="text-muted-foreground">Visitors</span>
        <span className="ml-auto font-mono tabular-nums">{full.format(p.visitors)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-[2px] bg-chart-2" aria-hidden />
        <span className="text-muted-foreground">Pageviews</span>
        <span className="ml-auto font-mono tabular-nums">{full.format(p.pageviews)}</span>
      </div>
      <div className="mt-1 border-t border-line pt-1 text-muted-foreground">
        {(p.pageviews / Math.max(p.visitors, 1)).toFixed(2)} pages per visitor
      </div>
    </div>
  )
}

/** Daily visitors & pageviews on one count axis (same unit, so no dual axis). */
export function TrafficChart({
  data,
  range,
  className,
}: {
  data: TrafficPoint[]
  range: TrafficRange
  className?: string
}) {
  const tickEvery = range === 7 ? 1 : range === 30 ? 5 : 14
  const ticks = data.filter((_, i) => (data.length - 1 - i) % tickEvery === 0).map((d) => d.date)

  return (
    <figure className={cn("relative", className)}>
      <figcaption className="sr-only">
        Daily website visitors and pageviews over the last {range} days.
      </figcaption>
      <ChartContainer config={trafficConfig} className="aspect-auto h-full w-full">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="fill-pageviews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-pageviews)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-pageviews)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fill-visitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--bw-line)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={8}
            minTickGap={12}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(d: string) => format(parseKey(d), range === 7 ? "EEE d" : "MMM d")}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => compact.format(v)}
            label={{ value: "per day", angle: -90, position: "insideLeft", offset: 6, style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={<TrafficTooltip />}
          />
          <Area
            dataKey="pageviews"
            type="monotone"
            stroke="var(--color-pageviews)"
            strokeWidth={2.5}
            fill="url(#fill-pageviews)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
          <Area
            dataKey="visitors"
            type="monotone"
            stroke="var(--color-visitors)"
            strokeWidth={2.5}
            fill="url(#fill-visitors)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </figure>
  )
}
