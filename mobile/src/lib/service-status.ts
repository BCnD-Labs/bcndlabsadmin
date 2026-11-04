/**
 * Up/down for the Mikoshi tools, asked of your Blackwall server (it sits on the same Tailscale network as
 * the tools): `POST /api/services/status` with up to 60 http(s) addresses. Same rules as workspace-http:
 * `X-Blackwall: 1`, the shared sign-in cookie, fixed short messages, nothing from the response copied into them.
 * Pure apart from the injected fetch.
 */
export interface ServiceStatus { url: string; up: boolean; ms?: number; status?: number }
export type StatusOutcome =
  | { kind: "ok"; checkedAt: string; byUrl: Map<string, ServiceStatus> }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }

export const STATUS_TIMEOUT_MS = 15_000
export const MAX_STATUS_URLS = 60

export const statusUrl = (address: string): string => `${address.replace(/\/+$/, "")}/api/services/status`

/** The checked tools from a server answer, or null if the answer isn't in the expected shape. */
export function parseStatus(value: unknown): { checkedAt: string; byUrl: Map<string, ServiceStatus> } | null {
  if (!value || typeof value !== "object") return null
  const v = value as { checkedAt?: unknown; results?: unknown }
  if (typeof v.checkedAt !== "string" || !Array.isArray(v.results)) return null
  const byUrl = new Map<string, ServiceStatus>()
  for (const r of v.results) {
    if (!r || typeof r !== "object") return null
    const x = r as { url?: unknown; up?: unknown; ms?: unknown; status?: unknown }
    if (typeof x.url !== "string" || typeof x.up !== "boolean") return null
    byUrl.set(x.url, { url: x.url, up: x.up, ms: typeof x.ms === "number" ? x.ms : undefined, status: typeof x.status === "number" ? x.status : undefined })
  }
  return { checkedAt: v.checkedAt, byUrl }
}

export async function fetchServiceStatus(address: string, urls: readonly string[], fetchImpl: typeof fetch): Promise<StatusOutcome> {
  const list = [...new Set(urls)].filter((u) => /^https?:\/\//i.test(u)).slice(0, MAX_STATUS_URLS)
  if (!list.length) return { kind: "ok", checkedAt: new Date().toISOString(), byUrl: new Map() }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetchImpl(statusUrl(address), { method: "POST", body: JSON.stringify({ urls: list }), signal: controller.signal, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Blackwall": "1" } })
    } catch {
      return { kind: "error", message: "Couldn't reach the server to check the tools." }
    }
    if (res.status === 401) return { kind: "signed-out" }
    if (!res.ok) return { kind: "error", message: `The server answered ${res.status}.` }
    try {
      const parsed = parseStatus(await res.json())
      return parsed ? { kind: "ok", ...parsed } : { kind: "error", message: "The server's answer wasn't in a form the app understands." }
    } catch {
      return { kind: "error", message: "The server's answer wasn't in a form the app understands." }
    }
  } finally {
    clearTimeout(timer)
  }
}
