import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { Battery, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileText, Folder, GraduationCap, Maximize2, Pin, Settings2, Volume2, Wifi, X } from "lucide-react"
import { moveAroundLocked, overlaps, resizeAroundLocked, type WindowRect } from "./window-geometry"
import "./prototype.css"

type Tool = "planner" | "learning" | "notes"
type Rect = WindowRect
type WindowState = Rect & { open: boolean; collapsed: boolean; expanded: boolean; pinned: boolean; z: number; restore?: Rect }
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
type Gesture = { tool: Tool; pointer: number; startX: number; startY: number; lastX: number; lastY: number; rect: Rect; current: Rect; edge?: Edge }

const sampleTasks = [
  { title: "Review project outline", detail: "Planner · due today" },
  { title: "Write learning notes", detail: "Systems Design · tomorrow" },
  { title: "Prepare the next build", detail: "Project · Friday" },
  { title: "Read chapter 7", detail: "Learning · next week" },
]
const sampleCourses = ["Systems Design", "Machine Learning", "Applied Algorithms"]
const edges: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]
const title: Record<Tool, string> = { planner: "Planner", learning: "Learning", notes: "Notes" }
const kind: Record<Tool, "app" | "widget"> = { planner: "widget", learning: "app", notes: "widget" }
const icon: Record<Tool, typeof CalendarDays> = { planner: CalendarDays, learning: GraduationCap, notes: FileText }
const minimum: Record<Tool, [number, number]> = { planner: [650, 360], learning: [280, 240], notes: [300, 180] }

function startingWindows(): Record<Tool, WindowState> {
  const w = window.innerWidth, h = window.innerHeight
  return {
    learning: { x: Math.max(72, w * .08), y: 82, width: Math.min(420, w * .33), height: 410, open: true, collapsed: false, expanded: false, pinned: false, z: 1 },
    planner: { x: Math.max(240, w * .24), y: Math.max(140, h * .18), width: Math.min(1040, w * .68), height: Math.min(470, h * .53), open: true, collapsed: false, expanded: false, pinned: false, z: 2 },
    notes: { x: Math.max(410, w * .44), y: Math.min(h - 100, h * .75), width: Math.min(500, w * .43), height: 270, open: true, collapsed: true, expanded: false, pinned: false, z: 3 },
  }
}

