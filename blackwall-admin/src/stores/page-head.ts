import type { ReactNode } from "react"
import { create } from "zustand"

/**
 * What the current page shows in the app header: its title (where Home shows the
 * greeting), a badge, a short status line and its actions. Set by <PageHeader>.
 */
export interface PageHead {
  title?: ReactNode
  badge?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Which PageHeader set it, so an unmounting page only clears its own. */
  owner?: string
}

export const usePageHead = create<PageHead>()(() => ({}))
