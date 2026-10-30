import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { todayKey } from "@/lib/dates"
import type { CalendarEvent } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { Field, ProjectSelect } from "./fields"
import { FormFrame } from "./form-frame"

export function EventForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<CalendarEvent>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.events.find((e) => e.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    title: base?.title ?? "",
    date: base?.date ?? todayKey(),
    allDay: existing ? !existing.start : false,
    start: base?.start ?? "09:00",
    end: base?.end ?? "10:00",
    location: base?.location ?? "",
    notes: base?.notes ?? "",
    projectId: base?.projectId,
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))
  const timeInvalid = !draft.allDay && draft.end && draft.start && draft.end < draft.start

  const save = () => {
    const values = {
      title: draft.title.trim(),
      date: draft.date,
      start: draft.allDay ? undefined : draft.start || undefined,
      end: draft.allDay ? undefined : draft.end || undefined,
      location: draft.location.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      projectId: draft.projectId,
    }
    if (existing) {
      update("events", existing.id, values)
      toast.success("Event updated")
    } else {
      create("events", values)
      toast.success("Event added to agenda")
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? "Edit event" : "New event"}
      onSubmit={save}
      canSubmit={draft.title.trim().length > 0 && !!draft.date && !timeInvalid}
      onDelete={
        existing
          ? () => {
              remove("events", existing.id)
              toast("Event deleted")
              onDone()
            }
          : undefined
      }
    >
      <Field label="Title" htmlFor="event-title">
        <Input id="event-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Event name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="event-date">
          <Input id="event-date" type="date" required value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <div className="flex items-end gap-2 pb-1.5">
          <Switch id="event-allday" checked={draft.allDay} onCheckedChange={(allDay) => set({ allDay })} />
          <Label htmlFor="event-allday" className="text-sm">All day</Label>
        </div>
        {!draft.allDay && (
          <>
            <Field label="Start" htmlFor="event-start">
              <Input id="event-start" type="time" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="End" htmlFor="event-end" hint={timeInvalid ? <span className="text-red-text">End must be after start.</span> : undefined}>
              <Input id="event-end" type="time" value={draft.end} aria-invalid={!!timeInvalid} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Location" htmlFor="event-location">
          <Input id="event-location" value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Project" htmlFor="event-project">
          <ProjectSelect id="event-project" value={draft.projectId} onChange={(projectId) => set({ projectId })} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="event-notes">
        <Textarea id="event-notes" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </FormFrame>
  )
}
