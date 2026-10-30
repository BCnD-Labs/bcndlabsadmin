import { addDays, format, startOfWeek } from "date-fns"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { parseKey, toDateKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { logHref } from "@/features/journal/daily-log-page"
import type { DayCount } from "./personal-stats"

const config = { count: { label: "Tasks completed", color: "var(--chart-1)" } } satisfies ChartConfig

function CompletedTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayCount }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="brutal rounded-lg bg-popover px-2.5 py-1.5 text-xs">
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
          <CartesianGrid vertical={false} stroke="var(--edge)" strokeDasharray="2 4" />
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
          <Bar dataKey="count" fill="var(--color-count)" stroke="#000" strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}

const LEVELS = ["bg-recessed", "bg-[color-mix(in_oklab,var(--chart-1)_35%,var(--recessed))]", "bg-[color-mix(in_oklab,var(--chart-1)_65%,var(--recessed))]", "bg-chart-1"]
const level = (w: number) => (w === 0 ? 0 : w < 50 ? 1 : w < 200 ? 2 : 3)

/** Daily log heatmap, one cell per day, darker = more words. Click a day to open its log. */
export function JournalHeatmap({ logWords, weeks = 16, cell = "size-3" }: { logWords: Map<string, number>; weeks?: number; cell?: string }) {
  const navigate = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const start = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -(weeks - 1) * 7)
  const today = toDateKey(new Date())
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => toDateKey(addDays(start, w * 7 + d))))

  // On narrow screens, start scrolled to the most recent weeks.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div>
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="inline-grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "auto repeat(7, auto)" }} role="grid" aria-label="Daily log activity">
          {/* weekday labels */}
          <span />
          {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
            <span key={i} className="pr-1 text-[0.65rem] leading-none text-muted-foreground">{d}</span>
          ))}
          {cols.map((col, i) => {
            const first = parseKey(col[0])
            const showMonth = i === 0 || first.getDate() <= 7
            return [
              <span key={`m${i}`} className="h-3 text-[0.65rem] leading-none whitespace-nowrap text-muted-foreground">
                {showMonth ? format(first, "MMM") : ""}
              </span>,
              ...col.map((d) => {
                const w = logWords.get(d) ?? 0
                const future = d > today
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    disabled={future}
                    onClick={() => navigate(logHref(d))}
                    title={`${format(parseKey(d), "EEE, MMM d")}: ${w ? `${w} words` : "no log"}`}
                    aria-label={`${format(parseKey(d), "MMMM d")}: ${w ? `${w} words` : "no log"}`}
                    className={cn(
                      cell,
                      "rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      future ? "bg-transparent" : LEVELS[level(w)],
                      d === today && "ring-1 ring-amber",
                    )}
                  />
                )
              }),
            ]
          })}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
        Less
        {LEVELS.map((c) => <span key={c} className={cn("size-2.5 rounded-[2px]", c)} aria-hidden />)}
        More words
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "red" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("pixel-num text-4xl text-foreground", tone === "red" && "text-red")}>
        {value}
        {sub && <span className="ml-1.5 font-sans text-xs tracking-normal text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  )
}
