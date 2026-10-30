import type { StoredConnection } from "../store.ts"
import type { TestResult } from "./index.ts"

/** Optional reachability check for "Any service" connections. */
export async function testOther(c: StoredConnection): Promise<TestResult> {
  const url = c.config.healthUrl
  if (!url) return { status: "saved", account: c.config.username, message: "Details saved. Add a check URL to test reachability." }

  const headers: Record<string, string> = { "User-Agent": "blackwall-admin" }
  const secret = c.secrets.secret
  if (secret && c.config.auth === "bearer") headers.Authorization = `Bearer ${secret}`
  if (secret && c.config.auth === "basic") headers.Authorization = `Basic ${Buffer.from(`${c.config.username ?? ""}:${secret}`).toString("base64")}`
  if (secret && c.config.auth === "header" && c.config.headerName) headers[c.config.headerName] = secret

  const started = Date.now()
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(10_000) })
    const ms = Date.now() - started
    const summary = [{ label: "Check", value: `HTTP ${res.status} in ${ms} ms${url !== c.config.url ? ` (${url})` : ""}` }]
    return res.ok
      ? { status: "ok", account: c.config.username, summary }
      : { status: "error", account: c.config.username, message: `Check returned HTTP ${res.status}`, summary }
  } catch (e) {
    return { status: "error", account: c.config.username, message: `Couldn't reach ${url}: ${(e as Error).message}` }
  }
}
