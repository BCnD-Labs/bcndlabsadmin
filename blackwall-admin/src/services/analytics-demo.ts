import { addDays, getDay } from "date-fns"
import { toDateKey } from "@/lib/dates"
import { mulberry32 } from "./prng"
import type { AnalyticsReport, TrafficPoint, TrafficRange } from "./types"

/**
 * Sample analytics, shown only when "Show sample data" is on and no analytics
 * provider is connected. Deterministic so it's stable across reloads. Sized
 * like a new personal site (roughly 10–25 visitors a month), so the layout is
 * previewed with the numbers it will actually show.
 */
function buildSeries(): TrafficPoint[] {
  const rand = mulberry32(20261029)
  const end = addDays(new Date(), -1)
  const points: TrafficPoint[] = []
  for (let i = 89; i >= 0; i--) {
    const day = addDays(end, -i)
    const dow = getDay(day)
    const weekday = dow === 0 || dow === 6 ? 0.6 : 1
    const trend = 1 + (89 - i) * 0.008
    // A post shared somewhere, 23 days ago.
    const spike = i === 23 ? 4 : 1
    const chance = 0.42 * weekday * trend * spike
    const visitors = Math.floor(chance) + (rand() < chance % 1 ? 1 : 0)
    const depth = visitors ? 1 + Math.floor(rand() * 3) : 0
    points.push({ date: toDateKey(day), visitors, pageviews: visitors * depth })
  }
  return points
}

const series = buildSeries()

const pages: Array<[string, number]> = [
  ["/", 0.4],
  ["/pages/blog/blog.html", 0.25],
  ["/pages/about/about.html", 0.15],
  ["/pages/contact/contact.html", 0.08],
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
    pages: pages.map(([path, share]) => ({ path, pageviews: Math.round(pv * share), visitors: Math.round(v * share * 0.9) })).filter((p) => p.pageviews > 0),
    referrers: referrers.map(([source, share]) => ({ source, visitors: Math.round(v * share) })).filter((r) => r.visitors > 0),
  }
}
