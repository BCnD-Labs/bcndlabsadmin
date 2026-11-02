import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"

/** Secondary phone detail, always fully visible on tablet and desktop. */
export function PhoneDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const phone = useMediaQuery("(max-width: 639px)")
  const [open, setOpen] = useState(false)
  if (!phone) return <>{children}</>
  return (
    <div className="min-w-0">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} {label}</Button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
