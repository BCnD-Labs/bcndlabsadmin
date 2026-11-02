import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Available-space grid: 1–4 equal columns, independent of rail/viewport width. */
export function WorkspaceGrid({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className="bw-grid-region"><div {...props} className={cn("bw-grid", className)}>{children}</div></div>
}

/** A preview uses row units; content surfaces grow naturally (forms, editors, full lists). */
export function GridItem({ children, span = 1, rows, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  span?: 1 | 2 | 3 | 4 | "full"
  rows?: 1 | 2
}) {
  return <div {...props} data-span={span} data-rows={rows} className={cn("bw-grid-item", className)}>{children}</div>
}
