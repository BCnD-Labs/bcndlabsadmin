/**
 * Up/down for Mikoshi launcher tiles, checked from the Blackwall server (it sits on the
 * same Tailscale network as the services; the browser can't check cross-origin pages).
 * Any HTTP answer, even 401 or 403, means the service is up: it's reachable and talking.
 * Only connection failures, timeouts and 5xx answers count as down.
 */
export interface ServiceStatus {
  url: string
  up: boolean
  /** Round-trip time in ms when it answered. */
  ms?: number
  status?: number
  error?: string
}

const TIMEOUT_MS = 5000
export const MAX_URLS = 60

export function validStatusUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_URLS) return undefined
  const urls = value.filter((u): u is string => typeof u === "string" && u.length <= 2048 && /^https?:\/\//i.test(u))
  return urls.length === value.length ? [...new Set(urls)] : undefined
}

export async function checkOne(url: string, fetchImpl: typeof fetch = fetch): Promise<ServiceStatus> {
  const started = performance.now()
  try {
    const res = await fetchImpl(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Blackwall status check" } })
    const ms = Math.round(performance.now() - started)
    void res.body?.cancel().catch(() => undefined)
    return { url, up: res.status < 500, ms, status: res.status }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    const error = err.name === "TimeoutError" ? "No answer within 5 seconds" : err.cause?.code ?? err.message
    return { url, up: false, error }
  }
}

export async function checkServices(urls: string[], fetchImpl: typeof fetch = fetch): Promise<ServiceStatus[]> {
  return Promise.all(urls.map((u) => checkOne(u, fetchImpl)))
}
