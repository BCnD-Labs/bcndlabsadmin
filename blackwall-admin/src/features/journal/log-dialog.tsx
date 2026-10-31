import { useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Prompt } from "@/components/common/panel"
import { daysUntil, todayKey } from "@/lib/dates"
import type { DateKey } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { compareTasks } from "@/features/work/task-utils"
import { logHref } from "./daily-log-page"
import { LOG_PROMPTS, appendPrompt, logCommand, logTitle } from "./log-helpers"

/** The day's log as a dialog (spec §4): tasks due that day, quick prompts, the entry, Save. */
export function LogDialog({
  date,
  onOpenChange,
  onCloseAutoFocus,
}: {
  /** The day to open, or null when closed. */
  date: DateKey | null
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (e: Event) => void
}) {
  return (
    <Dialog open={!!date} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).querySelector("textarea")?.focus()
        }}
        className="top-[120px] w-[420px] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-[12px] bg-panel p-0 sm:max-w-[420px]"
      >
        {date && <LogBody key={date} date={date} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function LogBody({ date, close }: { date: DateKey; close: () => void }) {
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const allTasks = useWorkspace((s) => s.tasks)
  const tasks = allTasks.filter((t) => t.due === date).sort(compareTasks)
  const [text, setText] = useState(entry?.text ?? "")
  const ref = useRef<HTMLTextAreaElement>(null)
  // After a prompt is inserted, put the caret at the end once the new text renders.
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caret.current === null) return
    ref.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])
  const dirty = text !== (entry?.text ?? "")
  const past = daysUntil(date) < 0

  const save = () => {
    saveJournal(date, text)
    toast.success(text.trim() ? "Log saved" : entry ? "Log cleared" : "Nothing to save", { description: logTitle(date) })
    close()
  }

  const addPrompt = (label: string) => {
    const next = appendPrompt(text, label)
    setText(next)
    caret.current = next.length
    ref.current?.focus()
  }

  return (
    <>
      <div className="flex h-10 items-center justify-between gap-2 border-b border-line pr-2 pl-3.5">
        <Prompt tool="log" command={logCommand(date)} />
        <Button variant="ghost" size="icon-sm" aria-label="Close log" onClick={close}>
          ✕
        </Button>
      </div>
      <form
        className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <DialogTitle className="font-heading text-[17px] font-bold">{logTitle(date)}</DialogTitle>
        <DialogDescription className="sr-only">The daily log for this day, with the tasks due.</DialogDescription>
        {tasks.length > 0 && (
          <ul className="bw-well flex flex-col gap-[5px] px-2.5 py-2" aria-label="Tasks due this day">
            {tasks.map((t) => (
              <li key={t.id} className="grid grid-cols-[8px_minmax(0,1fr)] items-center gap-2 text-[11px]">
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-[1.5px]", t.done ? "bg-faint" : past ? "bg-amber" : "bg-red")}
                />
                <span className={cn("truncate", t.done ? "text-faint line-through" : "text-ink")}>
                  {t.title}
                  {t.done && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-1.5">
          {LOG_PROMPTS.map((p) => (
            <Button key={p} type="button" variant="ghost" size="sm" onClick={() => addPrompt(p)}>
              + {p}
            </Button>
          ))}
        </div>
        <textarea
          ref={ref}
          aria-label="Log entry"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
          }}
          placeholder="What did you ship, learn, or get stuck on?"
          className="bw-well h-[130px] resize-none p-2.5 font-mono text-xs leading-[1.6] text-ink outline-none focus-visible:border-ledge-hi"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-faint" aria-live="polite">
            {dirty ? "unsaved changes" : entry ? "editing saved entry" : "no entry yet"}
            {" · "}
            <Link to={logHref(date)} onClick={close} className="text-muted-foreground hover:text-ink">
              {date === todayKey() ? "full page" : "open page"}
            </Link>
          </span>
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Save log</Button>
          </div>
        </div>
      </form>
    </>
  )
}
