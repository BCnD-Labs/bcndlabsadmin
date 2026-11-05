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
  /** The raw failure code (CERT_HAS_EXPIRED, ECONNREFUSED…), for anyone who wants to search it. */
  error?: string
  /** The same failure in plain words, shown on the tile when a service is down. */
  reason?: string
}

/** What a failure means for the person looking at the tile. Unknown codes fall back to the code itself. */
const REASONS: Record<string, string> = {
  CERT_HAS_EXPIRED: "Certificate expired",
  CERT_NOT_YET_VALID: "Certificate not valid yet (check the server's clock)",
  ERR_TLS_CERT_ALTNAME_INVALID: "Certificate is for a different address",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Certificate isn't trusted",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "Certificate isn't trusted",
  SELF_SIGNED_CERT_IN_CHAIN: "Certificate is self-signed",
  DEPTH_ZERO_SELF_SIGNED_CERT: "Certificate is self-signed",
  ECONNREFUSED: "Connection refused (nothing is listening on that port)",
  ENOTFOUND: "Address not found",
  EAI_AGAIN: "Address not found",
  ECONNRESET: "Connection was reset",
  EHOSTUNREACH: "Host unreachable",
  ENETUNREACH: "Network unreachable",
  ETIMEDOUT: "Timed out connecting",
  UND_ERR_CONNECT_TIMEOUT: "Timed out connecting",
}
export const explainFailure = (code: string) => REASONS[code] ?? code

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
    return { url, up: res.status < 500, ms, status: res.status, ...(res.status >= 500 ? { reason: `The service answered with an error (HTTP ${res.status})` } : {}) }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } }
    const error = err.name === "TimeoutError" ? "No answer within 5 seconds" : err.cause?.code ?? err.message
    return { url, up: false, error, reason: explainFailure(error) }
  }
}

export async function checkServices(urls: string[], fetchImpl: typeof fetch = fetch): Promise<ServiceStatus[]> {
  return Promise.all(urls.map((u) => checkOne(u, fetchImpl)))
}
