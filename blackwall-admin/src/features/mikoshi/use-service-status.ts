import { useEffect, useState } from "react"
import { api } from "@/services/connector"
import type { Service } from "@/lib/types"

export interface ServiceStatus { url: string; up: boolean; ms?: number; status?: number; error?: string; reason?: string }

/**
 * Up/down for each tile, checked by the Blackwall server every minute while the page is
 * open (and visible). Uptime Kuma replaces this once it's connected.
 */
export function useServiceStatus(services: Service[]) {
  const urls = [...new Set(services.map((s) => s.url))].sort()
  const key = urls.join("|")
  const [state, setState] = useState<{ key: string; byUrl: Map<string, ServiceStatus>; checkedAt?: string; error?: string }>({ key: "", byUrl: new Map() })
  useEffect(() => {
    if (!urls.length) return
    let live = true
    const run = () => {
      if (document.visibilityState !== "visible") return
      api<{ checkedAt: string; results: ServiceStatus[] }>("services/status", { method: "POST", body: JSON.stringify({ urls: urls.slice(0, 60) }) })
        .then((r) => live && setState({ key, byUrl: new Map(r.results.map((x) => [x.url, x])), checkedAt: r.checkedAt }))
        .catch((e: Error) => live && setState((s) => ({ ...s, key, error: e.message })))
    }
    run()
    const t = window.setInterval(run, 60_000)
    document.addEventListener("visibilitychange", run)
    return () => {
      live = false
      window.clearInterval(t)
      document.removeEventListener("visibilitychange", run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const ready = state.key === key && state.byUrl.size > 0
  const all = ready ? urls.map((u) => state.byUrl.get(u)).filter((x): x is ServiceStatus => !!x) : []
  const up = all.filter((x) => x.up)
  const times = up.map((x) => x.ms ?? 0)
  return {
    get: (url: string) => (ready ? state.byUrl.get(url) : undefined),
    ready,
    error: state.key === key ? state.error : undefined,
    checkedAt: state.checkedAt,
    up: up.length,
    down: all.length - up.length,
    avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : undefined,
  }
}
