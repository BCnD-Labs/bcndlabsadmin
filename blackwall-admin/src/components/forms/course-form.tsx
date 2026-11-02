import { DocLinksField, cleanLinks } from "@/components/common/doc-links"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { COURSE_COLORS, parseTags } from "@/features/learning/learning-utils"
import { courseHref, learningHref } from "@/lib/routes"
import type { Course, CourseColor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { Field } from "./fields"
import { FormFrame } from "./form-frame"

/** Add or edit a course (Productivity → Learning → Add learning → Course). */
export function CourseForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Course>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.courses.find((c) => c.id === id))
  const itemCount = useWorkspace((s) => (id ? s.tasks.filter((t) => t.courseId === id).length : 0))
  const { create, update, remove } = useWorkspace.getState()
  const navigate = useNavigate()
  const base = existing ?? defaults
  const [d, setD] = useState({
    title: base?.title ?? "",
    code: base?.code ?? "",
    term: base?.term ?? "",
    instructor: base?.instructor ?? "",
    instructorEmail: base?.instructorEmail ?? "",
    startDate: base?.startDate ?? "",
    endDate: base?.endDate ?? "",
    schedule: base?.schedule ?? "",
    location: base?.location ?? "",
    url: base?.url ?? "",
    credits: base?.credits != null ? String(base.credits) : "",
    color: base?.color ?? ("blue" as CourseColor),
    tags: (base?.tags ?? []).join(", "),
    description: base?.description ?? "",
    links: base?.links ?? [],
  })
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }))
  const datesBackwards = !!d.startDate && !!d.endDate && d.endDate < d.startDate
  const credits = d.credits.trim() === "" ? undefined : Number(d.credits)
  const creditsBad = credits !== undefined && (!Number.isFinite(credits) || credits < 0 || credits > 30)
  const url = d.url.trim()
  const urlBad = !!url && !/^https?:\/\/\S+$/i.test(url)

  const save = () => {
    const values = {
      title: d.title.trim(),
      code: d.code.trim().toUpperCase(),
      term: d.term.trim(),
      instructor: d.instructor.trim(),
      instructorEmail: d.instructorEmail.trim(),
      startDate: d.startDate || undefined,
      endDate: d.endDate || undefined,
      schedule: d.schedule.trim(),
      location: d.location.trim(),
      url,
      credits,
      color: d.color,
      tags: parseTags(d.tags),
      description: d.description.trim(),
      links: cleanLinks(d.links),
    }
    if (existing) {
      update("courses", existing.id, values)
      toast.success("Course updated")
      onDone()
    } else {
      const c = create("courses", values)
      toast.success("Course added")
      onDone()
      navigate(courseHref(c.id))
    }
  }

  return (
    <FormFrame
      title={existing ? "Edit course" : "New course"}
      onSubmit={save}
      submitLabel={existing ? "Save" : "Add course"}
      canSubmit={d.title.trim().length > 0 && !datesBackwards && !creditsBad && !urlBad}
      onDelete={
        existing
          ? () => {
              remove("courses", existing.id)
              toast(itemCount ? `Course deleted with its ${itemCount} item${itemCount === 1 ? "" : "s"}; linked notes were kept` : "Course deleted")
              onDone()
              navigate(learningHref)
            }
          : undefined
      }
    >
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-[1fr_8rem]">
        <Field label="Course name" htmlFor="course-title">
          <Input id="course-title" autoFocus value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Data Structures" />
        </Field>
        <Field label="Course code" htmlFor="course-code">
          <Input id="course-code" className="font-mono uppercase" maxLength={16} value={d.code} onChange={(e) => set({ code: e.target.value })} placeholder="CS 2110" />
        </Field>
      </div>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Instructor" htmlFor="course-instructor">
          <Input id="course-instructor" value={d.instructor} onChange={(e) => set({ instructor: e.target.value })} placeholder="Name" />
        </Field>
        <Field label="Instructor email" htmlFor="course-email">
          <Input id="course-email" type="email" value={d.instructorEmail} onChange={(e) => set({ instructorEmail: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Term" htmlFor="course-term">
          <Input id="course-term" value={d.term} onChange={(e) => set({ term: e.target.value })} placeholder="e.g. Spring 2027" />
        </Field>
        <Field label="Credits" htmlFor="course-credits" error={creditsBad ? "Enter a number from 0 to 30." : undefined}>
          <Input id="course-credits" inputMode="decimal" value={d.credits} onChange={(e) => set({ credits: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Start date" htmlFor="course-start">
          <Input id="course-start" type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="End date" htmlFor="course-end" error={datesBackwards ? "Ends before it starts." : undefined}>
          <Input id="course-end" type="date" value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
        <Field label="Schedule" htmlFor="course-schedule">
          <Input id="course-schedule" value={d.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="e.g. Mon/Wed 10:00–11:15" />
        </Field>
        <Field label="Location" htmlFor="course-location">
          <Input id="course-location" value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Room or Online" />
        </Field>
      </div>
      <Field label="Course link" htmlFor="course-url" hint="The course site or LMS page, to open it from here." error={urlBad ? "Start with http:// or https://" : undefined}>
        <Input id="course-url" type="url" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
      </Field>
      <Field label="Linked documents" htmlFor="course-links" hint="Syllabus, shared drives, notebooks. They open in their own app.">
        <DocLinksField value={d.links} onChange={(links) => set({ links })} />
      </Field>
      <Field label="Tags" htmlFor="course-tags" hint="Separate with commas, e.g. major, online, lab.">
        <Input id="course-tags" value={d.tags} onChange={(e) => set({ tags: e.target.value })} />
      </Field>
      <Field label="Colour" htmlFor="course-color-blue">
        <div role="radiogroup" aria-label="Course colour" className="flex flex-wrap gap-1.5">
          {COURSE_COLORS.map((c) => (
            <button
              key={c.value}
              id={`course-color-${c.value}`}
              type="button"
              role="radio"
              aria-checked={d.color === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => set({ color: c.value })}
              className={cn("size-6 rounded-[6px] transition-transform duration-150", c.dot, d.color === c.value && "ring-2 ring-ink-2 ring-offset-2 ring-offset-popover")}
            />
          ))}
        </div>
      </Field>
      <Field label="Description" htmlFor="course-description">
        <Textarea id="course-description" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Optional: what it covers, grading, office hours…" />
      </Field>
    </FormFrame>
  )
}
