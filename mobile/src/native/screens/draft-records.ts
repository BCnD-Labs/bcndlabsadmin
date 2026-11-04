import { defaultMakeId, type Collections } from "../../lib/shared.ts"
import { slugify } from "../../../../blackwall-admin/src/lib/ids.ts"

type Draft = Collections["drafts"][number]
export type DraftFields = Pick<Draft, "title" | "slug" | "kind" | "status" | "excerpt" | "body" | "siteId">

/** Save writing fields while retaining publishing metadata and other web-owned draft fields. */
export function saveDraftRecord(data: Collections, previousId: string | undefined, fields: DraftFields, options: { id?: string; now?: string } = {}): Collections {
  if (previousId && !data.drafts.some(draft => draft.id === previousId)) throw new Error("This draft no longer exists.")
  const now = options.now ?? new Date().toISOString()
  const values = { ...fields, title: fields.title.trim(), slug: slugify(fields.slug || fields.title) || "untitled", excerpt: fields.excerpt.trim() }
  const drafts = previousId
    ? data.drafts.map(draft => draft.id === previousId ? { ...draft, ...values, updatedAt: now } : draft)
    : [{ ...values, id: options.id ?? defaultMakeId("drf"), createdAt: now, updatedAt: now }, ...data.drafts]
  return { ...data, drafts }
}
