/**
 * Connection types shared by the browser UI and the local connector server.
 * Secret fields are sent to the connector once and never returned to the browser.
 */

export type ProviderId = "github" | "azure" | "cloudflare" | "analytics" | "other"

export interface FieldDef {
  key: string
  label: string
  secret?: boolean
  required?: boolean
  placeholder?: string
  help?: string
  type?: "text" | "url" | "select"
  options?: { value: string; label: string }[]
  /** Only show (and require) this field when another field has one of these values. */
  showWhen?: { key: string; values: string[] }
}

export interface ProviderDef {
  id: ProviderId
  name: string
  blurb: string
  /** Where to create the credentials this provider needs. */
  help?: { label: string; url: string }
  fields: FieldDef[]
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "github",
    name: "GitHub",
    blurb: "Review requests, failed checks, issues and activity for your tracked repositories.",
    help: { label: "Create a fine-grained token", url: "https://github.com/settings/personal-access-tokens/new" },
    fields: [
      {
        key: "token",
        label: "Personal access token",
        secret: true,
        required: true,
        placeholder: "github_pat_…",
        help: "Fine-grained token with read access to Metadata, Pull requests, Issues and Actions on the repos you track.",
      },
    ],
  },
  {
    id: "azure",
    name: "Azure",
    blurb: "Subscriptions, resource groups and resource counts via a service principal.",
    help: { label: "Register an app in Microsoft Entra ID", url: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" },
    fields: [
      { key: "tenantId", label: "Tenant (directory) ID", required: true, placeholder: "00000000-0000-…" },
      { key: "clientId", label: "Client (application) ID", required: true, placeholder: "00000000-0000-…" },
      { key: "clientSecret", label: "Client secret", secret: true, required: true },
      {
        key: "subscriptionId",
        label: "Subscription ID",
        placeholder: "Optional",
        help: "Give the app registration the Reader role on this subscription.",
      },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    blurb: "Zones and their status for your domains.",
    help: { label: "Create an API token", url: "https://dash.cloudflare.com/profile/api-tokens" },
    fields: [
      {
        key: "token",
        label: "API token",
        secret: true,
        required: true,
        help: "A token with Zone:Read is enough. Add Account Analytics:Read to use it for web analytics.",
      },
      { key: "accountId", label: "Account ID", placeholder: "Optional" },
    ],
  },
  {
    id: "analytics",
    name: "Website analytics",
    blurb: "Visitors, pageviews, top pages and referrers for your website.",
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        required: true,
        options: [
          { value: "plausible", label: "Plausible" },
          { value: "umami", label: "Umami" },
          { value: "cloudflare", label: "Cloudflare Web Analytics" },
        ],
      },
      { key: "baseUrl", label: "Instance URL", type: "url", placeholder: "https://plausible.io", showWhen: { key: "provider", values: ["plausible"] } },
      { key: "siteId", label: "Site domain", required: true, placeholder: "example.com", showWhen: { key: "provider", values: ["plausible"] } },
      { key: "umamiUrl", label: "API URL", type: "url", required: true, placeholder: "https://api.umami.is/v1", showWhen: { key: "provider", values: ["umami"] } },
      { key: "websiteId", label: "Website ID", required: true, showWhen: { key: "provider", values: ["umami"] } },
      { key: "accountId", label: "Account ID", required: true, showWhen: { key: "provider", values: ["cloudflare"] } },
      { key: "siteTag", label: "Site tag", required: true, showWhen: { key: "provider", values: ["cloudflare"] } },
      { key: "apiKey", label: "API key / token", secret: true, required: true },
    ],
  },
  {
    id: "other",
    name: "Any service",
    blurb: "Any other account: URL, login details, your own extra fields, and an optional check that it's reachable.",
    fields: [
      { key: "url", label: "Service URL", type: "url", placeholder: "https://" },
      { key: "username", label: "Account / username" },
      { key: "secret", label: "Password, API key or token", secret: true, help: "Optional. Stored by the connector and never shown again." },
      { key: "healthUrl", label: "Check URL", type: "url", placeholder: "Optional: an endpoint to GET when testing" },
      {
        key: "auth",
        label: "Send credentials with the check",
        type: "select",
        options: [
          { value: "none", label: "No" },
          { value: "bearer", label: "As a Bearer token" },
          { value: "basic", label: "As username + password (Basic)" },
          { value: "header", label: "In a custom header" },
        ],
      },
      { key: "headerName", label: "Header name", placeholder: "X-API-Key", showWhen: { key: "auth", values: ["header"] } },
      { key: "notes", label: "Notes" },
    ],
  },
]

/** "Any service" connections can also carry user-defined fields, stored with this key prefix. */
export const CUSTOM_PREFIX = "custom:"

export const providerDef = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!

export function visibleFields(def: ProviderDef, config: Record<string, string>) {
  return def.fields.filter((f) => !f.showWhen || f.showWhen.values.includes(config[f.showWhen.key] ?? ""))
}

export type ConnectionStatus = "untested" | "ok" | "error" | "saved"

export interface SummaryItem {
  label: string
  value: string
}

/** What the browser sees. Secrets are reduced to "set" + a short hint. */
export interface PublicConnection {
  id: string
  provider: ProviderId
  label: string
  config: Record<string, string>
  secrets: Record<string, { set: boolean; hint?: string }>
  status: ConnectionStatus
  account?: string
  message?: string
  summary?: SummaryItem[]
  checkedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ConnectionInput {
  provider: ProviderId
  label: string
  config: Record<string, string>
  /** New secret values. Omitted or empty keeps the stored value; `null` clears it. */
  secrets?: Record<string, string | null>
}

// Data payloads served by the connector -------------------------------------

export interface TrafficPoint {
  date: string
  visitors: number
  pageviews: number
}
export interface PageStat {
  path: string
  pageviews: number
  visitors: number
}
export interface ReferrerStat {
  source: string
  visitors: number
}
export interface AnalyticsReport {
  traffic: TrafficPoint[]
  pages: PageStat[]
  referrers: ReferrerStat[]
}

export interface PullRequestSummary {
  id: string
  repo: string
  number: number
  title: string
  author: string
  url?: string
  updatedAt: string
  kind: "review-requested" | "authored"
  checks: "passing" | "failing" | "pending" | "unknown"
}
export interface CheckFailure {
  id: string
  repo: string
  branch: string
  workflow: string
  commit: string
  url?: string
  failedAt: string
}
export interface IssueSummary {
  id: string
  repo: string
  number: number
  title: string
  labels: string[]
  url?: string
  updatedAt: string
}
export interface RepoActivity {
  id: string
  repo: string
  kind: "push" | "merge" | "release" | "issue"
  summary: string
  actor: string
  at: string
}
export interface DevelopmentOverview {
  prs: PullRequestSummary[]
  failures: CheckFailure[]
  issues: IssueSummary[]
  activity: RepoActivity[]
}
