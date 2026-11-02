/**
 * Connection types shared by the browser UI and the local connector server.
 * Secret fields are sent to the connector once and never returned to the browser.
 */

export type ProviderId = "github" | "azure" | "cloudflare" | "analytics" | "website" | "nextcloud" | "ntfy" | "email" | "other"

export interface FieldDef {
  key: string
  label: string
  secret?: boolean
  required?: boolean
  advanced?: boolean
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
        help: "Fine-grained token, read-only, on the repos you track: Actions, Checks, Contents, Issues and Pull requests (Metadata is added automatically).",
      },
    ],
  },
  {
    id: "azure",
    name: "Azure",
    blurb: "View subscription, resource group and resource counts in Connections.",
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
    blurb: "View your domains (zones) and their status in Connections.",
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
    id: "website",
    name: "Website publishing",
    blurb: "Publish, schedule, update and remove blog posts on a static site deployed from a GitHub repository (e.g. Azure Static Web Apps).",
    help: { label: "Create a fine-grained token for that repository", url: "https://github.com/settings/personal-access-tokens/new" },
    fields: [
      { key: "repo", label: "Site repository", required: true, placeholder: "owner/website", help: "The GitHub repository your site deploys from." },
      { key: "siteUrl", label: "Site URL", type: "url", required: true, placeholder: "https://www.example.com" },
      { key: "branch", advanced: true, label: "Branch", placeholder: "main", help: "The branch your deploy builds from." },
      { key: "postsDir", advanced: true, label: "Posts folder", placeholder: "pages/blog/posts" },
      { key: "imagesDir", advanced: true, label: "Images folder", placeholder: "assets/blog_images" },
      {
        key: "blogIndex",
        advanced: true,
        label: "Blog index page",
        placeholder: "pages/blog/blog.html",
        help: "Posts are listed between <!-- blackwall:posts --> and <!-- /blackwall:posts --> in this file. Without those two comments the file is left alone.",
      },
      {
        key: "token",
        label: "GitHub token",
        secret: true,
        required: true,
        placeholder: "github_pat_…",
        help: "Fine-grained token for only this repository, with Contents: Read and write. Kept separate from your read-only GitHub connection.",
      },
    ],
  },
  {
    id: "nextcloud",
    name: "Nextcloud",
    blurb: "Browse, upload, move, rename and delete your files on Mikoshi → Storage, and edit text files in place.",
    help: { label: "Create an app password (Personal settings → Security)", url: "https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html#managing-devices" },
    fields: [
      { key: "url", label: "Nextcloud address", type: "url", required: true, placeholder: "https://mikoshi.example.ts.net" },
      { key: "username", label: "Username", required: true, help: "Your Nextcloud login name (shown in Personal settings)." },
      { key: "appPassword", label: "App password", secret: true, required: true, help: "Not your login password: create one under Personal settings → Security → Devices & sessions, so you can revoke it any time." },
    ],
  },
  {
    id: "ntfy",
    name: "ntfy push",
    blurb: "Push notifications to your phone through your ntfy server. Pick which alerts are pushed in Settings → Notifications.",
    help: { label: "How ntfy topics and tokens work", url: "https://docs.ntfy.sh/publish/" },
    fields: [
      { key: "url", label: "ntfy server", type: "url", required: true, placeholder: "https://ntfy.sh or https://mikoshi.example.ts.net:9802" },
      { key: "topic", label: "Topic", required: true, placeholder: "blackwall-alerts", help: "Subscribe to the same topic in the ntfy app on your phone." },
      { key: "token", label: "Access token", secret: true, help: "Only if your ntfy server requires sign-in (tk_…)." },
    ],
  },
  {
    id: "email",
    name: "Email (SMTP)",
    blurb: "Email notifications from your own mail account over SMTP. Pick which alerts are emailed in Settings → Notifications.",
    help: { label: "Gmail: create an app password", url: "https://support.google.com/accounts/answer/185833" },
    fields: [
      { key: "host", label: "SMTP host", required: true, placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "security", label: "Security", type: "select", options: [{ value: "starttls", label: "STARTTLS (port 587)" }, { value: "ssl", label: "SSL/TLS (port 465)" }, { value: "none", label: "None (local relay only)" }] },
      { key: "username", label: "Username", placeholder: "you@example.com" },
      { key: "password", label: "Password or app password", secret: true },
      { key: "from", label: "Send from", placeholder: "Defaults to the username" },
      { key: "to", label: "Send to", required: true, placeholder: "alerts@example.com" },
    ],
  },
  {
    id: "other",
    name: "Custom service",
    blurb: "Save a service link and optional account details, or test an HTTP endpoint. This does not add a metrics integration or automatic monitoring.",
    fields: [
      { key: "url", label: "Service URL", type: "url", placeholder: "https://" },
      { key: "username", label: "Account / username" },
      { key: "secret", label: "Password, API key or token", secret: true, help: "Optional. Stored by the connector and never shown again." },
      { key: "healthUrl", label: "HTTP endpoint to test", type: "url", placeholder: "Optional: an endpoint to GET when testing" },
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
  /** "commit" = one commit (message as the summary); "push" is the older event-based form. */
  kind: "commit" | "push" | "merge" | "release" | "issue"
  summary: string
  actor: string
  at: string
  /** Short commit hash, for commits. */
  sha?: string
  url?: string
  /** The author's GitHub avatar. */
  avatar?: string
}
/** Facts about one tracked repository, for its card. */
export interface RepoSummary {
  repo: string
  description?: string
  private: boolean
  defaultBranch: string
  stars: number
  pushedAt?: string
  /** Bytes per language, largest first (GitHub's language breakdown). */
  languages: { name: string; bytes: number }[]
  /** Commits on the default branch per day (`yyyy-MM-dd`), last 26 weeks. */
  commitsByDay: Record<string, number>
}
/** One GitHub connection's slice of the multi-account overview. */
export interface GitHubAccountOverview {
  connectionId: string
  label: string
  /** The GitHub login the token belongs to, when known. */
  account?: string
  /** Repositories this account was asked for. */
  repos: string[]
  overview?: DevelopmentOverview
  /** Set when this account's fetch failed; other accounts still return. */
  error?: string
}
export interface GitHubAccountsOverview {
  accounts: GitHubAccountOverview[]
}
/** Optional per-connection appearance, stored in connection config. */
export const APPEARANCE_KEYS = { color: "appearanceColor", icon: "appearanceIcon" } as const

export interface DevelopmentOverview {
  prs: PullRequestSummary[]
  failures: CheckFailure[]
  issues: IssueSummary[]
  activity: RepoActivity[]
  repos?: RepoSummary[]
}
