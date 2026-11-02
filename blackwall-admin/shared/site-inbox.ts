/** What the form receiver Worker collects, as Blackwall keeps it (Website → Forms). */
export type InboxKind = "form" | "comment" | "newsletter"
export type InboxStatus = "new" | "read" | "approved" | "hidden"

export interface InboxItem {
  id: string
  kind: InboxKind
  site: string
  form?: string
  /** Comments: the post's slug. */
  post?: string
  /** The page it was sent from. */
  page?: string
  email: string
  name?: string
  fields: Record<string, string>
  /** The sender clicked the confirmation link. */
  verified: boolean
  at: string
  receivedAt: string
  status: InboxStatus
}

/** Approved comments for one site, oldest first: what gets baked into post pages on publish. */
export const approvedComments = (items: InboxItem[], siteId: string) =>
  items.filter((i) => i.kind === "comment" && i.site === siteId && i.status === "approved").sort((a, b) => a.at.localeCompare(b.at))
