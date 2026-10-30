import type { StoredConnection } from "../store.ts"
import { ProviderError } from "../http.ts"
import { testAnalytics } from "./analytics.ts"
import { testAzure } from "./azure.ts"
import { testCloudflare } from "./cloudflare.ts"
import { testGitHub } from "./github.ts"
import { testOther } from "./other.ts"

export type TestResult = Pick<StoredConnection, "status" | "account" | "message" | "summary">

const TESTS: Record<StoredConnection["provider"], (c: StoredConnection) => Promise<TestResult>> = {
  github: testGitHub,
  azure: testAzure,
  cloudflare: testCloudflare,
  analytics: testAnalytics,
  other: testOther,
}

/** Turn common provider errors into something actionable; keep the raw text after it. */
function explain(provider: StoredConnection["provider"], message: string): string {
  const m = message.toLowerCase()
  if (provider === "cloudflare" && (m.includes("invalid request headers") || m.includes("invalid api token") || m.includes("http 401") || m.includes("http 403")))
    return `Cloudflare rejected the token. Use an API token (not the Global API Key) with Zone:Read. (${message})`
  if (provider === "github" && m.includes("http 401"))
    return `GitHub rejected the token. Check it's pasted fully and hasn't expired. (${message})`
  if (provider === "github" && m.includes("http 403"))
    return `GitHub accepted the token but denied access. Give it read access to the repos you track. (${message})`
  if (provider === "azure" && m.includes("aadsts7000215"))
    return `Azure rejected the client secret. Use the secret's Value, not its ID. (${message})`
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("timeout"))
    return `Couldn't reach the service. Check the URL and your internet connection. (${message})`
  return message
}

export async function testConnection(c: StoredConnection): Promise<TestResult> {
  try {
    return await TESTS[c.provider](c)
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : `Unexpected error: ${(e as Error).message}`
    return { status: "error", message: explain(c.provider, message), summary: c.summary, account: c.account }
  }
}
