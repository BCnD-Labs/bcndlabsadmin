import { addDays, getDay } from "date-fns"
import { toDateKey } from "@/lib/dates"
import { mulberry32 } from "./prng"
import type { AnalyticsReport, TrafficPoint, TrafficRange } from "./types"

/**
 * Sample analytics, shown only when "Show sample data" is on and no analytics
 * provider is connected. Deterministic so it's stable across reloads.
 */
function buildSeries(): TrafficPoint[] {
  const rand = mulberry32(20261029)
  const end = addDays(new Date(), -1)
  const points: TrafficPoint[] = []
  for (let i = 89; i >= 0; i--) {
    const day = addDays(end, -i)
    const dow = getDay(day)
    const weekday = dow === 0 || dow === 6 ? 0.72 : 1
    const trend = 1 + (89 - i) * 0.006
    const spike = i === 23 ? 2.4 : i === 22 ? 1.5 : 1
    const noise = 0.85 + rand() * 0.3
    const visitors = Math.round(118 * weekday * trend * spike * noise)
    const depth = 1.6 + rand() * 0.7
    points.push({
      date: toDateKey(day),
      visitors,
      pageviews: Math.round(visitors * depth),
    })
  }
  return points
}

const series = buildSeries()

const pages: Array<[string, number]> = [
  ["/", 0.34],
  ["/projects", 0.18],
  ["/blog/first-post", 0.12],
  ["/about", 0.1],
  ["/projects/example", 0.07],
  ["/contact", 0.05],
]

const referrers: Array<[string, number]> = [
  ["Direct", 0.41],
  ["Search", 0.29],
  ["GitHub", 0.14],
  ["Social", 0.1],
  ["Other", 0.06],
]

export function sampleAnalytics(range: TrafficRange): AnalyticsReport {
  const traffic = series.slice(-range)
  const pv = traffic.reduce((a, p) => a + p.pageviews, 0)
  const v = traffic.reduce((a, p) => a + p.visitors, 0)
  return {
    traffic,
    pages: pages.map(([path, share]) => ({ path, pageviews: Math.round(pv * share), visitors: Math.round(v * share * 0.9) })),
    referrers: referrers.map(([source, share]) => ({ source, visitors: Math.round(v * share) })),
  }
}
