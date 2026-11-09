import { DocLinksField, cleanLinks } from "@/components/common/doc-links"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { COURSE_COLORS, kindInfo, parseTags } from "@/features/learning/learning-utils"
import { courseHref, learningHref } from "@/lib/routes"
import type { ClassMeeting, Course, CourseColor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { Field } from "./fields"
import { MeetingsField } from "./meetings-field"
import { TopicsField } from "./topics-field"
import { FormFrame } from "./form-frame"

/** Add or edit any kind of learning (Productivity → Learning → Add learning). Fields follow the kind. */
export function CourseForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Course>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.courses.find((c) => c.id === id))
  const itemCount = useWorkspace((s) => (id ? s.tasks.filter((t) => t.courseId === id).length : 0))
  const { create, update, remove } = useWorkspace.getState()
  const navigate = useNavigate()
  const base = existing ?? defaults
  const info = kindInfo(base?.kind)
  const k = info.value
  const isCourse = k === "course"
  const noun = info.label.toLowerCase()
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
    pagesRead: base?.pagesRead != null ? String(base.pagesRead) : "",
    pagesTotal: base?.pagesTotal != null ? String(base.pagesTotal) : "",
    meetings: (base?.meetings ?? []) as ClassMeeting[],
    topics: base?.topics ?? [],
    syllabus: base?.syllabus ?? "",
    policies: base?.policies ?? "",
    repoUrl: base?.repoUrl ?? "",
  })
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }))
  const datesBackwards = !!d.startDate && !!d.endDate && d.endDate < d.startDate
  const credits = d.credits.trim() === "" ? undefined : Number(d.credits)
  const creditsBad = credits !== undefined && (!Number.isFinite(credits) || credits < 0 || credits > 30)
  const url = d.url.trim()
  const urlBad = !!url && !/^https?:\/\/\S+$/i.test(url)
  const pageNum = (v: string) => (v.trim() === "" ? undefined : Number(v))
  const pagesRead = pageNum(d.pagesRead)
  const pagesTotal = pageNum(d.pagesTotal)
  const repoUrl = d.repoUrl.trim()
  const repoBad = !!repoUrl && !/^https?:\/\/\S+$/i.test(repoUrl)
  const meetingsBad = d.meetings.some((m) => m.end <= m.start)
  const pagesBad = [pagesRead, pagesTotal].some((n) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100_000))

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
      kind: k,
      pagesRead: k === "reading" ? pagesRead : undefined,
      pagesTotal: k === "reading" ? pagesTotal : undefined,
      meetings: isCourse && d.meetings.length ? d.meetings : undefined,
      topics: d.topics.filter((t) => t.title.trim()).length ? d.topics.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim() })) : undefined,
      syllabus: isCourse && d.syllabus.trim() ? d.syllabus.trim() : undefined,
      policies: isCourse && d.policies.trim() ? d.policies.trim() : undefined,
      repoUrl: isCourse && repoUrl ? repoUrl : undefined,
    }
    if (existing) {
      update("courses", existing.id, values)
      toast.success(`${info.label} updated`)
      onDone()
    } else {
      const c = create("courses", values)
      toast.success(`${info.label} added`)
      onDone()
      navigate(courseHref(c.id))
    }
  }

  return (
    <FormFrame
      title={existing ? `Edit ${noun}` : `New ${noun}`}
      onSubmit={save}
      submitLabel={existing ? "Save" : `Add ${noun}`}
      canSubmit={d.title.trim().length > 0 && !datesBackwards && !creditsBad && !urlBad && !pagesBad && !repoBad && !meetingsBad}
      onDelete={
        existing
          ? () => {
              remove("courses", existing.id)
              toast(itemCount ? `${info.label} deleted with its ${itemCount} item${itemCount === 1 ? "" : "s"}; linked notes were kept` : `${info.label} deleted`)
              onDone()
              navigate(learningHref)
            }
          : undefined
      }
    >
      <div className={cn("grid gap-x-4 gap-y-3.5", (isCourse || k === "certification") && "sm:grid-cols-[1fr_8rem]")}>
        <Field label={info.name[0]} htmlFor="course-title">
          <Input id="course-title" autoFocus value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={info.name[1]} />
        </Field>
        {(isCourse || k === "certification") && (
          <Field label={isCourse ? "Course code" : "Exam code"} htmlFor="course-code">
            <Input id="course-code" className="font-mono uppercase" maxLength={16} value={d.code} onChange={(e) => set({ code: e.target.value })} placeholder={isCourse ? "CS 2110" : "200-301"} />
          </Field>
        )}
      </div>
      {k === "skill" && (
        <Field label="Goal" htmlFor="course-description" hint="What you want to be able to do. The first line shows on the card.">
          <Textarea id="course-description" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Ship a small CLI tool in Rust" />
        </Field>
      )}
      <div className={cn("grid gap-x-4 gap-y-3.5 sm:grid-cols-2", !info.person && !isCourse && k !== "reading" && "hidden")}>
        {info.person && (
          <Field label={info.person[0]} htmlFor="course-instructor">
            <Input id="course-instructor" value={d.instructor} onChange={(e) => set({ instructor: e.target.value })} placeholder={info.person[1]} />
          </Field>
        )}
        {isCourse && (
          <>
            <Field label="Instructor email" htmlFor="course-email">
              <Input id="course-email" type="email" value={d.instructorEmail} onChange={(e) => set({ instructorEmail: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Term" htmlFor="course-term">
              <Input id="course-term" value={d.term} onChange={(e) => set({ term: e.target.value })} placeholder="e.g. Spring 2027" />
            </Field>
            <Field label="Credits" htmlFor="course-credits" error={creditsBad ? "Enter a number from 0 to 30." : undefined}>
              <Input id="course-credits" inputMode="decimal" value={d.credits} onChange={(e) => set({ credits: e.target.value })} placeholder="Optional" />
            </Field>
          </>
        )}
        {k === "reading" && (
          <>
            <Field label="Pages read" htmlFor="course-pages-read" error={pagesBad ? "Whole numbers only." : undefined}>
              <Input id="course-pages-read" inputMode="numeric" value={d.pagesRead} onChange={(e) => set({ pagesRead: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Total pages" htmlFor="course-pages-total">
              <Input id="course-pages-total" inputMode="numeric" value={d.pagesTotal} onChange={(e) => set({ pagesTotal: e.target.value })} placeholder="Optional" />
            </Field>
          </>
        )}
      </div>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Start date" htmlFor="course-start">
          <Input id="course-start" type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label={info.endLabel} htmlFor="course-end" error={datesBackwards ? "Before the start date." : undefined}>
          <Input id="course-end" type="date" value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
        {isCourse && (
          <>
            <Field label="Schedule" htmlFor="course-schedule">
              <Input id="course-schedule" value={d.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="e.g. Mon/Wed 10:00–11:15" />
            </Field>
            <Field label="Location" htmlFor="course-location">
              <Input id="course-location" value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Room or Online" />
            </Field>
          </>
        )}
      </div>
      <Field label="Modules" htmlFor="course-topics" hint="Units, chapters or topics, in order (Module 1, Module 2…). Paste a list, one per line. Each assignment can then sit in a module.">
        <TopicsField value={d.topics} onChange={(topics) => set({ topics })} />
      </Field>
      {isCourse && (
        <>
          <Field label="Class and office-hour times" htmlFor="course-meetings" hint="They repeat every week between the start and end dates and show up on your calendar and in Today.">
            <MeetingsField value={d.meetings} onChange={(meetings) => set({ meetings })} />
          </Field>
          <Field label="Class repository" htmlFor="course-repo" error={repoBad ? "Start with http:// or https://" : undefined}>
            <Input id="course-repo" type="url" value={d.repoUrl} onChange={(e) => set({ repoUrl: e.target.value })} placeholder="https://github.com/…" />
          </Field>
          <Field label="Syllabus notes" htmlFor="course-syllabus" hint="Grading breakdown, schedule, what the class covers.">
            <Textarea id="course-syllabus" rows={4} value={d.syllabus} onChange={(e) => set({ syllabus: e.target.value })} />
          </Field>
          <Field label="Policies" htmlFor="course-policies" hint="Late work, attendance, collaboration, how to reach the instructor.">
            <Textarea id="course-policies" rows={3} value={d.policies} onChange={(e) => set({ policies: e.target.value })} />
          </Field>
        </>
      )}
      <Field label={info.linkLabel} htmlFor="course-url" hint={isCourse ? "The course site or LMS page, to open it from here." : "Opens in a new tab."} error={urlBad ? "Start with http:// or https://" : undefined}>
        <Input id="course-url" type="url" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
      </Field>
      <Field label="Linked documents" htmlFor="course-links" hint={k === "skill" ? "Docs, tutorials, notebooks: your resources. They open in their own app." : k === "reading" ? "Your notes on it (SiYuan, Obsidian…). They open in their own app." : isCourse ? "Syllabus, shared drives, notebooks. They open in their own app." : "Study guides, notes, files. They open in their own app."}>
        <DocLinksField value={d.links} onChange={(links) => set({ links })} />
      </Field>
      <Field label="Tags" htmlFor="course-tags" hint={isCourse ? "Separate with commas, e.g. major, online, lab." : "Separate with commas, e.g. networking, career."}>
        <Input id="course-tags" value={d.tags} onChange={(e) => set({ tags: e.target.value })} />
      </Field>
      <Field label="Colour" htmlFor="course-color-blue">
        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
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
      {k !== "skill" && (
        <Field label="Description" htmlFor="course-description">
          <Textarea id="course-description" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder={isCourse ? "Optional: what it covers, grading, office hours…" : "Optional"} />
        </Field>
      )}
    </FormFrame>
  )
}
