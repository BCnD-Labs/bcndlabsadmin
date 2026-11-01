import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Spec §2 buttons. Primary: red fill, white 11px/600 mono, 2px red ledge on the
 * right + bottom. Ghost: transparent, 1px border top/left + 2px right/bottom.
 * Heights are 28px (default) and 32px (lg, the header).
 */
const ledge = "border-solid border-t-0 border-l-0 border-r-2 border-b-2"
const rim = "border-solid border-t border-l border-r-2 border-b-2 border-rim"
const primary = `${ledge} border-red-ledge bg-red font-semibold text-white hover:bg-[#c81c1c] active:translate-y-px`

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[7px] font-mono text-[11px] whitespace-nowrap transition-[background-color,color,transform] duration-150 ease-bw select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: primary,
        primary,
        ghost: `${rim} bg-transparent text-ink-2 hover:bg-raised hover:text-ink aria-expanded:bg-selected aria-pressed:bg-selected`,
        outline: `${rim} bg-transparent text-ink-2 hover:bg-raised hover:text-ink aria-expanded:bg-selected aria-pressed:bg-selected`,
        secondary: `${ledge} border-ledge-hi bg-raised text-ink hover:bg-selected`,
        /* Borderless: icon buttons in panel headers and rows, and Cancel next to a primary. */
        quiet: "text-ink-2 hover:bg-raised hover:text-ink aria-expanded:bg-raised",
        destructive: primary,
        link: "text-ink-2 underline-offset-4 hover:text-ink hover:underline",
      },
      size: {
        default: "h-7 gap-1.5 px-2.5",
        xs: "h-[22px] gap-1 rounded-[5px] px-1.5 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6 gap-1 rounded-[6px] px-2 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-8 gap-1.5 px-2.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[6px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
