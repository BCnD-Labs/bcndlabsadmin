import { useRef, type PointerEvent } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TOOL_IDS, TOOL_INFO, useDock } from "./dock-store"
import { TOOL_VIEWS } from "./tools"

/** The right-hand sidebar: tools only (navigation lives on the left). Each tool is a window with a title bar. */
export function ToolDock() {
  const { open, width, tools, setWidth, addTool, removeTool, moveTool, toggleCollapsed } = useDock()
  const drag = useRef<{ pointer: number } | null>(null)
  if (!open) return null
  const missing = TOOL_IDS.filter((id) => !tools.some((t) => t.id === id))

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { pointer: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === e.pointerId) setWidth(window.innerWidth - e.clientX)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <aside className="mac-dock" style={{ width }} aria-label="Tools">
      <div className="mac-dock-resize" role="separator" aria-orientation="vertical" aria-label="Resize tools" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      <div className="mac-dock-head">
        <span>TOOLS</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs" disabled={!missing.length} aria-label="Add a tool"><Plus /> Add tool</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Add to the dock</DropdownMenuLabel>
            {missing.map((id) => (
              <DropdownMenuItem key={id} onSelect={() => addTool(id)}>
                <span>{TOOL_INFO[id].title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{TOOL_INFO[id].hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mac-dock-scroll">
        {tools.map((tool, i) => {
          const View = TOOL_VIEWS[tool.id]
          const title = TOOL_INFO[tool.id].title
          return (
            <section key={tool.id} className="mac-tool" data-tool={tool.id} data-collapsed={tool.collapsed}>
              <header className="mac-tool-title">
                <button type="button" className="mac-tool-toggle" aria-expanded={!tool.collapsed} onClick={() => toggleCollapsed(tool.id)}>
                  {tool.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  <span>{title}</span>
                </button>
                <span className="mac-tool-spacer" />
                <button type="button" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => moveTool(tool.id, -1)}><ArrowUp size={12} /></button>
                <button type="button" aria-label={`Move ${title} down`} disabled={i === tools.length - 1} onClick={() => moveTool(tool.id, 1)}><ArrowDown size={12} /></button>
                <button type="button" aria-label={`Remove ${title} from the dock`} onClick={() => removeTool(tool.id)}><X size={13} /></button>
              </header>
              {!tool.collapsed && <div className="mac-tool-body"><View /></div>}
            </section>
          )
        })}
        {!tools.length && <p className="mac-tool-empty">No tools in the dock. Use Add tool to put the calendar, tasks or notes here.</p>}
      </div>
    </aside>
  )
}