function DesktopPrototype() {
  const [windows, setWindows] = useState(startingWindows)
  const [done, setDone] = useState<number[]>([2])
  const [day, setDay] = useState(6)
  const [logOpen, setLogOpen] = useState<string[]>(["Shipped", "Learned"])
  const [now, setNow] = useState(() => new Date())
  const gesture = useRef<Gesture | null>(null)
  const layer = useRef(3)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const update = (tool: Tool, change: (value: WindowState) => WindowState) => setWindows(prev => ({ ...prev, [tool]: change(prev[tool]) }))
  const focus = (tool: Tool) => { const z = ++layer.current; update(tool, value => ({ ...value, open: true, z })) }
  const open = (tool: Tool) => { const z = ++layer.current; update(tool, value => ({ ...value, open: true, collapsed: false, z })) }
  const close = (tool: Tool) => update(tool, value => ({ ...value, open: false }))
  const collapse = (tool: Tool) => update(tool, value => ({ ...value, collapsed: !value.collapsed }))
  const pin = (tool: Tool) => update(tool, value => {
    if (value.pinned) return { ...value, pinned: false }
    const others = (Object.keys(windows) as Tool[]).filter(id => id !== tool && kind[id] === "widget" && windows[id].open)
    return others.some(id => overlaps({ ...value, height: value.collapsed ? 30 : value.height }, { ...windows[id], height: windows[id].collapsed ? 30 : windows[id].height })) ? value : { ...value, pinned: true }
  })
  const expand = (tool: Tool) => update(tool, value => {
    if (value.expanded && value.restore) return { ...value, ...value.restore, expanded: false, collapsed: false, restore: undefined }
    const restore = { x: value.x, y: value.y, width: value.width, height: value.height }
    return { ...value, x: Math.max(52, Math.min(value.x, 140)), y: 62, width: Math.min(window.innerWidth - 75, 1320), height: Math.min(window.innerHeight - 86, 720), expanded: true, collapsed: false, restore }
  })

  const start = (event: PointerEvent<HTMLElement>, tool: Tool, edge?: Edge) => {
    if (event.button !== 0 || (!edge && (event.target as Element).closest("button"))) return
    const value = windows[tool]
    if (value.pinned && (!edge || edge.includes("n") || edge.includes("w"))) return
    gesture.current = { tool, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, rect: value, current: value, edge }
    event.currentTarget.setPointerCapture(event.pointerId)
    focus(tool)
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || g.pointer !== event.pointerId) return
    const dx = event.clientX - g.startX, dy = event.clientY - g.startY
    let { x, y, width, height } = g.rect
    const blockers = kind[g.tool] === "widget" ? (Object.keys(windows) as Tool[]).filter(id => id !== g.tool && kind[id] === "widget" && windows[id].open && windows[id].pinned).map(id => ({ ...windows[id], height: windows[id].collapsed ? 30 : windows[id].height })) : []
    if (!g.edge) {
      const moved = moveAroundLocked(g.current, event.clientX - g.lastX, event.clientY - g.lastY, blockers)
      x = moved.x; y = moved.y
    }
    else {
      if (g.edge.includes("e")) width += dx
      if (g.edge.includes("s")) height += dy
      if (g.edge.includes("w")) { x += dx; width -= dx }
      if (g.edge.includes("n")) { y += dy; height -= dy }
      const [minWidth, minHeight] = minimum[g.tool]
      if (width < minWidth) { if (g.edge.includes("w")) x -= minWidth - width; width = minWidth }
      if (height < minHeight) { if (g.edge.includes("n")) y -= minHeight - height; height = minHeight }
    }
    x = Math.min(window.innerWidth - 100, Math.max(45, x))
    y = Math.min(window.innerHeight - 30, Math.max(48, y))
    const next = g.edge ? resizeAroundLocked(g.current, { x, y, width, height }, blockers) : { x, y, width, height }
    g.current = next
    g.lastX = event.clientX; g.lastY = event.clientY
    update(g.tool, value => ({ ...value, ...next }))
  }
  const end = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointer === event.pointerId) gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const frame = (tool: Tool, children: ReactNode) => {
    const value = windows[tool], Icon = icon[tool]
    if (!value.open) return null
    return <section className={`bw-proto-window ${value.collapsed ? "is-collapsed" : ""} ${value.expanded ? "is-expanded" : ""}`} aria-label={`${title[tool]} window`}
      style={{ left: value.x, top: value.y, width: value.width, height: value.collapsed ? 30 : value.height, zIndex: (kind[tool] === "app" ? 1000 : 10) + value.z }} onPointerDown={event => { if (!(event.target as Element).closest(".bw-proto-titlebar, .bw-proto-edge")) focus(tool) }}>
      <header className="bw-proto-titlebar" onPointerDown={event => start(event, tool)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={() => collapse(tool)}>
        <Icon size={16} className="bw-proto-title-icon" /><strong>{title[tool]}</strong><span className="bw-proto-spacer" />
        {kind[tool] === "widget" && <button type="button" aria-label={value.pinned ? `Unlock ${title[tool]} position` : `Lock ${title[tool]} position`} aria-pressed={value.pinned} onClick={() => pin(tool)}><Pin size={15} fill={value.pinned ? "currentColor" : "none"} /></button>}
        <button type="button" aria-label={value.expanded ? `Compact ${title[tool]} view` : `Expand ${title[tool]} view`} aria-pressed={value.expanded} onClick={() => expand(tool)}><Maximize2 size={15} /></button>
        <button type="button" aria-label={`Close ${title[tool]}`} onClick={() => close(tool)}><X size={17} /></button>
      </header>
      {!value.collapsed && <div className="bw-proto-body">{children}</div>}
      {edges.map(edge => <span key={edge} className={`bw-proto-edge edge-${edge}`} onPointerDown={event => start(event, tool, edge)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />)}
    </section>
  }

  const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now)
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now)
  return <div className="bw-proto-desktop">
    <nav className="bw-proto-launcher" aria-label="Toolbox">
      <span className="bw-proto-mark">BW</span>
      <button type="button" title="Planner" aria-label="Open Planner" className={windows.planner.open ? "active" : ""} onClick={() => open("planner")}><CalendarDays size={16} /></button>
      <button type="button" title="Learning" aria-label="Open Learning" className={windows.learning.open ? "active" : ""} onClick={() => open("learning")}><GraduationCap size={16} /></button>
      <button type="button" title="Notes" aria-label="Open Notes" className={windows.notes.open ? "active" : ""} onClick={() => open("notes")}><FileText size={16} /></button>
      <button type="button" title="Other tools coming later" aria-label="Other tools coming later" disabled><Folder size={16} /></button>
      <span className="bw-proto-flex" />
      <button type="button" title="Prototype settings unavailable" aria-label="Prototype settings unavailable" disabled><Settings2 size={16} /></button>
    </nav>
    <div className="bw-proto-top" aria-label="Sample status and local time">
      <span className="bw-proto-chip bw-proto-status"><Wifi size={14} /><Volume2 size={14} /><Battery size={16} /><Bell size={14} /></span>
      <span className="bw-proto-chip">{date}</span><span className="bw-proto-chip">{time}</span>
    </div>
    <span className="bw-proto-sample">SAMPLE LAYOUT · LOCAL PROTOTYPE</span>
    {frame("learning", <div className="bw-proto-learning"><div className="bw-proto-heading"><span>Courses</span><button type="button">+ Add course</button></div>{sampleCourses.map((course, i) => <div className="bw-proto-course" key={course}><span className={`bw-proto-course-mark tone-${i}`} /><div><strong>{course}</strong><small>{i === 2 ? "Planned" : "In progress"} · {i === 0 ? "6" : i === 1 ? "12" : "8"} modules</small></div></div>)}<div className="bw-proto-heading">Upcoming work</div>{["Systems Design — Module 3", "ML — Problem set 2", "Algorithms — Reading"].map(item => <div className="bw-proto-learn-row" key={item}><input type="checkbox" aria-label={`Complete ${item}`} /><span>{item}</span></div>)}</div>)}
    {frame("planner", <div className="bw-proto-planner">
      <div className="bw-proto-pane"><div className="bw-proto-heading"><CalendarDays size={15} /> Calendar</div><div className="bw-proto-month"><button type="button" aria-label="Previous month"><ChevronLeft size={15} /></button><strong>November 2026</strong><button type="button" aria-label="Next month"><ChevronRight size={15} /></button></div><div className="bw-proto-calendar">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(label => <b key={label}>{label}</b>)}{Array.from({ length: 35 }, (_, i) => i < 30 ? <button type="button" key={i} className={day === i + 1 ? "selected" : ""} onClick={() => setDay(i + 1)}>{i + 1}</button> : <span key={i} />)}</div><div className="bw-proto-subhead">Fri, Nov {day}<button type="button" aria-label="Add calendar item">+</button></div>{["Deep work — Planner", "Learning — Systems Design", "Project sync"].map((item, i) => <div className="bw-proto-event" key={item}><i className={`tone-${i}`} /><span>{item}<small>{["10:00 – 12:00", "14:00 – 15:30", "16:00 – 16:30"][i]}</small></span></div>)}</div>
      <div className="bw-proto-pane"><div className="bw-proto-heading">☑ Tasks <small>{sampleTasks.length - done.length} open</small></div><div className="bw-proto-tabs"><button type="button" className="selected">Today</button><button type="button">Next</button><button type="button">Later</button></div>{sampleTasks.map((task, i) => <label className="bw-proto-task" key={task.title}><input type="checkbox" checked={done.includes(i)} onChange={() => setDone(ids => ids.includes(i) ? ids.filter(id => id !== i) : [...ids, i])} /><span className={done.includes(i) ? "done" : ""}>{task.title}<small>{task.detail}</small></span></label>)}<button type="button" className="bw-proto-add">+ Add task…</button></div>
      <div className="bw-proto-pane"><div className="bw-proto-heading"><FileText size={15} /> Daily log <small>Nov {day}</small></div>{["Shipped", "Learned", "Tomorrow"].map((section, i) => <div className="bw-proto-log-group" key={section}><button type="button" className="bw-proto-log-head" aria-expanded={logOpen.includes(section)} onClick={() => setLogOpen(open => open.includes(section) ? open.filter(item => item !== section) : [...open, section])}><ChevronDown size={13} className={logOpen.includes(section) ? "" : "closed"} /><span>{section}</span><small>{i === 2 ? 0 : 1}</small></button>{logOpen.includes(section) && <p>{["Reviewed the Blackwall desktop layout and window behavior.", "The compact view works best with readable rows and quiet borders.", "Add the next step when ready."][i]}</p>}</div>)}<button type="button" className="bw-proto-add">+ Add log entry…</button></div>
    </div>)}
    {frame("notes", <div className="bw-proto-notes"><div className="bw-proto-heading">Pinned notes</div><p>Desktop ideas</p><p>Learning references</p><button type="button" className="bw-proto-add">+ Add note…</button></div>)}
  </div>
}

createRoot(document.getElementById("root")!).render(<DesktopPrototype />)
