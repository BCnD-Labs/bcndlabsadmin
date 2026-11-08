import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newId } from "@/lib/ids"
import type { CourseTopic } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Units, modules or chapters of a course, in order. Paste a list (one per line) to add many at once. */
export function TopicsField({ value, onChange }: { value: CourseTopic[]; onChange: (next: CourseTopic[]) => void }) {
  const [text, setText] = useState("")
  const add = () => {
    const titles = text.split("\n").map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean)
    if (!titles.length) return
    onChange([...value, ...titles.map((title) => ({ id: newId("tpc"), title: title.slice(0, 200) }))].slice(0, 80))
    setText("")
  }
  return (
    <div className="grid gap-1.5" data-testid="topics-field">
      {value.map((t) => (
        <div key={t.id} className="flex items-center gap-2" data-testid="topic-edit-row">
          <Input aria-label="Module" className="flex-1" value={t.title} maxLength={200} onChange={(e) => onChange(value.map((x) => (x.id === t.id ? { ...x, title: e.target.value } : x)))} />
          <Button type="button" variant="quiet" size="icon-sm" aria-label={`Remove ${t.title}`} onClick={() => onChange(value.filter((x) => x.id !== t.id))}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input aria-label="New module" value={text} placeholder="Add a module, e.g. Module 5: Energy markets" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          onPaste={(e) => { const pasted = e.clipboardData.getData("text"); if (pasted.includes("\n")) { e.preventDefault(); setText(pasted) } }} />
        <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}><Plus /> Add</Button>
      </div>
    </div>
  )
}

/** Pick which topics an assignment or exam covers. */
export function TopicChips({ topics, value, onChange }: { topics: CourseTopic[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div role="group" aria-label="Module" className="flex flex-wrap gap-1.5">
      {topics.map((t) => {
        const on = value.includes(t.id)
        return <button key={t.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
          className={cn("h-7 max-w-full truncate rounded-full border px-2.5 text-[12px]", on ? "border-[var(--bw-blue,#64b5f6)] bg-[#64b5f622] text-ink" : "border-line text-muted-foreground hover:bg-raised")}>{t.title}</button>
      })}
    </div>
  )
}
