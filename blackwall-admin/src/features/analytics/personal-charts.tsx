import { addDays, format, startOfWeek } from "date-fns"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useNavigate } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { parseKey, toDateKey, weekStart } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { logHref } from "@/lib/routes"
import type { DayCount } from "./personal-stats"

const config = { count: { label: "Tasks completed", color: "var(--chart-1)" } } satisfies ChartConfig

function CompletedTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayCount }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="bw-float rounded-[8px] border-solid bg-raised px-2.5 py-1.5 text-[11px]">
      <div className="font-bold">{format(parseKey(p.date), "EEE, MMM d")}</div>
      <div className="text-muted-foreground">
        <span className="font-mono text-foreground">{p.count}</span> {p.count === 1 ? "task" : "tasks"} completed
      </div>
    </div>
  )
}

/** Tasks completed per day. Single series, so no legend; the title names it. */
export function CompletedChart({ data, className }: { data: DayCount[]; className?: string }) {
  const every = data.length <= 14 ? 2 : 7
  const ticks = data.filter((_, i) => (data.length - 1 - i) % every === 0).map((d) => d.date)
  const max = Math.max(3, ...data.map((d) => d.count))
  return (
    <figure className={cn("relative", className)}>
      <figcaption className="sr-only">Tasks completed per day over the last {data.length} days.</figcaption>
      <ChartContainer config={config} className="aspect-auto h-full w-full">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--bw-line)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(d: string) => format(parseKey(d), data.length <= 14 ? "EEE d" : "MMM d")}
          />
          <YAxis allowDecimals={false} domain={[0, max]} width={36} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<CompletedTip />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}

const LEVELS = ["bg-off", "bg-[color-mix(in_oklab,var(--chart-1)_35%,var(--bw-off))]", "bg-[color-mix(in_oklab,var(--chart-1)_65%,var(--bw-off))]", "bg-chart-1"]
const level = (w: number) => (w === 0 ? 0 : w < 50 ? 1 : w < 200 ? 2 : 3)

/** Daily log heatmap, one cell per day, darker = more words. Click a day to open its log. */
export function JournalHeatmap({ logWords, weeks = 16, cell = "size-3" }: { logWords: Map<string, number>; weeks?: number; cell?: string }) {
  const navigate = useNavigate()
  const phone = useMediaQuery("(max-width: 639px)")
  const [expanded, setExpanded] = useState(false)
  const shownWeeks = phone && !expanded ? Math.min(8, weeks) : weeks
  const start = addDays(startOfWeek(new Date(), { weekStartsOn: weekStart() }), -(shownWeeks - 1) * 7)
  const today = toDateKey(new Date())
  const cols = Array.from({ length: shownWeeks }, (_, w) => Array.from({ length: 7 }, (_, d) => toDateKey(addDays(start, w * 7 + d))))

  return (
    <div>
      {phone && <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Recent {shownWeeks} weeks · ending this week</span><Button variant="outline" onClick={() => setExpanded(!expanded)}>{expanded ? "Recent 8 weeks" : "Expand history"}</Button></div>}
      <div className="overflow-x-auto pb-1">
        <div className={cn("flex gap-[3px]", phone ? "flex-wrap" : "w-max")} role="group" aria-label="Daily log activity">
          {/* weekday labels */}
          {!phone && <div className="flex w-7 shrink-0 flex-col gap-[3px]"><span className="h-3" />{["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => <span key={i} className="h-3 pr-1 text-[10px] leading-none text-muted-foreground">{d}</span>)}</div>}
          {cols.map((col, i) => {
            const first = parseKey(col[0])
            const showMonth = i === 0 || first.getDate() <= 7
            return <div key={col[0]} className="flex flex-col gap-[3px]">
              <span className="h-3 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                {showMonth ? format(first, "MMM") : ""}
              </span>
              {col.map((d) => {
                const w = logWords.get(d) ?? 0
                const future = d > today
                return (
                  <button
                    key={d}
                    type="button"

                    disabled={future}
                    onClick={() => navigate(logHref(d))}
                    title={`${format(parseKey(d), "EEE, MMM d")}: ${w ? `${w} words` : "no log"}`}
                    aria-label={`${format(parseKey(d), "MMMM d")}: ${w ? `${w} words` : "no log"}`}
                    className={cn(
                      phone ? "size-8" : cell,
                      "rounded-[2px]",
                      future ? "bg-transparent" : LEVELS[level(w)],
                      d === today && "ring-1 ring-ink-2",
                    )}
                  />
                )
              })}
            </div>
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        Less
        {LEVELS.map((c) => <span key={c} className={cn("size-2.5 rounded-[2px]", c)} aria-hidden />)}
        More words
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="bw-label">{label}</dt>
      <dd className={cn("mt-1.5 font-heading text-3xl leading-none font-bold text-ink tabular-nums", tone === "warn" && "text-amber")}>
        {value}
        {sub && <span className="ml-1.5 font-sans text-[11px] font-normal tracking-normal text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  )
}
