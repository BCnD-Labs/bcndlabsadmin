import type { PlanWarning, PublishTarget } from "../shared/publish-plan.ts"
import { ProviderError } from "./http.ts"

/** "https://Owner.github.io/Repo/" or "owner.github.io/repo" → { host: "owner.github.io", path: "/repo" }. Null when it isn't a web address. */
export function parseSiteAddress(input: string): { host: string; path: string } | null {
  const text = input.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return null
    return { host: url.hostname.toLowerCase(), path: url.pathname.replace(/\/+$/, "").toLowerCase() }
  } catch {
    return null
  }
}

const show = (a: { host: string; path: string }) => `${a.host}${a.path}`

/**
 * Whether a site's address and the repository it publishes to belong together, judged from the names alone.
 * A GitHub Pages address says exactly which repository serves it, so a mismatch there is refused outright.
 * Returns the reason, or null when nothing is wrong. Hosts we can't judge by name (a custom domain) are left to `pagesOwnsAddress`.
 */
export function addressProblem(repo: string, siteUrl: string, domain = ""): string | null {
  const url = siteUrl.trim() ? parseSiteAddress(siteUrl) : null
  if (siteUrl.trim() && !url) return `The site URL “${siteUrl}” isn't a web address.`
  const own = domain.trim() ? parseSiteAddress(domain) : null
  if (domain.trim() && !own) return `The site's address “${domain}” isn't a web address.`
  if (url && own && show(url) !== show(own)) return `This site's address (${show(own)}) doesn't match the website connection's site URL (${show(url)}). Fix one of them so they agree before publishing.`
  const where = url ?? own
  if (!where || !where.host.endsWith(".github.io")) return null
  const [owner, name] = repo.toLowerCase().split("/")
  const hostOwner = where.host.slice(0, -".github.io".length)
  if (hostOwner !== owner) return `The site address ${show(where)} is served from GitHub account “${hostOwner}”, but the repository is ${repo} (account “${owner}”). Nothing was published.`
  const userSite = name === `${owner}.github.io`
  if (userSite && where.path) return `${repo} is the account's main site, which is served at ${where.host} with no folder, not at ${show(where)}. Nothing was published.`
  if (!userSite && where.path !== `/${name}`) return `A project site in ${repo} is served at ${where.host}/${name}, not at ${show(where)}. Nothing was published.`
  return null
}

/** What GitHub Pages itself reports for a repository, when it is switched on and readable. */
export interface PagesInfo { htmlUrl?: string; cname?: string | null }

/**
 * For an address we can't judge by name: if GitHub Pages is on for this repository and says it serves somewhere else, refuse.
 * When Pages is off (the site may be deployed another way) or can't be read, the address is simply unconfirmed and the review says so.
 */
export function pagesOwnsAddress(siteUrl: string, domain: string, pages: PagesInfo | null): { ok: true; confirmed: boolean } | { ok: false; reason: string } {
  const where = parseSiteAddress(siteUrl) ?? parseSiteAddress(domain)
  if (!where || !pages || (!pages.htmlUrl && !pages.cname)) return { ok: true, confirmed: false }
  const served = [pages.cname ? parseSiteAddress(pages.cname)?.host : undefined, pages.htmlUrl ? parseSiteAddress(pages.htmlUrl)?.host : undefined].filter(Boolean)
  if (served.includes(where.host)) return { ok: true, confirmed: true }
  return { ok: false, reason: `GitHub Pages for this repository serves ${served.join(" / ") || "somewhere else"}, not ${where.host}. Nothing was published.` }
}

/** The pieces of a connection the guard needs; `pages` reads GitHub Pages' own answer for the repository. */
export interface GuardInput {
  repo: string
  branch: string
  siteUrl: string
  /** The site record's own address, when the app has one. */
  domain?: string
  pages: () => Promise<PagesInfo | null>
}

/**
 * Checked on every plan and again on every write. Throws when the site's address and the repository disagree;
 * otherwise describes the destination and lists anything unconfirmed.
 */
export async function guardTarget(input: GuardInput): Promise<{ target: PublishTarget; warnings: PlanWarning[] }> {
  const problem = addressProblem(input.repo, input.siteUrl, input.domain ?? "")
  if (problem) throw new ProviderError(problem, 409)
  const warnings: PlanWarning[] = []
  const address = input.siteUrl.trim() || (input.domain ?? "").trim()
  if (!address) warnings.push({ code: "no-site-url", message: "No site URL is set for this connection, so the public address can't be shown or checked." })
  else if (!parseSiteAddress(address)!.host.endsWith(".github.io")) {
    const verdict = pagesOwnsAddress(input.siteUrl, input.domain ?? "", await input.pages().catch(() => null))
    if (!verdict.ok) throw new ProviderError(verdict.reason, 409)
    if (!verdict.confirmed) warnings.push({ code: "address-unconfirmed", message: `${parseSiteAddress(address)!.host} isn't a GitHub Pages address and GitHub doesn't report where this repository is served, so the address couldn't be double-checked.` })
  }
  return { target: { repo: input.repo, branch: input.branch, siteUrl: input.siteUrl.trim() || (input.domain ?? "").trim() }, warnings }
}
