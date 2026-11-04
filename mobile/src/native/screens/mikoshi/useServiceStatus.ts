import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import { fetchServiceStatus, type ServiceStatus } from "../../../lib/service-status.ts"

const EVERY_MS = 60_000

/**
 * Up/down for the tools, asked of your Blackwall server (see lib/service-status). Checks when `enabled` turns on,
 * then once a minute, and again when the app comes back to the foreground; `check()` runs one on demand.
 */
export function useServiceStatus(address: string, urls: readonly string[], enabled: boolean) {
  const key = useMemo(() => [...new Set(urls)].sort().join("\n"), [urls])
  const [byUrl, setByUrl] = useState<ReadonlyMap<string, ServiceStatus>>(new Map())
  const [checkedAt, setCheckedAt] = useState<string>()
  const [error, setError] = useState<string>()
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const check = useCallback(async () => {
    if (!key) return
    const out = await fetchServiceStatus(address, key.split("\n"), fetch)
    if (!alive.current) return
    if (out.kind === "ok") { setByUrl(out.byUrl); setCheckedAt(out.checkedAt); setError(undefined) }
    else setError(out.kind === "signed-out" ? "Signed out. Sign in again from Settings." : out.message)
  }, [address, key])

  useEffect(() => {
    if (!enabled || !key) return
    void check()
    const timer = setInterval(() => { if (AppState.currentState === "active") void check() }, EVERY_MS)
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void check() })
    return () => { clearInterval(timer); sub.remove() }
  }, [enabled, key, check])

  return { byUrl, checkedAt, error, check }
}
