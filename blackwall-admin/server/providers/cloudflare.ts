import type { StoredConnection } from "../store.ts"
import { fmtCount, getJson, need } from "../http.ts"
import type { TestResult } from "./index.ts"

/* eslint-disable @typescript-eslint/no-explicit-any */
export function cfFetch<T = any>(token: string, path: string, init: RequestInit = {}) {
  return getJson<T>(
    `https://api.cloudflare.com/client/v4${path}`,
    { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } },
    "Cloudflare",
  )
}

export async function testCloudflare(c: StoredConnection): Promise<TestResult> {
  const token = need(c.secrets.token, "API token")
  const accountId = c.config.accountId
  // User-owned tokens verify at /user; account-owned tokens at /accounts/:id.
  await cfFetch(token, "/user/tokens/verify").catch((e) => {
    if (!accountId) throw e
    return cfFetch(token, `/accounts/${accountId}/tokens/verify`)
  })
  const zones = await cfFetch(token, "/zones?per_page=50")
  const list: any[] = zones.result ?? []
  return {
    status: "ok",
    account: list[0]?.account?.name ?? "Cloudflare account",
    summary: [
      { label: "Zones", value: fmtCount(zones.result_info?.total_count ?? list.length) },
      { label: "Domains", value: list.map((z) => (z.status === "active" ? z.name : `${z.name} (${z.status})`)).join(", ") || "None visible" },
    ],
  }
}
