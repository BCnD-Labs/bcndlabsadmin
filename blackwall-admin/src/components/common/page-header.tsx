import { useContext, useId, useLayoutEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PageHeadStoreContext, usePageHead } from "@/stores/page-head"

/**
 * A page's title, badge, status line and actions. They render in the app header,
 * in the same place Home shows its greeting, so every page starts like Home: the
 * header, then its cards. On phones the header has no room for actions, so they
 * stay at the top of the page.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
  back,
  className,
}: {
  title: ReactNode
  /** A short status, e.g. "Saving…" or "Dr. Alvarez · Fall 2026" (shown on wide screens). */
  subtitle?: ReactNode
  actions?: ReactNode
  badge?: ReactNode
  /** Detail pages: a back arrow before the title. */
  back?: { to: string; label: string }
  className?: string
}) {
  const owner = useId()
  const localStore = useContext(PageHeadStoreContext)
  const store = localStore ?? usePageHead
  useLayoutEffect(() => {
    store.setState({ title, subtitle, actions, badge, back, owner }, true)
  })
  useLayoutEffect(
    () => () => {
      if (store.getState().owner === owner) store.setState({}, true)
    },
    [owner, store],
  )
  if (!actions) return null
  return <div className={cn("mb-3 flex flex-wrap items-center gap-2 md:hidden", className)}>{actions}</div>
}
