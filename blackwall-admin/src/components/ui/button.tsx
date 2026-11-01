import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Buttons, after Mantine's variants. Primary = "filled" (solid red, white label).
 * Ghost = "default" (raised fill + 1px border). Outline = transparent + border.
 * Quiet = "subtle" (no border, tint on hover). Light = a 15% red tint with a
 * light-red label. Labels use the interface font, 600 weight.
 * Heights: 30px default, 32px lg (the header), 26px sm, 22px xs.
 */
const primary = "border border-transparent bg-red font-semibold text-white shadow-xs hover:bg-red-hover active:translate-y-px"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-bw select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: primary,
        primary,
        ghost: "border border-rim bg-raised text-ink hover:bg-selected aria-expanded:bg-selected aria-pressed:bg-selected",
        outline: "border border-rim bg-transparent text-ink-2 hover:bg-raised hover:text-ink aria-expanded:bg-raised aria-pressed:bg-raised",
        secondary: "border border-transparent bg-selected text-ink hover:bg-ledge-hi",
        light: "border border-transparent bg-red-soft font-semibold text-red-light hover:bg-red/25",
        /* Borderless: icon buttons in panel headers and rows, and Cancel next to a primary. */
        quiet: "border border-transparent text-ink-2 hover:bg-raised hover:text-ink aria-expanded:bg-raised",
        destructive: primary,
        link: "text-ink-2 underline-offset-4 hover:text-ink hover:underline active:translate-y-0",
      },
      size: {
        default: "h-[30px] gap-1.5 px-3",
        xs: "h-[22px] gap-1 rounded-[6px] px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[26px] gap-1 rounded-[6px] px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-8 gap-1.5 px-3.5",
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
