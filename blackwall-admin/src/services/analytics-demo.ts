import { addDays, getDay } from "date-fns"
import { toDateKey } from "@/lib/dates"
import { mulberry32 } from "./prng"
import type {
  AnalyticsService,
  PageStat,
  ReferrerStat,
  TrafficPoint,
  TrafficRange,
} from "./types"

/**
 * Demo analytics adapter. Generates a plausible, deterministic 90-day series
 * ending yesterday. It is NOT website data — the UI labels it "Demo data".
 * Replace with an adapter for whichever provider bcndlabs.com uses.
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
  ["/writing/introducing-blackwall", 0.12],
  ["/about", 0.1],
  ["/projects/mikoshi", 0.07],
  ["/contact", 0.05],
]

const referrers: Array<[string, number]> = [
  ["Direct", 0.41],
  ["Search", 0.29],
  ["GitHub", 0.14],
  ["Social", 0.1],
  ["Other", 0.06],
]

const slice = (range: TrafficRange) => series.slice(-range)

export const demoAnalytics: AnalyticsService = {
  source: { status: "demo", provider: "Sample generator" },
  async getTraffic(range) {
    return slice(range)
  },
  async getTopPages(range): Promise<PageStat[]> {
    const s = slice(range)
    const pv = s.reduce((a, p) => a + p.pageviews, 0)
    const v = s.reduce((a, p) => a + p.visitors, 0)
    return pages.map(([path, share]) => ({
      path,
      pageviews: Math.round(pv * share),
      visitors: Math.round(v * share * 0.9),
    }))
  },
  async getReferrers(range): Promise<ReferrerStat[]> {
    const v = slice(range).reduce((a, p) => a + p.visitors, 0)
    return referrers.map(([source, share]) => ({
      source,
      visitors: Math.round(v * share),
    }))
  },
}
