import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { CHECKS, CHECK_LABELS, EMPTY_CHECK_IN, SCALE_MAX, formWording, hasAnswers, hasCheckIn, readCheckIn, readSlotCheckIn, reviewId, slotForm, slotLabel, toggleTick, writeCheckIn, writeSlotCheckIn, type Answers, type CheckIn, type FormField, type Period, type Slot } from "@shared/journal-review"

const MOODS = ["Great", "Okay", "Low", "Rough"]
const ENERGY = ["High", "Medium", "Low"]
const CHOICES_KEY = "blackwall-mac-checkin-choices-v1"
type ChoiceOverrides = Partial<Record<Slot, Record<string, string[]>>>
function readChoices(): ChoiceOverrides {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHOICES_KEY) ?? "{}")
    if (!saved || typeof saved !== "object") return {}
    const result: ChoiceOverrides = {}
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      const fields = (saved as Record<string, unknown>)[slot]
      if (!fields || typeof fields !== "object") continue
      result[slot] = {}
      for (const field of slotForm(slot)) {
        const options = (fields as Record<string, unknown>)[field.id]
        if (Array.isArray(options) && options.length > 0 && options.length <= 20 && options.every(value => typeof value === "string" && value.length <= 60 && !value.includes(","))) result[slot]![field.id] = options
      }
    }
    return result
  } catch { return {} }
}

function Chip({ on, children, onClick, multi }: { on: boolean; children: string; onClick: () => void; multi?: boolean }) {
  return <button type="button" role={multi ? "checkbox" : "radio"} aria-checked={on} onClick={onClick}
    className={cn("h-8 max-w-full truncate rounded-full border px-3 text-[12.5px]", on ? "border-[var(--bw-blue,#64b5f6)] bg-[#64b5f622] text-ink" : "border-line text-ink-2 hover:bg-raised")}>{on && multi ? "✓ " : ""}{children}</button>
}

function Question({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><div className="flex items-baseline justify-between gap-3"><p className="text-[13px] font-semibold text-ink">{title}</p><span className="bw-label text-[10px]">{hint}</span></div>{children}</div>
}

/** One slot field: a 1 to 5 scale, a pick, ticks, or one line of text. Mostly taps. */
function SlotField({ field, value, onChange }: { field: FormField; value?: string; onChange: (v: string) => void }) {
  if (field.kind === "scale") {
    return <Question title={field.question} hint="PICK ONE">
      <div role="radiogroup" aria-label={field.question} className="grid grid-cols-5 gap-1.5">{Array.from({ length: SCALE_MAX }, (_, i) => String(i + 1)).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? "" : n)} className={cn("h-9 rounded-md border text-sm", value === n ? "border-[var(--bw-blue,#64b5f6)] bg-[#64b5f622] text-ink" : "border-line text-ink-2 hover:bg-raised")}>{n}</button>
      ))}</div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>1 · {field.low}</span><span>{field.high} · {SCALE_MAX}</span></div>
    </Question>
  }
  if (field.kind === "text") return <Question title={field.question} hint="OPTIONAL"><input aria-label={field.question} value={value ?? ""} onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))} placeholder={field.placeholder} className="h-9 rounded-md border border-line bg-well px-3 text-sm text-ink" /></Question>
  const multi = field.kind === "tick"
  const selected = multi ? (value ?? "").split(", ").filter(Boolean) : value ? [value] : []
  const options = [...(field.options ?? []), ...selected.filter((x) => !(field.options ?? []).includes(x))]
  return <Question title={field.question} hint={multi ? "PICK ANY" : "PICK ONE"}>
    <div className="flex flex-wrap gap-1.5">{options.map((o) => <Chip key={o} multi={multi} on={selected.includes(o)} onClick={() => onChange(multi ? toggleTick(value, o) : value === o ? "" : o)}>{o}</Chip>)}</div>
  </Question>
}

/**
 * The morning, afternoon and evening check-ins and the weekly, monthly and yearly reviews. They are saved as readable
 * text under the period's start day, in the same form the Android app writes, so each reads the other's.
 */
