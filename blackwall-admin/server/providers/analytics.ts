import type { AnalyticsReport, PageStat, ReferrerStat, TrafficPoint } from "../../shared/connections.ts"
import type { StoredConnection } from "../store.ts"
import { ProviderError, dateKey, daysAgo, fmtCount, getJson, need } from "../http.ts"
import { cfFetch } from "./cloudflare.ts"
import type { TestResult } from "./index.ts"

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Range ends yesterday (today is incomplete) and covers `days` days. */
function window(days: number) {
  const from = daysAgo(days)
  const to = daysAgo(1)
  const keys: string[] = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) keys.push(dateKey(d))
  return { from, to, keys }
}

function fill(keys: string[], rows: Map<string, Partial<TrafficPoint>>): TrafficPoint[] {
  return keys.map((date) => ({ date, visitors: rows.get(date)?.visitors ?? 0, pageviews: rows.get(date)?.pageviews ?? 0 }))
}

async function plausible(c: StoredConnection, days: number): Promise<AnalyticsReport> {
  const base = (c.config.baseUrl || "https://plausible.io").replace(/\/$/, "")
  const site = need(c.config.siteId, "Site domain")
  const headers = { Authorization: `Bearer ${need(c.secrets.apiKey, "API key")}` }
  const { from, to, keys } = window(days)
  const q = `site_id=${encodeURIComponent(site)}&period=custom&date=${dateKey(from)},${dateKey(to)}`
  const get = (path: string) => getJson<any>(`${base}/api/v1/stats/${path}&${q}`, { headers }, "Plausible")
  const [series, pages, refs] = await Promise.all([
    get("timeseries?metrics=visitors,pageviews"),
    get("breakdown?property=event:page&metrics=visitors,pageviews&limit=8"),
    get("breakdown?property=visit:source&metrics=visitors&limit=8"),
  ])
  return {
    traffic: fill(keys, new Map((series.results as any[]).map((r) => [r.date, r]))),
    pages: (pages.results as any[]).map((r) => ({ path: r.page, visitors: r.visitors, pageviews: r.pageviews })),
    referrers: (refs.results as any[]).map((r) => ({ source: r.source, visitors: r.visitors })),
  }
}

async function umami(c: StoredConnection, days: number): Promise<AnalyticsReport> {
  const base = need(c.config.umamiUrl, "API URL").replace(/\/$/, "")
  const id = need(c.config.websiteId, "Website ID")
  const key = need(c.secrets.apiKey, "API key")
  // Umami Cloud uses x-umami-api-key; self-hosted instances use a Bearer token.
  const headers = { "x-umami-api-key": key, Authorization: `Bearer ${key}` }
  const { from, keys } = window(days)
  const end = daysAgo(0).getTime() - 1
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const q = `startAt=${from.getTime()}&endAt=${end}`
  const get = (path: string) => getJson<any>(`${base}/websites/${id}/${path}`, { headers }, "Umami")

  const series = await get(`pageviews?${q}&unit=day&timezone=${encodeURIComponent(tz)}`)
  const rows = new Map<string, Partial<TrafficPoint>>()
  for (const p of series.pageviews ?? []) rows.set(String(p.x).slice(0, 10), { ...rows.get(String(p.x).slice(0, 10)), pageviews: p.y })
  for (const s of series.sessions ?? []) rows.set(String(s.x).slice(0, 10), { ...rows.get(String(s.x).slice(0, 10)), visitors: s.y })

  // Newer Umami versions call the URL metric "path".
  const pages = await get(`metrics?${q}&type=path&limit=8`).catch(() => get(`metrics?${q}&type=url&limit=8`))
  const refs = await get(`metrics?${q}&type=referrer&limit=8`).catch(() => [])
  return {
    traffic: fill(keys, rows),
    pages: (pages as any[]).map((r): PageStat => ({ path: r.x, pageviews: r.y, visitors: 0 })),
    referrers: (refs as any[]).map((r): ReferrerStat => ({ source: r.x || "Direct", visitors: r.y })),
  }
}

async function cloudflareWeb(c: StoredConnection, days: number): Promise<AnalyticsReport> {
  const token = need(c.secrets.apiKey, "API token")
  const { from, keys } = window(days)
  const query = `query($account: string, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
    viewer { accounts(filter: { accountTag: $account }) {
      series: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter, orderBy: [date_ASC]) { count sum { visits } dimensions { date } }
      pages: rumPageloadEventsAdaptiveGroups(limit: 8, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { requestPath } }
      refs: rumPageloadEventsAdaptiveGroups(limit: 8, filter: $filter, orderBy: [sum_visits_DESC]) { sum { visits } dimensions { refererHost } }
    } } }`
  const variables = {
    account: need(c.config.accountId, "Account ID"),
    filter: { AND: [{ datetime_geq: from.toISOString(), datetime_lt: daysAgo(0).toISOString() }, { siteTag: need(c.config.siteTag, "Site tag") }] },
  }
  const res = await cfFetch(token, "/graphql", { method: "POST", body: JSON.stringify({ query, variables }) })
  if (res.errors?.length) throw new ProviderError(`Cloudflare: ${res.errors[0].message}`)
  const acct = res.data?.viewer?.accounts?.[0]
  if (!acct) throw new ProviderError("Cloudflare: account not found for this token")
  return {
    traffic: fill(keys, new Map((acct.series as any[]).map((r) => [r.dimensions.date, { pageviews: r.count, visitors: r.sum.visits }]))),
    pages: (acct.pages as any[]).map((r) => ({ path: r.dimensions.requestPath, pageviews: r.count, visitors: r.sum.visits })),
    referrers: (acct.refs as any[]).map((r) => ({ source: r.dimensions.refererHost || "Direct", visitors: r.sum.visits })),
  }
}

export function analyticsReport(c: StoredConnection, days: number): Promise<AnalyticsReport> {
  switch (c.config.provider) {
    case "plausible":
      return plausible(c, days)
    case "umami":
      return umami(c, days)
    case "cloudflare":
      return cloudflareWeb(c, days)
    default:
      throw new ProviderError("Choose an analytics provider", 400)
  }
}

export async function testAnalytics(c: StoredConnection): Promise<TestResult> {
  const r = await analyticsReport(c, 7)
  const visitors = r.traffic.reduce((a, p) => a + p.visitors, 0)
  const pageviews = r.traffic.reduce((a, p) => a + p.pageviews, 0)
  const name = { plausible: "Plausible", umami: "Umami", cloudflare: "Cloudflare Web Analytics" }[c.config.provider] ?? "Analytics"
  return {
    status: "ok",
    account: c.config.siteId || c.config.websiteId || c.config.siteTag || name,
    summary: [
      { label: "Provider", value: name },
      { label: "Last 7 days", value: `${fmtCount(visitors)} visitors · ${fmtCount(pageviews)} pageviews` },
    ],
  }
}
