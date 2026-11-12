import type { SiteBlock } from "../../../../blackwall-admin/src/lib/types.ts"
import { placeBlock, LIBRARY } from "../../../../blackwall-admin/shared/site-library.ts"
import { findBlock, mapTree } from "../../../../blackwall-admin/shared/sitebuilder-tree.ts"
import type { Collections } from "../../lib/shared.ts"

/** Apply an editor action against the current workspace, so unrelated edits survive. */
export function editPageBlock(data: Collections, pageId: string, blockId: string, fields: Record<string, unknown>, now = new Date().toISOString()): Collections {
  const page = data.pages.find(item => item.id === pageId)
  if (!page || !findBlock(page.sections, blockId)) throw Error("This block is no longer on the page.")
  return { ...data, pages: data.pages.map(item => item.id === pageId ? { ...item, sections: mapTree(item.sections, blockId, block => ({ ...block, ...fields })), updatedAt: now } : item) }
}

export function addPageBlock(data: Collections, pageId: string, selectedId: string | null, libraryId: string, now = new Date().toISOString()): Collections {
  const page = data.pages.find(item => item.id === pageId)
  const entry = LIBRARY.find(item => item.id === libraryId)
  if (!page || !entry) throw Error("This page or component is no longer available.")
  const at = selectedId && findBlock(page.sections, selectedId) ? selectedId : null
  const sections: SiteBlock[] = placeBlock(page.sections, at, entry.make())
  return { ...data, pages: data.pages.map(item => item.id === pageId ? { ...item, sections, updatedAt: now } : item) }
}