export function CheckInDialog({ period, anchor, slot, todayTitles, onClose }: { period: Period; anchor: string; slot?: Slot; todayTitles: string[]; onClose: () => void }) {
  const mac = document.documentElement.dataset.runtime === "mac-native"
  const key = reviewId(period, anchor, slot)
  const saved = useWorkspace((s) => s.journal.find((j) => j.id === anchor)?.entries?.find((i) => i.id === key))
  const saveItem = useWorkspace((s) => s.saveJournalItem)
  const words = formWording(period)
  const [answers, setAnswers] = useState<Answers>(() => (slot && saved ? readSlotCheckIn(slot, saved.text) : {}))
  const [form, setForm] = useState<CheckIn>(() => (!slot && saved ? readCheckIn(saved.text) : { ...EMPTY_CHECK_IN, checks: [] }))
  const [choices, setChoices] = useState(readChoices)
  const [editingChoices, setEditingChoices] = useState<string | null>(null)
  const [choiceDraft, setChoiceDraft] = useState("")
  const fields = slot ? slotForm(slot, todayTitles).map(field => ({ ...field, options: choices[slot]?.[field.id] ?? field.options })) : []
  const editChoices = (field: FormField) => {
    setEditingChoices(field.id)
    setChoiceDraft((field.options ?? []).join("\n"))
  }
  const saveChoices = (field: FormField) => {
    if (!slot) return
    const options = [...new Set(choiceDraft.split("\n").map(value => value.trim()).filter(Boolean))]
    if (!options.length || options.length > 20 || options.some(value => value.length > 60 || value.includes(","))) return toast.error("Use 1–20 choices, up to 60 characters each, without commas.")
    const next = { ...choices, [slot]: { ...choices[slot], [field.id]: options } }
    setChoices(next)
    try { localStorage.setItem(CHOICES_KEY, JSON.stringify(next)) } catch { toast.error("Choices could not be saved on this Mac.") }
    setEditingChoices(null)
  }
  const resetChoices = (field: FormField) => {
    if (!slot) return
    const next = { ...choices, [slot]: { ...choices[slot] } }
    delete next[slot]![field.id]
    setChoices(next)
    try { localStorage.setItem(CHOICES_KEY, JSON.stringify(next)) } catch { toast.error("Choices could not be saved on this Mac.") }
    setEditingChoices(null)
  }
  const ok = slot ? hasAnswers(answers) : hasCheckIn(form)
  const save = () => {
    const now = new Date().toISOString()
    saveItem(anchor, { id: key, text: slot ? writeSlotCheckIn(slot, answers) : writeCheckIn(period, form), createdAt: saved?.createdAt ?? now, updatedAt: now })
    if (!useWorkspace.getState().journal.find((j) => j.id === anchor)?.entries?.some((i) => i.id === key)) return toast.error("Couldn't save. Your answers are still here.")
    toast.success(slot ? `${slotLabel(slot)} check-in saved` : `${words.title} saved`)
    onClose()
  }
  const set = (patch: Partial<CheckIn>) => setForm((f) => ({ ...f, ...patch }))
  return (
    <Dialog open modal={!mac} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="mac-checkin-dialog max-w-xl" showOverlay={!mac} onInteractOutside={event => { if (mac) event.preventDefault() }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>{slot ? `${slotLabel(slot)} check-in` : words.title}</DialogTitle>
        <DialogDescription>Every question is optional. {slot ? "Mostly taps." : "A few words is plenty."}</DialogDescription>
        <div className="mac-checkin-fields grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          {slot ? fields.map((f) => <div key={f.id} className="grid gap-1.5">
            <SlotField field={f} value={answers[f.id]} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
            {mac && (f.kind === "pick" || f.kind === "tick") && !f.fromTasks && <>
              <button type="button" className="justify-self-start text-[11px] text-muted-foreground hover:text-ink" onClick={() => editChoices(f)}>Edit choices</button>
              {editingChoices === f.id && <div className="grid gap-2 rounded-md border border-line bg-well p-2">
                <label className="text-[11px] text-muted-foreground" htmlFor={`choices-${f.id}`}>One choice per line · saved on this Mac</label>
                <Textarea id={`choices-${f.id}`} rows={Math.min(6, Math.max(3, (f.options?.length ?? 0) + 1))} value={choiceDraft} onChange={event => setChoiceDraft(event.target.value)} />
                <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" onClick={() => resetChoices(f)}>Restore defaults</Button><Button size="xs" variant="ghost" onClick={() => setEditingChoices(null)}>Cancel</Button><Button size="xs" onClick={() => saveChoices(f)}>Save choices</Button></div>
              </div>}
            </>}
          </div>) : <>
            <Question title={words.mood} hint="PICK ONE"><div className="flex flex-wrap gap-1.5">{MOODS.map((m) => <Chip key={m} on={form.mood === m} onClick={() => set({ mood: form.mood === m ? "" : m })}>{m}</Chip>)}</div></Question>
            <Question title={words.energy} hint="PICK ONE"><div className="flex flex-wrap gap-1.5">{ENERGY.map((m) => <Chip key={m} on={form.energy === m} onClick={() => set({ energy: form.energy === m ? "" : m })}>{m}</Chip>)}</div></Question>
            <Question title={words.checks} hint="PICK ANY"><div className="flex flex-wrap gap-1.5">{CHECKS.map((c) => <Chip key={c} multi on={form.checks.includes(c)} onClick={() => set({ checks: form.checks.includes(c) ? form.checks.filter((x) => x !== c) : [...form.checks, c] })}>{CHECK_LABELS[c]}</Chip>)}</div></Question>
            {words.prompts.map((p) => <Question key={p.key} title={p.question} hint="OPTIONAL"><input aria-label={p.question} value={form[p.key]} onChange={(e) => set({ [p.key]: e.target.value })} placeholder="A few words is plenty" className="h-9 rounded-md border border-line bg-well px-3 text-sm text-ink" /></Question>)}
            <Question title={words.notes} hint="OPTIONAL"><Textarea rows={4} aria-label={words.notes} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Write as much or as little as you like…" /></Question>
          </>}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!ok} onClick={save}>{slot ? `Save ${slot} check-in` : words.save}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
