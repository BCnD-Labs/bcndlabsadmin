import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Spec §7 form field: label above the control, optional help, then the error.
 * When `htmlFor` is set, the control gets `aria-describedby` for the help and error
 * and `aria-invalid` when there's an error.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  const control =
    describedBy || error
      ? Children.map(children, (child) =>
          isValidElement(child) && (child.props as { id?: string }).id === htmlFor
            ? cloneElement(child as ReactElement<Record<string, unknown>>, {
                "aria-describedby": describedBy,
                "aria-invalid": error ? true : undefined,
              })
            : child,
        )
      : children

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[11px] font-normal text-muted-foreground">
        {label}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[11px] leading-relaxed text-red-text">
          {error}
        </p>
      )}
    </div>
  )
}
