import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newId } from "@/lib/ids"
import type { Subtask } from "@/lib/types"

/** Small steps inside a task. A day on a step puts it on that day's plan (Today, the week, the planner). */
export function StepsField({ value, onChange }: { value: Subtask[]; onChange: (next: Subtask[]) => void }) {
  const [title, setTitle] = useState("")
  const patch = (id: string, change: Partial<Subtask>) => onChange(value.map((s) => (s.id === id ? { ...s, ...change } : s)))
  const add = () => {
    if (!title.trim() || value.length >= 100) return
    onChange([...value, { id: newId("sub"), title: title.trim().slice(0, 300), done: false }])
    setTitle("")
  }
  return (
    <div className="grid gap-1.5" data-testid="steps-field">
      {value.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2" data-testid="step-row">
          <Checkbox checked={s.done} onCheckedChange={(done) => patch(s.id, { done: done === true })} aria-label={`${s.title}: done`} />
          <Input aria-label="Step" className="min-w-40 flex-1" value={s.title} maxLength={300} onChange={(e) => patch(s.id, { title: e.target.value })} />
          <Input type="date" aria-label={`Day for ${s.title}`} className="w-40" value={s.date ?? ""} onChange={(e) => patch(s.id, { date: e.target.value || undefined })} />
          <Button type="button" variant="quiet" size="icon-sm" aria-label={`Remove ${s.title}`} onClick={() => onChange(value.filter((x) => x.id !== s.id))}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input aria-label="New step" value={title} maxLength={300} placeholder="Add a step: outline, draft, proofread…" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }} />
        <Button type="button" variant="outline" onClick={add} disabled={!title.trim()}><Plus /> Add</Button>
      </div>
    </div>
  )
}
