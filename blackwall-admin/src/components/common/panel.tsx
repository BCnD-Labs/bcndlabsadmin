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
 * Major panel: theme surface, 8px radius and a readable heading in a 36px band.
 * Dark retains a subtle hardware ledge and optional scanlines.
 * (`❯ tool $ command      meta  actions`).
 *
 * `badge` sits after the prompt (e.g. a SourceBadge); `meta` and `actions` sit on the right.
 */
export function Panel({
  tool,
  command,
  title,
  meta,
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
}: {
  tool?: ReactNode
  command?: ReactNode
  /** Readable section heading; the command remains available as a tooltip. */
  title?: string
  /** Small muted text on the right of the header. */
  meta?: ReactNode
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
      <header
        {...headerProps}
        className={cn(
          "bw-panel-heading flex shrink-0 flex-wrap items-center gap-2 border-b border-line-soft text-xs whitespace-nowrap text-muted-foreground",
          headerClassName,
          headerProps?.className,
        )}
      >
        <h2 id={headingId} title={title ? [tool, command].filter((v) => typeof v === "string").join(" $ ") : undefined} className="min-w-0">
          {title ? <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">{category ? <CategoryIcon category={category} /> : <span className="font-mono text-red" aria-hidden>❯</span>}<span className="truncate">{title}</span></span> : <Prompt tool={tool} command={command} />}
        </h2>
        {badge}
        <div className="ml-auto flex items-center gap-1.5">
          {meta != null && <span className="text-[11px] text-muted-foreground">{meta}</span>}
          {actions}
          <span className="bw-window-buttons" aria-hidden><span /><span /></span>
        </div>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}
