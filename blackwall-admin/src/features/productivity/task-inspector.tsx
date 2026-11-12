import { useState } from "react"
import { format } from "date-fns"
import { BookOpen, CalendarDays, ChevronRight, FileText, Globe, Link2, PenLine, Pencil, Plus, Star, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { draftHref, sitePageHref } from "@/lib/routes"
import { toast } from "sonner"
import { Panel } from "@/components/common/panel"
import { DocLinksMenu } from "@/components/common/doc-links"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Course, RecordLink, ReflectionItem, Task, TaskReflection } from "@/lib/types"
import { ModuleChip } from "@/features/learning/module-chip"
import { toggleSubtask } from "@shared/records"
import { stepProgress } from "@shared/steps"
import { parseKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { useUi } from "@/stores/ui"
import { REFLECTION_ITEMS } from "@shared/planner"
import { PlannerSaveState } from "./planner-save-state"
import { taskSlot } from "./planner-utils"

const reflectionTimestamp = () => new Date().toISOString()

export type InspectorTab = "details" | "reflection"

export function TaskInspector({ task, date, tab, onTab, onDate, onSelect }: {
  task?: Task; date: string; tab: InspectorTab; onTab: (value: InspectorTab) => void; onDate: (date: string) => void; onSelect: (task: Task) => void
}) {
  const update = useWorkspace((s) => s.update)
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const toggleStar = useWorkspace((s) => s.toggleStar)
  const course = useWorkspace((s) => s.courses.find((c) => c.id === task?.courseId))
  return <Panel title={task?.title ?? "Selected task"} category="tasks" className={task ? "planner-inspector" : "planner-inspector is-empty"} bodyClassName="flex flex-col" actions={task && <>
    <Button variant="quiet" size="icon-sm" aria-label={task.starred ? "Unstar task" : "Star task"} aria-pressed={task.starred} onClick={() => toggleStar(task.id)}><Star className={cn(task.starred && "fill-current text-amber")} /></Button>
    <Button variant="quiet" size="sm" onClick={() => useUi.getState().openForm({ kind: "task", id: task.id })}><Pencil /> Edit</Button>
  </>}>
    {!task ? <div className="p-5 text-sm text-muted-foreground"><FileText className="mb-3 size-6" /><p>Select a calendar item or open Tasks to see its details and reflection.</p><p className="mt-2">Checking something off opens an optional reflection here.</p></div> : <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
        <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={task.done} aria-label={task.done ? "Mark task incomplete" : "Complete task"} onCheckedChange={() => { toggleTask(task.id); if (!task.done) { onTab("reflection"); requestAnimationFrame(() => document.getElementById("reflection-text")?.focus()) } }} />
          <span className={cn(task.done && "text-green")}>{task.done ? `Completed${task.completedAt ? ` ${format(new Date(task.completedAt), "MMM d · HH:mm")}` : ""}` : "Mark complete"}</span>
        </label>
        {course && <span className="ml-auto text-muted-foreground">{course.code || course.title}</span>}
      </div>
      <SegmentedTabs label="Selected task" idBase="inspector" value={tab} onChange={onTab} tabs={[{ value: "details", label: "Details" }, { value: "reflection", label: "Reflection" }]} className="mx-3" />
      <div role="tabpanel" id="inspector-panel" aria-labelledby={`inspector-tab-${tab}`} className="p-4">
        {tab === "details" ? <div className="space-y-4">
          <div><h3 className="bw-label mb-1">Task details</h3><p className="whitespace-pre-wrap text-sm text-ink-2">{task.details || "No instructions added."}</p></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>Due: {task.due ? format(parseKey(task.due), "MMM d, yyyy") : "No deadline"}{task.time ? ` · ${task.time}` : ""}</span><DocLinksMenu links={task.links} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={task.focusDate === date} onCheckedChange={(checked) => update("tasks", task.id, { focusDate: checked ? date : undefined })} />Focus on {format(parseKey(date), "MMM d")}</label>
          <TaskParts task={task} course={course} />
          <ScheduleFields key={task.id} task={task} />
        </div> : <ReflectionEditor key={task.id} task={task} date={date} onDone={() => onTab("details")} />}
      </div>
      <LinkedRecords task={task} date={date} onDate={onDate} onSelect={onSelect} />
    </>}
  </Panel>
}

/** What the Learning pages add to a task: its module, its own type, and its steps. The same ones, ticked the same way. */
function TaskParts({ task, course }: { task: Task; course?: Course }) {
  const toggle = (stepId: string) => useWorkspace.setState((s) => toggleSubtask({ tasks: s.tasks }, task.id, stepId))
  const steps = task.subtasks ?? []
  if (!steps.length && !task.workType && !task.topicIds?.length) return null
  return (
    <div className="space-y-2 border-t border-line-soft pt-3" data-testid="inspector-parts">
      {(task.workType || !!task.topicIds?.length) && <div className="flex flex-wrap items-center gap-1.5 text-xs">{task.workType && <span className="rounded-full bg-ink-2/10 px-2 py-0.5 text-ink-2">{task.workType}</span>}<ModuleChip task={task} course={course} /></div>}
      {steps.length > 0 && <>
        <h3 className="bw-label">Steps · {stepProgress(task).done}/{stepProgress(task).total}</h3>
        <ul className="space-y-1">{steps.map((st) => <li key={st.id} className="flex items-center gap-2 text-sm"><Checkbox checked={st.done} aria-label={`${st.title}: done`} onCheckedChange={() => toggle(st.id)} /><span className={cn("min-w-0 flex-1", st.done && "text-faint line-through")}>{st.title}</span>{st.date && <span className="shrink-0 text-[11px] text-muted-foreground">{format(parseKey(st.date), "MMM d")}</span>}</li>)}</ul>
      </>}
    </div>
  )
}

function ScheduleFields({ task }: { task: Task }) {
  const update = useWorkspace((s) => s.update)
  const slot = taskSlot(task)
  const currentSlot = () => taskSlot(useWorkspace.getState().tasks.find((value) => value.id === task.id) ?? task)
  return <fieldset className="space-y-2 border-t border-line-soft pt-3">
    <legend className="bw-label px-1">Calendar schedule</legend>
    <p className="text-xs text-muted-foreground">Plan time here without changing the deadline.</p>
    <div className="grid grid-cols-2 gap-2">
      <label className="planner-field">Planned date<input type="date" value={slot.date ?? ""} onChange={(e) => update("tasks", task.id, { scheduledDate: e.target.value || undefined, scheduledTime: e.target.value ? currentSlot().time : undefined })} /></label>
      <label className="planner-field">Start time<input type="time" disabled={!slot.date} value={slot.time ?? ""} onChange={(e) => update("tasks", task.id, { scheduledDate: currentSlot().date, scheduledTime: e.target.value || undefined })} /></label>
      <label className="planner-field col-span-2">Duration<select aria-label="Duration" value={task.durationMinutes ?? ""} onChange={(e) => update("tasks", task.id, { durationMinutes: e.target.value ? Number(e.target.value) : undefined })}><option value="">No duration recorded</option>{[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>
    </div>
    {task.scheduledDate && <Button variant="quiet" size="xs" onClick={() => update("tasks", task.id, { scheduledDate: undefined, scheduledTime: undefined, durationMinutes: undefined })}>Clear separate schedule</Button>}
  </fieldset>
}

function ReflectionEditor({ task, date, onDone }: { task: Task; date: string; onDone: () => void }) {
  const update = useWorkspace((s) => s.update)
  const saveJournal = useWorkspace((s) => s.saveJournal)
  const journal = useWorkspace((s) => s.journal.find((entry) => entry.id === date))
  const [custom, setCustom] = useState<Set<ReflectionItem>>(new Set())
  const reflection = task.reflection ?? { text: "", items: {}, updatedAt: "" }
  // Stage each keystroke in the existing persistent workspace outbox. Navigating away
  // or switching records cannot discard a draft; server sync retains its conflict handling.
  const change = (patch: Partial<TaskReflection>) => {
    const latest = useWorkspace.getState().tasks.find((value) => value.id === task.id)?.reflection ?? reflection
    update("tasks", task.id, { reflection: { ...latest, ...patch, updatedAt: reflectionTimestamp() } })
  }
  const item = (key: ReflectionItem, value?: string) => {
    const items = { ...(useWorkspace.getState().tasks.find((value) => value.id === task.id)?.reflection?.items ?? reflection.items) }
    if (value === undefined) delete items[key]
    else items[key] = value
    change({ items })
  }
  const text = [reflection.text, ...Object.entries(reflection.items).filter(([, value]) => value.trim()).map(([key, value]) => `${REFLECTION_ITEMS[key as ReflectionItem].label}: ${value}`)].filter(Boolean).join("\n")
  const logBlock = `### ${task.title}\n${text}`
  const inLog = !!journal?.text.includes(logBlock)
  const addToLog = () => {
    const current = useWorkspace.getState().journal.find((entry) => entry.id === date)?.text ?? ""
    if (!text.trim() || current.includes(logBlock)) return
    saveJournal(date, [current, logBlock].filter(Boolean).join("\n\n"))
    const links = useWorkspace.getState().tasks.find((value) => value.id === task.id)?.recordLinks ?? []
    if (!links.some((link) => link.kind === "log" && link.id === date)) update("tasks", task.id, { recordLinks: [...links, { kind: "log", id: date }] })
    toast.success("Reflection added to daily log")
  }
  return <div className="planner-reflection space-y-3">
    <label htmlFor="reflection-text" className="block text-sm font-semibold">How did it go?</label>
    <textarea id="reflection-text" value={reflection.text} onChange={(e) => change({ text: e.target.value })} placeholder="A quick note is enough. What happened, what helped, or what would you change?" className="planner-reflection-text" />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Plus /> Add reflection item</Button></DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">{(Object.keys(REFLECTION_ITEMS) as ReflectionItem[]).map((key) => <DropdownMenuCheckboxItem key={key} checked={key in reflection.items} onCheckedChange={(checked) => item(key, checked ? "" : undefined)}>{REFLECTION_ITEMS[key].label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
      </DropdownMenu>
      <PlannerSaveState />
    </div>
    <p className="text-xs text-muted-foreground">Use optional fields or just type it above.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {(Object.keys(REFLECTION_ITEMS) as ReflectionItem[]).filter((key) => key in reflection.items).map((key) => {
        const field = REFLECTION_ITEMS[key]
        const value = reflection.items[key] ?? ""
        const own = custom.has(key) || !field.options.length || (!!value && !(field.options as readonly string[]).includes(value))
        return <div key={key} className={cn("planner-field", !field.options.length && "sm:col-span-2 xl:col-span-1 2xl:col-span-2")}>
          <div className="flex items-center justify-between"><label htmlFor={`reflection-${key}`}>{field.label}</label><button type="button" className="planner-remove" aria-label={`Remove ${field.label}`} onClick={() => item(key, undefined)}><X className="size-3" /></button></div>
          {own ? <input id={`reflection-${key}`} value={value} placeholder={key === "timeSpent" ? "e.g. 42 min" : "Write a short note"} onChange={(e) => item(key, e.target.value)} /> : <select id={`reflection-${key}`} value={value} onChange={(e) => {
            if (e.target.value === "__custom") { setCustom((state) => new Set(state).add(key)); requestAnimationFrame(() => document.getElementById(`reflection-${key}`)?.focus()) }
            else item(key, e.target.value)
          }}><option value="">Choose…</option>{field.options.map((option) => <option key={option}>{option}</option>)}<option value="__custom">Write my own…</option></select>}
        </div>
      })}
    </div>
    <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3"><Button variant="outline" size="sm" disabled={!text.trim() || inLog} onClick={addToLog}><BookOpen /> {inLog ? "Added to daily log" : "Add to daily log"}</Button><Button variant="quiet" size="sm" onClick={onDone}>Done</Button></div>
    <p className="text-[11px] text-muted-foreground">Reflection is optional. The task stays {task.done ? "complete" : "open"}.</p>
  </div>
}

function LinkedRecords({ task, date, onDate, onSelect }: { task: Task; date: string; onDate: (date: string) => void; onSelect: (task: Task) => void }) {
  const notes = useWorkspace((s) => s.notes)
  const tasks = useWorkspace((s) => s.tasks)
  const journal = useWorkspace((s) => s.journal)
  const pages = useWorkspace((s) => s.pages)
  const drafts = useWorkspace((s) => s.drafts)
  const sites = useWorkspace((s) => s.sites)
  const update = useWorkspace((s) => s.update)
  const navigate = useNavigate()
  const siteName = (id?: string) => sites.find((x) => x.id === id)?.name ?? "Site"
  const [kind, setKind] = useState<RecordLink["kind"]>("note")
  const [target, setTarget] = useState("")
  const [open, setOpen] = useState(false)
  const links = task.recordLinks ?? []
  const choices = kind === "page" ? pages.map((p) => ({ id: p.id, title: `${siteName(p.siteId)} › ${p.title || "Untitled"}` })) : kind === "post" ? drafts.filter((d) => d.siteId && d.kind === "post").map((d) => ({ id: d.id, title: `${siteName(d.siteId)} › ${d.title || "Untitled"}` })) : kind === "note" ? notes.map((note) => ({ id: note.id, title: note.text.split("\n")[0] || "Untitled note" })) : kind === "task" ? tasks.filter((value) => value.id !== task.id).map((value) => ({ id: value.id, title: value.title })) : [...new Set([date, ...journal.map((entry) => entry.id)])].sort().reverse().map((key) => ({ id: key, title: format(parseKey(key), "EEE, MMM d, yyyy") }))
  const add = () => {
    if (!target || links.some((link) => link.id === target && link.kind === kind) || links.length >= 50) return
    update("tasks", task.id, { recordLinks: [...links, { kind, id: target }] })
    setTarget(""); setOpen(false)
  }
  const openRecord = (link: RecordLink) => {
    if (link.kind === "page") return navigate(sitePageHref(link.id))
    if (link.kind === "post") return navigate(draftHref(link.id))
    if (link.kind === "note") useUi.getState().openForm({ kind: "note", id: link.id })
    else if (link.kind === "log") { onDate(link.id); requestAnimationFrame(() => document.getElementById("planner-log")?.focus()) }
    else { const value = tasks.find((value) => value.id === link.id); if (value) onSelect(value) }
  }
  return <section className="mx-4 mb-4 border-t border-line-soft pt-3" aria-label="Linked records">
    <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Linked records</h3><span className="flex gap-1"><Button variant="quiet" size="xs" onClick={() => useUi.getState().openForm({ kind: "pageFromTask", id: task.id })}><Globe /> Create page</Button><Button variant="quiet" size="xs" aria-expanded={open} onClick={() => setOpen(!open)}><Plus /> Link existing</Button></span></div>
    {open && <div className="mb-3 space-y-2 rounded-md border border-line p-2">
      <label className="planner-field">Record type<select aria-label="Record type" value={kind} onChange={(e) => { setKind(e.target.value as RecordLink["kind"]); setTarget("") }}><option value="note">Note</option><option value="task">Task / calendar item</option><option value="log">Daily log</option><option value="page">Website page</option><option value="post">Website post</option></select></label>
      <label className="planner-field">Choose record<select aria-label="Choose record" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{choices.filter((value) => !links.some((link) => link.kind === kind && link.id === value.id)).map((value) => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
      <Button variant="outline" size="sm" disabled={!target || links.length >= 50} onClick={add}><Link2 /> Link record</Button>
    </div>}
    {!links.length && <p className="text-xs text-muted-foreground">Connect notes, calendar items, or a day's log.</p>}
    <ul className="space-y-1">{links.map((link) => {
      const note = link.kind === "note" ? notes.find((value) => value.id === link.id) : undefined
      const linkedTask = link.kind === "task" ? tasks.find((value) => value.id === link.id) : undefined
      const page = link.kind === "page" ? pages.find((value) => value.id === link.id) : undefined
      const post = link.kind === "post" ? drafts.find((value) => value.id === link.id) : undefined
      const missing = link.kind === "page" ? !page : link.kind === "post" ? !post : link.kind === "note" ? !note : link.kind === "task" ? !linkedTask : false
      const title = link.kind === "page" ? `Page: ${page ? page.title || "Untitled" : "Deleted page"}` : link.kind === "post" ? `Post: ${post ? post.title || "Untitled" : "Deleted post"}` : link.kind === "note" ? `Note: ${note?.text.split("\n")[0] || "Deleted note"}` : link.kind === "task" ? `Task: ${linkedTask?.title || "Deleted task"}` : `Log: ${format(parseKey(link.id), "MMM d, yyyy")}`
      const Icon = link.kind === "page" ? Globe : link.kind === "post" ? PenLine : link.kind === "note" ? FileText : link.kind === "task" ? CalendarDays : BookOpen
      return <li key={`${link.kind}:${link.id}`} className="flex items-center gap-1 rounded-md border border-line-soft"><button disabled={missing} type="button" className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left text-xs hover:bg-raised disabled:opacity-60" onClick={() => openRecord(link)}><Icon className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 break-words">{title}</span><ChevronRight className="size-3 shrink-0" /></button><Button variant="quiet" size="icon-sm" aria-label={`Unlink ${title}`} onClick={() => update("tasks", task.id, { recordLinks: links.filter((value) => value !== link) })}><X /></Button></li>
    })}</ul>
  </section>
}
