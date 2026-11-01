import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

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
 * Spec §2 panel: charcoal surface, 12px radius, 4px ledge on the right and
 * bottom, scanlines, and a 40px terminal-prompt header
 * (`❯ tool $ command      meta  actions`).
 *
 * `badge` sits after the prompt (e.g. a SourceBadge); `meta` and `actions` sit on the right.
 */
export function Panel({
  tool,
  command,
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
}: {
  tool?: ReactNode
  command?: ReactNode
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
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      id={id}
      aria-labelledby={label ? undefined : headingId}
      aria-label={label}
      className={cn("bw-panel flex flex-col overflow-hidden text-card-foreground", className)}
    >
      <header
        {...headerProps}
        className={cn(
          "flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-line py-1 pr-2 pl-3.5 text-xs whitespace-nowrap text-muted-foreground",
          headerClassName,
          headerProps?.className,
        )}
      >
        <h2 id={headingId} className="min-w-0 font-mono text-xs font-normal">
          <Prompt tool={tool} command={command} />
        </h2>
        {badge}
        <div className="ml-auto flex items-center gap-1.5">
          {meta != null && <span className="text-[11px] text-muted-foreground">{meta}</span>}
          {actions}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}
