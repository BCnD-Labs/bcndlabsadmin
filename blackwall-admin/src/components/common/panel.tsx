import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** @deprecated Panels no longer have a coloured icon chip; kept so existing callers compile. */
export type Accent = "teal" | "amber" | "magenta" | "lime" | "blue" | "red"

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
 * Pass `tool`/`command` for the prompt. Older callers pass `title` (shown after
 * the ❯) plus `badge`/`actions`; `icon` and `accent` are accepted but ignored.
 */
export function Panel({
  title,
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
  title?: ReactNode
  tool?: ReactNode
  command?: ReactNode
  /** Small muted text on the right of the header. */
  meta?: ReactNode
  /** @deprecated */
  icon?: ReactNode
  /** @deprecated */
  accent?: Accent
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
          <Prompt tool={tool} command={command}>{title}</Prompt>
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

export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Page heading for secondary views — deliberately small. */
export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
