import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/* Neo-brutal buttons: 2px ink border, hard offset shadow that "presses" on click. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-transparent bg-clip-padding font-heading text-sm font-bold whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-100 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-black bg-primary text-primary-foreground shadow-brutal-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        outline:
          "border-edge bg-card text-foreground shadow-brutal-sm hover:-translate-x-px hover:-translate-y-px hover:border-teal hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none aria-expanded:border-teal",
        secondary: "border-edge bg-muted text-foreground hover:border-teal",
        ghost: "font-sans font-normal hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-black bg-red text-black shadow-brutal-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        link: "font-sans font-normal text-teal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-md px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
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
