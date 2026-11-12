import { useState } from "react"
import { addDays, addMonths, format, isToday, startOfMonth } from "date-fns"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PlannerCalendar } from "@/features/productivity/planner-calendar"
import { CheckInChips } from "@/features/journal/check-in-chips"
import { PlannerNotes } from "@/features/productivity/planner-notes"
import { parseKey, toDateKey, todayKey } from "@/lib/dates"
import { newId } from "@/lib/ids"
import type { JournalLogItem } from "@/lib/types"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { MAX_LOG_SECTIONS, MAX_SECTION_TITLE } from "@shared/journal-sections"
import { useDock, type ToolId } from "./dock-store"

/** The Planner, split into pieces that live beside any page. They all follow the dock's chosen day. */
const logTimestamp = () => new Date().toISOString()

function DayNav({ label }: { label: string }) {
  const date = useDock((s) => s.date)
  const setDate = useDock((s) => s.setDate)
  const day = parseKey(date)
  return (
    <div className="mac-tool-row">
      <strong>{label}</strong>
      <span className="mac-tool-spacer" />
      <Button variant="quiet" size="icon-sm" aria-label="Previous day" onClick={() => setDate(toDateKey(addDays(day, -1)))}><ChevronLeft /></Button>
      <Button variant="outline" size="xs" disabled={isToday(day)} onClick={() => setDate(todayKey())}>Today</Button>
      <Button variant="quiet" size="icon-sm" aria-label="Next day" onClick={() => setDate(toDateKey(addDays(day, 1)))}><ChevronRight /></Button>
    </div>
  )
}

export function CalendarTool() {
  const date = useDock((s) => s.date)
  const setDate = useDock((s) => s.setDate)
  const [month, setMonth] = useState(() => startOfMonth(parseKey(date)))
  const pick = (value: string) => {
    setDate(value)
    setMonth(startOfMonth(parseKey(value)))
  }
  return (
    <div>
      <div className="mac-tool-row">
        <strong>{format(month, "MMMM yyyy")}</strong>
        <span className="mac-tool-spacer" />
        <Button variant="quiet" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
        <Button variant="outline" size="xs" onClick={() => pick(todayKey())}>Today</Button>
        <Button variant="quiet" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
      </div>
      <PlannerCalendar selected={date} month={month} onSelect={pick} />
    </div>
  )
}

