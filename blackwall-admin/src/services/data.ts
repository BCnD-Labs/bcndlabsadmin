import { useCallback, useEffect, useState } from "react"
import { usePrefs } from "@/stores/prefs"
import { useWorkspace } from "@/stores/workspace"
import { sampleAnalytics } from "./analytics-demo"
import { api, useConnectionFor } from "./connector"
import { sampleDevelopment } from "./github-demo"
import type { AnalyticsReport, DevelopmentOverview, SourceStatus, TrafficRange } from "./types"

/**
 * Data feeds for panels. Each resolves to live data (via the local connector),
 * sample data (only when the user turns samples on), or a not-connected/error
 * state. Panels render the status with <SourceBadge>.
 */
export interface Feed<T> {
  status: SourceStatus
  data?: T
  error?: string
  /** e.g. "@octocat" or "Plausible" */
  provider?: string
  refresh: () => void
}

const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

/** Forget everything fetched from connections (Settings → General → Clear cache). */
export function clearFeedCache() {
  cache.clear()
}

function cachedApi<T>(path: string, ttlMs: number, force = false): Promise<T> {
  const hit = cache.get(path)
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>
  const promise = api<T>(path)
  cache.set(path, { at: Date.now(), promise })
  promise.catch(() => cache.delete(path))
  return promise
}

function useLive<T>(path: string | null, ttlMs: number) {
  const [state, setState] = useState<{ path?: string; data?: T; error?: string }>({})
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    cachedApi<T>(path, ttlMs, nonce > 0)
      .then((data) => live && setState({ path, data }))
      .catch((e: Error) => live && setState({ path, error: e.message }))
    return () => {
      live = false
    }
  }, [path, ttlMs, nonce])
  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const current = state.path === path ? state : {}
  return { ...current, loading: !!path && !current.data && !current.error, refresh }
}

export function useDevelopment(): Feed<DevelopmentOverview> {
  const repos = useWorkspace((s) => s.repos).map((r) => r.fullName)
  const conn = useConnectionFor("github")
  const samples = usePrefs((s) => s.showSamples)
  const usable = conn && conn.status === "ok"
  const live = useLive<DevelopmentOverview>(usable ? `github/overview?repos=${encodeURIComponent(repos.join(","))}` : null, 120_000)

  if (usable) {
    if (live.error) return { status: "error", error: live.error, provider: conn.account, refresh: live.refresh }
    return { status: live.loading ? "loading" : "live", data: live.data, provider: conn.account, refresh: live.refresh }
  }
  if (conn?.status === "error") return { status: "error", error: conn.message, refresh: live.refresh }
  if (samples) return { status: "sample", data: sampleDevelopment(repos), refresh: live.refresh }
  return { status: "not-connected", refresh: live.refresh }
}

const ANALYTICS_NAME: Record<string, string> = { plausible: "Plausible", umami: "Umami", cloudflare: "Cloudflare" }

export function useAnalytics(range: TrafficRange): Feed<AnalyticsReport> {
  const conn = useConnectionFor("analytics")
  const samples = usePrefs((s) => s.showSamples)
  const usable = conn && conn.status === "ok"
  const live = useLive<AnalyticsReport>(usable ? `analytics/report?days=${range}` : null, 300_000)
  const provider = conn ? ANALYTICS_NAME[conn.config.provider] ?? conn.label : undefined

  if (usable) {
    if (live.error) return { status: "error", error: live.error, provider, refresh: live.refresh }
    return { status: live.loading ? "loading" : "live", data: live.data, provider, refresh: live.refresh }
  }
  if (conn?.status === "error") return { status: "error", error: conn.message, provider, refresh: live.refresh }
  if (samples) return { status: "sample", data: sampleAnalytics(range), refresh: live.refresh }
  return { status: "not-connected", refresh: live.refresh }
}
