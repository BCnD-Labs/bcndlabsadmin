import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newId } from "@/lib/ids"
import type { ClassMeeting, MeetingKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MEETING_KINDS, WEEKDAY_LABELS } from "@shared/learning"
import { OptionSelect } from "./fields"

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Weekly class, lab and office-hour times. They repeat between the course's start and end dates and show on the calendar. */
export function MeetingsField({ value, onChange }: { value: ClassMeeting[]; onChange: (next: ClassMeeting[]) => void }) {
  const patch = (id: string, change: Partial<ClassMeeting>) => onChange(value.map((m) => (m.id === id ? { ...m, ...change } : m)))
  const add = (kind: MeetingKind) => onChange([...value, { id: newId("mtg"), kind, days: kind === "office" ? [3] : [1, 3], start: kind === "office" ? "14:00" : "10:00", end: kind === "office" ? "15:00" : "11:15" }])
  return (
    <div className="grid gap-2">
      {value.map((m) => {
        const bad = m.end <= m.start
        return (
          <div key={m.id} className="grid gap-2 rounded-md border border-line-soft p-2.5" data-testid="meeting-row">
            <div className="flex flex-wrap items-center gap-2">
              <OptionSelect value={m.kind} onChange={(kind) => patch(m.id, { kind })} options={MEETING_KINDS} className="w-36" label="Kind of meeting" />
              <div role="group" aria-label="Days" className="flex gap-1">
                {WEEK_ORDER.map((d) => {
                  const on = m.days.includes(d)
                  return <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAY_LABELS[d]} onClick={() => { const days = on ? m.days.filter((x) => x !== d) : [...m.days, d]; if (days.length) patch(m.id, { days }) }} className={cn("h-7 w-9 rounded-[5px] border text-[11px] font-medium", on ? "border-[var(--bw-blue,#64b5f6)] bg-[#64b5f622] text-ink" : "border-line text-muted-foreground hover:bg-raised")}>{WEEKDAY_LABELS[d]}</button>
                })}
              </div>
              <Button type="button" variant="quiet" size="icon-sm" className="ml-auto" aria-label="Remove this time" onClick={() => onChange(value.filter((x) => x.id !== m.id))}><Trash2 /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="time" aria-label="Starts" className="w-28" value={m.start} onChange={(e) => e.target.value && patch(m.id, { start: e.target.value })} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" aria-label="Ends" className="w-28" value={m.end} onChange={(e) => e.target.value && patch(m.id, { end: e.target.value })} aria-invalid={bad} />
              <Input aria-label="Room" className="min-w-32 flex-1" value={m.location ?? ""} onChange={(e) => patch(m.id, { location: e.target.value || undefined })} placeholder="Room or Online" maxLength={200} />
            </div>
            {bad && <p className="text-[11px] text-red">The end must be after the start.</p>}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add("class")}><Plus /> Class time</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("office")}><Plus /> Office hours</Button>
      </div>
    </div>
  )
}