export function TasksTool() {
  const date = useDock((s) => s.date)
  const tasks = useWorkspace((s) => s.tasks)
  const toggleTask = useWorkspace((s) => s.toggleTask)
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  const today = todayKey()
  const day = tasks.filter((t) => t.due === date || t.focusDate === date)
  const overdue = date === today ? tasks.filter((t) => !t.done && t.due && t.due < today && t.focusDate !== date) : []
  const rows = [...overdue.map((t) => ({ t, late: true })), ...day.map((t) => ({ t, late: false }))]
  const open = (id: string) => navigate(`/productivity?date=${date}&task=${id}`)
  return (
    <div>
      <div className="mac-tool-row">
        <strong>{isToday(parseKey(date)) ? "Today" : format(parseKey(date), "EEE, MMM d")}</strong>
        <span className="mac-tool-count">{rows.filter((r) => !r.t.done).length} open</span>
        <span className="mac-tool-spacer" />
        <Button variant="outline" size="xs" onClick={() => openForm({ kind: "task", defaults: { due: date } })}><Plus /> Task</Button>
      </div>
      {rows.length ? (
        <ul className="mac-task-list">
          {rows.map(({ t, late }) => (
            <li key={t.id} className="mac-task" data-done={t.done} data-late={late}>
              <Checkbox checked={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onCheckedChange={() => toggleTask(t.id)} />
              <button type="button" onClick={() => open(t.id)}>{t.title}</button>
              {late && <span className="mac-task-tag">overdue</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mac-tool-empty">Nothing due or focused on this day.</p>
      )}
    </div>
  )
}

/** The daily log: Morning, Afternoon and Evening check-ins on top, then the day's entries by section. `hideNav` when the page already has a day navigator. */
export function LogTool({ hideNav = false }: { hideNav?: boolean } = {}) {
  const date = useDock((s) => s.date)
  const entry = useWorkspace((s) => s.journal.find((j) => j.id === date))
  const saveSections = useWorkspace((s) => s.saveJournalSections)
  const saveItem = useWorkspace((s) => s.saveJournalItem)
  const saveLegacy = useWorkspace((s) => s.saveJournalLegacyText)
  const drafts = useDock((s) => s.logDrafts)
  const setDraft = useDock((s) => s.setLogDraft)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [naming, setNaming] = useState<{ id?: string; title: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; sectionId?: string; legacy: boolean } | null>(null)
  const sections = [{ id: undefined, title: "Entries", text: entry?.text ?? "", noteId: entry?.mainNoteId }, ...(entry?.sections ?? [])]
  const saveName = () => {
    if (!naming) return
    const title = naming.title.trim()
    if (!title || title.length > MAX_SECTION_TITLE) return
    if (naming.id) saveSections(date, (entry?.sections ?? []).map((section) => section.id === naming.id ? { ...section, title } : section))
    else if ((entry?.sections?.length ?? 0) < MAX_LOG_SECTIONS) {
      const id = newId("log")
      saveSections(date, [...(entry?.sections ?? []), { id, title, text: "" }])
      setExpanded((value) => ({ ...value, [`${date}/${id}`]: true }))
    }
    setNaming(null)
  }
  const saveNew = (sectionId?: string) => {
    const key = `${date}/${sectionId ?? "main"}/new`
    const text = drafts[key]?.trim()
    if (!text) return
    const stamp = logTimestamp()
    const item: JournalLogItem = { id: newId("log"), text, sectionId, createdAt: stamp, updatedAt: stamp }
    saveItem(date, item)
    if (useWorkspace.getState().journal.find((j) => j.id === date)?.entries?.some((saved) => saved.id === item.id)) setDraft(key, null)
  }
  const saveEdit = (item?: JournalLogItem) => {
    if (!editing) return
    const key = `${date}/${editing.id}/edit`
    const text = drafts[key]?.trim()
    if (!text) return
    if (editing.legacy) saveLegacy(date, editing.sectionId, text, !!(editing.sectionId ? entry?.sections?.find((s) => s.id === editing.sectionId)?.noteId : entry?.mainNoteId), `nte_log_${editing.id}`)
    else if (item) saveItem(date, { ...item, text }, !!item.noteId)
    const saved = useWorkspace.getState().journal.find((j) => j.id === date)
    if (editing.legacy ? (editing.sectionId ? saved?.sections?.find((s) => s.id === editing.sectionId)?.text : saved?.text) !== text : saved?.entries?.find((savedItem) => savedItem.id === editing.id)?.text !== text) return
    setDraft(key, null)
    setEditing(null)
  }
  return (
    <div className="mac-log-tool">
      {!hideNav && <DayNav label={format(parseKey(date), "EEE, MMM d")} />}
      <CheckInChips day={date} />
      <div className="mac-log-groups">
        {sections.map((section) => {
          const key = `${date}/${section.id ?? "main"}`
          const open = expanded[key] ?? !section.id
          // Check-ins and reviews (ids starting "journal-") have their own buttons and tab; they are not log entries.
          const items = (entry?.entries ?? []).filter((item) => item.sectionId === section.id && !item.id.startsWith("journal-") && !item.courseId && !item.taskId)
          const count = items.length + Number(!!section.text.trim())
          const composeKey = `${key}/new`
          const row = (id: string, text: string, item?: JournalLogItem) => {
            const legacy = !item
            const editKey = `${date}/${id}/edit`
            const active = editing?.id === id && editing?.sectionId === section.id
            return <div className="mac-log-item" key={id}>
              {active ? <>
                <textarea aria-label={`Edit ${section.title} entry`} value={drafts[editKey] ?? text} onChange={(event) => setDraft(editKey, event.target.value)} />
                <div className="mac-log-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="is-primary" disabled={!(drafts[editKey] ?? text).trim()} onClick={() => saveEdit(item)}>Save</button></div>
              </> : <button type="button" className="mac-log-item-text" onClick={() => { if (!(editKey in drafts)) setDraft(editKey, text); setEditing({ id, sectionId: section.id, legacy }) }} title="Edit entry">{text}</button>}
            </div>
          }
          return <div className="mac-log-group" key={key}>
            <div className="mac-log-group-head">
              <button type="button" aria-expanded={open} onClick={() => setExpanded((value) => ({ ...value, [key]: !open }))}>
                <strong>{section.title}</strong><span>{count}</span>{open ? <ChevronUp /> : <ChevronDown />}
              </button>
              {section.id && <button type="button" className="mac-log-rename" aria-label={`Rename ${section.title}`} onClick={() => setNaming({ id: section.id, title: section.title })}><Pencil /></button>}
            </div>
            {open && <div className="mac-log-group-body">
              <textarea aria-label={`New ${section.title} entry`} placeholder="What happened?" value={drafts[composeKey] ?? ""} onChange={(event) => setDraft(composeKey, event.target.value)} />
              {!!drafts[composeKey]?.trim() && <div className="mac-log-actions"><button type="button" className="is-primary" onClick={() => saveNew(section.id)}>Save entry</button></div>}
              {!!section.text.trim() && row(`legacy-${section.id ?? "main"}`, section.text)}
              {items.map((item) => row(item.id, item.text, item))}
              {!count && <p className="mac-tool-empty">No entries yet.</p>}
            </div>}
          </div>
        })}
      </div>
      {naming ? <div className="mac-log-name"><input aria-label="Section name" maxLength={MAX_SECTION_TITLE} value={naming.title} onChange={(event) => setNaming({ ...naming, title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveName(); if (event.key === "Escape") setNaming(null) }} autoFocus /><button type="button" className="is-primary" disabled={!naming.title.trim()} onClick={saveName}>Save</button><button type="button" onClick={() => setNaming(null)}>Cancel</button></div>
        : (entry?.sections?.length ?? 0) < MAX_LOG_SECTIONS && <button type="button" className="mac-log-add" onClick={() => setNaming({ title: "" })}><Plus /> Add section</button>}
    </div>
  )
}

export function NotesTool() {
  return <div className="mac-notes-tool"><PlannerNotes /></div>
}

export const TOOL_VIEWS: Record<ToolId, () => React.JSX.Element> = { calendar: CalendarTool, today: TasksTool, log: LogTool, notes: NotesTool }
