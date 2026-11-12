import { cn } from "@/lib/utils"

/** Property kinds, as on Android: amber = date, red = overdue, violet = learning, blue = tag, pink = project, green = status. */
export type ChipKind = "date" | "overdue" | "course" | "tag" | "project" | "status" | "neutral"

const TONE: Record<ChipKind, string> = {
  date: "bg-[#3b3220] text-[#ffcc80]",
  overdue: "bg-[#4a2727] text-[#ffadad]",
  course: "bg-[#2d2845] text-[#cdbdf5]",
  tag: "bg-[#1e3a55] text-[#8ec9ff]",
  project: "bg-[#44283a] text-[#f5a3c7]",
  status: "bg-[#1f3a28] text-[#8fdc98]",
  neutral: "bg-[#3a3b3e] text-[#d9dce1]",
}

/**
 * A labelled property: a small mono KEY on a darker half and its value on the tone for that kind
 * (`DUE Nov 17`, `CODE COM151`). Without a label it is a plain tag.
 */
export function PropChip({ kind, label, value, className }: { kind: ChipKind; label?: string; value: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 max-w-full items-stretch overflow-hidden rounded-[5px] text-[10.5px] leading-none", TONE[kind], className)} title={label ? `${label}: ${value}` : value}>
      {label && <span className="flex items-center bg-black/35 px-[5px] font-mono text-[8.5px] font-bold tracking-[0.06em] text-[#aab0ba] uppercase">{label}</span>}
      <span className="flex min-w-0 items-center px-1.5"><span className="truncate">{value}</span></span>
    </span>
  )
}
