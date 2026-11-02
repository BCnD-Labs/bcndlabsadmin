import type { SocialAccount, SocialPlatform, SocialPost } from "../src/lib/types.ts"

export interface PlatformDef {
  id: SocialPlatform
  label: string
  /** Two letters for the badge. */
  short: string
  /** Badge color (the platform's own brand color, toned for both themes). */
  color: string
  /** Soft caption limit, shown as a counter. */
  limit?: number
  /** Opens the app or site when there's no compose link. */
  home: string
  /** A page that opens with the text filled in, where the platform offers one. */
  compose?: (text: string, link?: string, title?: string) => string
}

const enc = encodeURIComponent

export const PLATFORMS: PlatformDef[] = [
  { id: "instagram", label: "Instagram", short: "IG", color: "#e1306c", limit: 2200, home: "https://www.instagram.com/" },
  { id: "facebook", label: "Facebook", short: "FB", color: "#1877f2", home: "https://www.facebook.com/", compose: (_t, link) => (link ? `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` : "https://www.facebook.com/") },
  { id: "threads", label: "Threads", short: "TH", color: "#8a8f98", limit: 500, home: "https://www.threads.com/", compose: (t, link) => `https://www.threads.com/intent/post?text=${enc([t, link].filter(Boolean).join("\n\n"))}` },
  { id: "x", label: "X", short: "X", color: "#9aa0a6", limit: 280, home: "https://x.com/", compose: (t, link) => `https://x.com/intent/post?text=${enc(t)}${link ? `&url=${enc(link)}` : ""}` },
  { id: "tiktok", label: "TikTok", short: "TT", color: "#25f4ee", limit: 4000, home: "https://www.tiktok.com/upload" },
  { id: "reddit", label: "Reddit", short: "RD", color: "#ff4500", home: "https://www.reddit.com/", compose: (t, link, title) => `https://www.reddit.com/submit?title=${enc(title || t.slice(0, 300))}${link ? `&url=${enc(link)}` : `&text=${enc(t)}`}` },
  { id: "other", label: "Other", short: "··", color: "#8a8f98", home: "" },
]

export const platformDef = (id: SocialPlatform) => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[PLATFORMS.length - 1]

export const DEFAULT_BRANDS = ["Personal", "BCnD Labs", "Sprouts & Scraps"]

export type PostState = "idea" | "draft" | "scheduled" | "due" | "partial" | "posted"

/** Where a post stands: posted everywhere, partly, due now, waiting for its time, or still being written. */
export function postState(p: SocialPost, now = Date.now()): PostState {
  const done = p.accountIds.filter((a) => p.posted.some((x) => x.accountId === a)).length
  if (p.accountIds.length && done === p.accountIds.length) return "posted"
  if (p.scheduledAt && Date.parse(p.scheduledAt) <= now) return done ? "partial" : "due"
  if (done) return "partial"
  if (p.scheduledAt) return "scheduled"
  return p.stage === "idea" ? "idea" : "draft"
}

/** The post's accounts, in a stable order. */
export const postAccounts = (p: SocialPost, accounts: SocialAccount[]) => accounts.filter((a) => p.accountIds.includes(a.id))

/** Does a post match the platform and brand filters? Empty filters match everything. */
export function matchesFilter(p: SocialPost, accounts: SocialAccount[], platforms: string[], brands: string[]) {
  if (!platforms.length && !brands.length) return true
  const mine = postAccounts(p, accounts)
  if (!mine.length) return true // unassigned ideas stay visible
  return mine.some((a) => (!platforms.length || platforms.includes(a.platform)) && (!brands.length || brands.includes(a.brand)))
}
