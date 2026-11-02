import { Search } from "lucide-react"
import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Spec §7 toolbar: the first row inside a list panel (search, filters, count). */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-line-soft px-3.5 py-2", className)}>{children}</div>
}

/** A search well for page headers and toolbars (32px). */
export function SearchField({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:w-52", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className="h-8 pl-8" />
    </div>
  )
}

/** Spec §7 list row: 40px, a soft separator and a hover fill. */
export function ListRow({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("bw-row flex items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5 last:border-b-0 hover:bg-raised", className)}
      {...props}
    >
      {children}
    </li>
  )
}

/** A small caps label for groups inside a list, e.g. "Overdue · 2". */
export function ListGroupLabel({ children, className, tone }: { children: ReactNode; className?: string; tone?: "warn" }) {
  return (
    <h2 className={cn("bw-label flex items-center gap-2 px-3.5 py-1.5", tone === "warn" && "text-amber", className)}>
      {children}
    </h2>
  )
}

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Hidden under the `sm` breakpoint, so tables don't scroll sideways on phones. */
  optional?: boolean
  align?: "right"
  className?: string
}

/** Spec §7 table: label-style headers, 40px rows, optional columns drop out on phones. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  label,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  label: string
}) {
  const hide = (c: Column<T>) => c.optional && "hidden sm:table-cell"
  return (
    <table className="w-full text-xs" aria-label={label}>
      <thead>
        <tr className="border-b border-line-soft text-left">
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cn("bw-label h-9 px-3.5 font-normal", c.align === "right" && "text-right", hide(c), c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={rowKey(r)} className="border-b border-line-soft last:border-0 hover:bg-raised">
            {columns.map((c) => (
              <td key={c.key} className={cn("bw-row px-3.5 py-1.5 align-middle break-words", c.align === "right" && "text-right", hide(c), c.className)}>
                {c.cell(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
