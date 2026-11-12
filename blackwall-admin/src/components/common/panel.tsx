import { useId, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CategoryIcon, type Category } from "./category-icon"

/** The `❯ tool $ command` terminal prompt used in panel and card headers. */
export function Prompt({ tool, command, children }: { tool?: ReactNode; command?: ReactNode; children?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-[0.6em] truncate font-mono text-xs font-normal text-muted-foreground">
      <span className="font-bold text-red" aria-hidden>❯</span>
      {tool != null && <span className="truncate">{tool}</span>}
      {command != null && (
        <>
          <span className="text-faint" aria-hidden>$</span>
          <span className="truncate text-ink">{command}</span>
        </>
      )}
      {children != null && <span className="truncate text-ink">{children}</span>}
    </span>
  )
}

/**
 * Major panel: a title bar with only the category icon and title, then (when there is any)
 * one slim toolbar row: subtitle and badge on the left, meta and actions on the right.
 */
export function Panel({
  tool,
  command,
  title,
  meta,
  count,
  badge,
  actions,
  children,
  className,
  bodyClassName,
  headerClassName,
  headerProps,
  id,
  label,
  category,
  subtitle,
}: {
  /** One muted line of scope after the title, e.g. "Across 3 accounts · 4 open". */
  subtitle?: ReactNode
  tool?: ReactNode
  command?: ReactNode
  /** Readable section heading; the command remains available as a tooltip. */
  title?: string
  /** Small muted text on the right of the header. */
  meta?: ReactNode
  /** A count shown in the title bar itself, in the category hue ("4 items"), without adding a toolbar row. */
  count?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
  /** Extra props for the header row, e.g. drag handlers. */
  headerProps?: HTMLAttributes<HTMLElement>
  id?: string
  /** Accessible name when the header has no text title. */
  label?: string
  category?: Category
}) {
  const generatedId = useId()
  const headingId = id ? `${id}-title` : generatedId
  return (
    <section
      id={id}
      aria-labelledby={label ? undefined : headingId}
      aria-label={label}
      data-category={category}
      className={cn("bw-panel flex flex-col overflow-hidden text-card-foreground", className)}
    >
      {/* The title bar is the icon and the title, nothing else. Everything else sits in the row below. */}
      <header {...headerProps} className={cn("bw-panel-heading flex shrink-0 items-center gap-2.5", headerClassName, headerProps?.className)}>
        <h2 id={headingId} title={title ? [tool, command].filter((v) => typeof v === "string").join(" $ ") : undefined} className="flex min-w-0 items-center gap-2.5">
          {title ? <>{category ? <CategoryIcon category={category} /> : <span className="font-mono text-red" aria-hidden>❯</span>}<span className="bw-panel-title truncate">{title}</span>{count != null && <span className="font-mono text-xs font-normal text-[var(--bw-category,var(--bw-muted))]">{count}</span>}</> : <Prompt tool={tool} command={command} />}
        </h2>
      </header>
      {(subtitle != null || badge != null || meta != null || actions != null) && (
        <div className="bw-panel-toolbar flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {subtitle != null && <span className="min-w-0 truncate">{subtitle}</span>}
          {badge}
          <div className="ml-auto flex items-center gap-1.5">
            {meta != null && <span className="text-[11px] tabular-nums">{meta}</span>}
            {actions}
          </div>
        </div>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}

/** A title bar for floating cards (calendar, notifications, log): icon and title, actions in the row below. */
export function TitleBar({ category, title, meta, children }: { category: Category; title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <header className="bw-panel-heading flex shrink-0 items-center gap-2.5">
        <CategoryIcon category={category} />
        <span className="bw-panel-title min-w-0 truncate">{title}</span>
      </header>
      {(meta != null || children != null) && (
        <div className="bw-panel-toolbar flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {meta != null && <span className="min-w-0 truncate">{meta}</span>}
          <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div>
        </div>
      )}
    </>
  )
}

/**
 * The one panel footer: a full-width separator, an optional muted note on the left and one
 * link or action on the right (use `bw-action-link` on it, so it keeps a 32px target).
 */
export function PanelFooter({ left, children }: { left?: ReactNode; children?: ReactNode }) {
  return (
    <footer className="bw-panel-footer">
      {left != null && <span className="mr-auto min-w-0 truncate">{left}</span>}
      {children}
    </footer>
  )
}
