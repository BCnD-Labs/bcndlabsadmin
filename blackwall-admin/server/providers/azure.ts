import type { StoredConnection } from "../store.ts"
import { fmtCount, getJson, need } from "../http.ts"
import type { TestResult } from "./index.ts"

/* eslint-disable @typescript-eslint/no-explicit-any */
async function token(c: StoredConnection) {
  const tenant = need(c.config.tenantId, "Tenant ID")
  const body = new URLSearchParams({
    client_id: need(c.config.clientId, "Client ID"),
    client_secret: need(c.secrets.clientSecret, "Client secret"),
    scope: "https://management.azure.com/.default",
    grant_type: "client_credentials",
  })
  const res = await getJson<any>(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    "Azure sign-in",
  )
  return res.access_token as string
}

export async function testAzure(c: StoredConnection): Promise<TestResult> {
  const t = await token(c)
  const arm = <T = any>(path: string) =>
    getJson<T>(path.startsWith("http") ? path : `https://management.azure.com${path}`, { headers: { Authorization: `Bearer ${t}` } }, "Azure")

  const subs = await arm("/subscriptions?api-version=2022-12-01")
  const list: any[] = subs.value ?? []
  const summary = [{ label: "Subscriptions", value: list.map((s) => `${s.displayName} (${s.state})`).join(", ") || "None visible" }]

  const subId = c.config.subscriptionId
  if (subId) {
    const groups = await arm(`/subscriptions/${subId}/resourcegroups?api-version=2021-04-01`)
    let resources: any[] = []
    let next: string | undefined = `/subscriptions/${subId}/resources?api-version=2021-04-01`
    for (let page = 0; next && page < 5; page++) {
      const r: any = await arm(next)
      resources = resources.concat(r.value ?? [])
      next = r.nextLink
    }
    const types = new Map<string, number>()
    for (const r of resources) {
      const t = String(r.type).split("/").pop() ?? r.type
      types.set(t, (types.get(t) ?? 0) + 1)
    }
    const top = [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    summary.push(
      { label: "Resource groups", value: fmtCount((groups.value ?? []).length) },
      { label: "Resources", value: fmtCount(resources.length) },
      { label: "Most common", value: top.map(([t, n]) => `${t} ×${n}`).join(", ") || "none" },
    )
  }
  return { status: "ok", account: list[0]?.displayName ?? "Service principal", summary }
}
