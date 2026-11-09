import { createContext, type ReactNode } from "react"
import { create, type StoreApi } from "zustand"

/**
 * What the current page shows in the app header: its title (where Home shows the
 * greeting), a badge, a short status line and its actions. Set by <PageHeader>.
 */
export interface PageHead {
  title?: ReactNode
  badge?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Detail pages: where the back arrow goes. */
  back?: { to: string; label: string }
  /** Which PageHeader set it, so an unmounting page only clears its own. */
  owner?: string
}

export const usePageHead = create<PageHead>()(() => ({}))

/** A Mac app window owns its header; pages outside a window use the shared header. */
export const PageHeadStoreContext = createContext<StoreApi<PageHead> | null>(null)
