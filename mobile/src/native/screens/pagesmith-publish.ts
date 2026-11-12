export interface PublishResult { sha: string; files: number; removed: number; repo: string }

/** The existing CMS endpoint publishes the saved workspace to its configured repository. */
export async function publishPagesmithSite(address: string, siteId: string, fetchImpl: typeof fetch = fetch): Promise<PublishResult> {
  const response = await fetchImpl(`${address.replace(/\/+$/, "")}/api/sites/${encodeURIComponent(siteId)}/publish`, {
    method: "POST", credentials: "include", headers: { "X-Blackwall": "1", Accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: unknown }
    throw Error(typeof body.error === "string" ? body.error : `Publishing failed (HTTP ${response.status}).`)
  }
  const result = await response.json() as Partial<PublishResult>
  if (typeof result.sha !== "string" || typeof result.repo !== "string" || !Number.isSafeInteger(result.files) || !Number.isSafeInteger(result.removed)) throw Error("The server's publish result was incomplete.")
  return result as PublishResult
}
