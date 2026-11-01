import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { PROJECT_DOT } from "@/components/common/tags"

export { Field } from "@/components/common/field"

const NONE = "__none"

export function ProjectSelect({
  id,
  value,
  onChange,
  className,
  allowAll,
}: {
  id?: string
  value?: string
  onChange: (id: string | undefined) => void
  className?: string
  /** Show an "All projects" option instead of "No project" (for filters). */
  allowAll?: boolean
}) {
  const projects = useWorkspace((s) => s.projects)
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={allowAll ? "Filter by project" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={NONE}>{allowAll ? "All projects" : "No project"}</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className={cn("size-2 rounded-full", PROJECT_DOT[p.color])} aria-hidden />
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function OptionSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  className,
  label,
}: {
  id?: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
  label?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
