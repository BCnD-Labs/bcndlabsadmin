import { Star } from "lucide-react"
import { useMemo, useState } from "react"
import { DocLinksField, cleanLinks } from "@/components/common/doc-links"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { kindInfo, learningType } from "@/features/learning/learning-utils"
import type { LearningItemType, Subtask, Task, WorkEffort, WorkStatus } from "@/lib/types"
import { EFFORTS, WORK_STATUSES } from "@shared/learning"
import { useWorkspace } from "@/stores/workspace"
import { CourseSelect, Field, OptionSelect } from "./fields"
import { FormFrame } from "./form-frame"
import { StepsField } from "./steps-field"
import { LinkedRecordsField } from "./linked-records-field"
import { tasksLinkingTask } from "@shared/links"
import { TopicChips } from "./topics-field"
import { StudyPlanButton } from "@/features/learning/study-plan"

export function TaskForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Task>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.tasks.find((t) => t.id === id))
  const hasCourses = useWorkspace((s) => s.courses.length > 0)
  const allTasks = useWorkspace((s) => s.tasks)
  // Derived outside the selector: a selector that builds a new array every call loops forever (React error 185).
  const usedTypes = useMemo(() => [...new Set(allTasks.map((t) => t.workType).filter((v): v is string => !!v))].sort(), [allTasks])
  const courses = useWorkspace((s) => s.courses)
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  const [draft, setDraft] = useState({
    title: base?.title ?? "",
    details: base?.details ?? "",
    due: base?.due ?? "",
    time: base?.time ?? "",
    courseId: base?.courseId,
    learningType: base?.learningType ?? ("assignment" as LearningItemType),
    starred: base?.starred ?? false,
    done: base?.done ?? false,
    links: base?.links ?? [],
    score: base?.score != null ? String(base.score) : "",
    status: base?.status as WorkStatus | undefined,
    effort: base?.effort as WorkEffort | undefined,
    workType: base?.workType ?? "",
    subtasks: (base?.subtasks ?? []) as Subtask[],
    topicIds: base?.topicIds ?? [],
    recordLinks: base?.recordLinks ?? [],
  })
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const course = courses.find((c) => c.id === draft.courseId)
  const kind = kindInfo(course?.kind)
  const type = learningType(draft.learningType, kind.value)
  // A practice test (certification) can carry its score.
  const scored = kind.value === "certification" && draft.learningType === "exam"
  const score = draft.score.trim() === "" ? undefined : Number(draft.score)
  const scoreBad = score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)
  // Coursework reads as what it is: "New assignment", "Exam updated".
  const noun = draft.courseId ? type.label : "Task"
  // Assignments, exams and milestones move through a lifecycle; events don't.
  const tracked = !!draft.courseId && draft.learningType !== "event"
  const finished = (status?: WorkStatus) => status === "submitted" || status === "graded"

  const save = () => {
    const values = {
      title: draft.title.trim(),
      details: draft.details.trim() || undefined,
      due: draft.due || undefined,
      time: (draft.due && draft.time) || undefined,
      courseId: draft.courseId,
      learningType: draft.courseId ? draft.learningType : undefined,
      starred: draft.starred,
      done: draft.done,
      status: tracked ? draft.status : undefined,
      effort: tracked ? draft.effort : undefined,
      workType: draft.courseId && draft.workType.trim() ? draft.workType.trim().slice(0, 60) : undefined,
      subtasks: draft.subtasks.filter((s) => s.title.trim()).length ? draft.subtasks.filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim() })) : undefined,
      topicIds: draft.courseId && draft.topicIds.length ? draft.topicIds.filter((id) => course?.topics?.some((t) => t.id === id)) : undefined,
      links: cleanLinks(draft.links),
      recordLinks: draft.recordLinks.length ? draft.recordLinks : undefined,
      score: draft.courseId && scored ? score : undefined,
    }
    if (existing) {
      const completedAt = values.done ? (existing.completedAt ?? new Date().toISOString()) : undefined
      update("tasks", existing.id, { ...values, completedAt })
      toast.success(`${noun} updated`)
    } else {
      create("tasks", { ...values, completedAt: values.done ? new Date().toISOString() : undefined })
      toast.success(`${noun} added`)
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}
      onSubmit={save}
      canSubmit={draft.title.trim().length > 0 && !(scored && scoreBad)}
      onDelete={
        existing
          ? () => {
              remove("tasks", existing.id)
              toast(`${noun} deleted`)
              onDone()
            }
          : undefined
      }
    >
      <Field label="Title" htmlFor="task-title">
        <Input id="task-title" autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
      </Field>
      {(hasCourses || draft.courseId) && (
        <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Learning" htmlFor="task-course">
            <CourseSelect
              id="task-course"
              value={draft.courseId}
              onChange={(courseId) => {
                // Keep the type when the new kind has it; otherwise use that kind's first type.
                const next = kindInfo(courses.find((c) => c.id === courseId)?.kind)
                set({ courseId, learningType: next.types.some((t) => t.value === draft.learningType) ? draft.learningType : next.types[0].value })
              }}
            />
          </Field>
          {draft.courseId && (
            <Field label="Type" htmlFor="task-type">
              <OptionSelect id="task-type" value={draft.learningType} onChange={(learningType) => set({ learningType })} options={kind.types.map((t) => ({ value: t.value, label: t.label }))} />
            </Field>
          )}
        </div>
      )}
      {draft.courseId && draft.learningType !== "event" && draft.learningType !== "milestone" && (
        <Field label={`${type.label} type`} htmlFor="task-worktype" hint="Optional. Your own label, like Reading, Vocabulary or Document. Ones you have used before are suggested.">
          <Input id="task-worktype" list="task-worktypes" maxLength={60} value={draft.workType} onChange={(e) => set({ workType: e.target.value })} placeholder="e.g. Reading" />
          <datalist id="task-worktypes">{usedTypes.map((v) => <option key={v} value={v} />)}</datalist>
        </Field>
      )}
      <Field label={draft.courseId ? "Notes" : "Details"} htmlFor="task-details">
        <Textarea
          id="task-details"
          rows={draft.courseId ? 4 : 3}
          value={draft.details}
          onChange={(e) => set({ details: e.target.value })}
          placeholder={draft.courseId ? "Optional: requirements, links, what to study…" : "Optional"}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={draft.courseId ? type.dateLabel : "Due date"} htmlFor="task-due" className="w-44">
          <Input id="task-due" type="date" value={draft.due} onChange={(e) => set({ due: e.target.value })} />
        </Field>
        {draft.due && (
          <Field label="Time" htmlFor="task-time" className="w-32">
            <Input id="task-time" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
        )}
        {draft.courseId && scored && (
          <Field label="Score %" htmlFor="task-score" className="w-28" error={scoreBad ? "0 to 100." : undefined}>
            <Input id="task-score" inputMode="decimal" value={draft.score} onChange={(e) => set({ score: e.target.value })} placeholder="—" />
          </Field>
        )}
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="task-star" checked={draft.starred} onCheckedChange={(starred) => set({ starred })} />
          <Label htmlFor="task-star" className="inline-flex items-center gap-1 text-xs font-normal">
            <Star className="size-3.5 text-amber" aria-hidden /> Starred
          </Label>
        </div>
        {existing && (
          <div className="flex items-center gap-2 pb-1.5">
            <Switch id="task-done" checked={draft.done} onCheckedChange={(done) => set({ done, ...(draft.status && { status: done ? "submitted" : "in_progress" }) })} />
            <Label htmlFor="task-done" className="text-xs font-normal">Done</Label>
          </div>
        )}
      </div>
      {tracked && (
        <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Where it stands" htmlFor="task-status">
            <OptionSelect id="task-status" value={draft.status ?? (draft.done ? "submitted" : "not_started")} onChange={(status) => set({ status, done: finished(status) })} options={WORK_STATUSES} />
          </Field>
          <Field label="How big is it?" htmlFor="task-effort" hint="Sets how many days ahead the planner suggests starting.">
            <OptionSelect id="task-effort" value={draft.effort ?? "medium"} onChange={(effort) => set({ effort })} options={EFFORTS.map((e) => ({ value: e.value, label: `${e.label} · ${e.hint}` }))} />
          </Field>
        </div>
      )}
      {!!course?.topics?.length && draft.learningType !== "event" && (
        <Field label="Module" htmlFor="task-topics" hint="Which module this belongs to. An exam can cover several; its study plan reviews each one.">
          <TopicChips topics={course.topics} value={draft.topicIds} onChange={(topicIds) => set({ topicIds })} />
        </Field>
      )}
      <Field label="Steps" htmlFor="task-steps" hint="Break it into smaller pieces. Give a step a day and it shows up in Today and the week.">
        <StepsField value={draft.subtasks} onChange={(subtasks) => set({ subtasks })} />
      </Field>
      {existing && (draft.learningType === "exam" || draft.learningType === "quiz") && !!draft.courseId && !draft.done && !!draft.due && (
        <div><StudyPlanButton taskId={existing.id} draft={{ task: { ...existing, due: draft.due || undefined, learningType: draft.learningType, topicIds: draft.topicIds, subtasks: draft.subtasks }, onChange: (t) => set({ subtasks: t.subtasks ?? [] }) }} /></div>
      )}
      <Field label="Linked notes and tasks" htmlFor="task-records" hint="Notes and other tasks that belong with this. The links show on both sides.">
        <LinkedRecordsField value={draft.recordLinks} onChange={(recordLinks) => set({ recordLinks })} selfId={existing?.id} backlinks={existing ? tasksLinkingTask({ tasks: allTasks }, existing.id) : []} />
      </Field>
      <Field label="Linked documents" htmlFor="task-links" hint="Notes, specs or files that live elsewhere. They open in their own app.">
        <DocLinksField value={draft.links} onChange={(links) => set({ links })} />
      </Field>
    </FormFrame>
  )
}
