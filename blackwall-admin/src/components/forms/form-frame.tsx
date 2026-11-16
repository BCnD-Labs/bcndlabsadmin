import { Trash2 } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogTitle } from "@/components/ui/dialog"

/** Dialog body shared by record forms: title, fields, footer with delete confirm. */
export function FormFrame({
  title,
  children,
  onSubmit,
  onDelete,
  submitLabel = "Save",
  canSubmit = true,
}: {
  title: string
  children: ReactNode
  onSubmit: () => void
  onDelete?: () => void
  submitLabel?: string
  canSubmit?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSubmit) onSubmit()
  }
  return (
    <form onSubmit={submit} className="mac-record-form flex max-h-[85dvh] flex-col">
      <div className="border-b border-line py-3 pr-12 pl-4">
        <DialogTitle className="font-heading text-base font-bold">{title}</DialogTitle>
      </div>
      <div className="grid gap-3.5 overflow-y-auto px-4 py-4">{children}</div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-well/60 px-4 py-3">
        {onDelete &&
          (confirming ? (
            <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
              <span className="text-[11px] text-ink-2">Delete permanently?</span>
              <Button type="button" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
              <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>
              <Trash2 /> Delete
            </Button>
          ))}
        <div className="ml-auto flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="quiet" size="lg">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" size="lg" disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
