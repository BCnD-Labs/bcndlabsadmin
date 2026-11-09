import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react"
import { projectDrop, type TreeRow } from "@shared/sitebuilder-tree"
import { cn } from "@/lib/utils"

const INDENT = 16

function Row<R extends TreeRow>({ row, depth, selected, invalid, children, onKey }: { row: R; depth: number; selected?: boolean; invalid?: boolean; children: ReactNode; onKey?: (e: KeyboardEvent<HTMLLIElement>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={!!selected}
      data-tree-row={row.id}
      onKeyDown={onKey}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition, paddingLeft: 4 + depth * INDENT, zIndex: isDragging ? 10 : undefined }}
      className={cn("group relative flex min-h-7 min-w-0 items-center gap-1 rounded-[6px] pr-1 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-selected" : "hover:bg-raised", isDragging && "bg-raised shadow-md ring-1 ring-line", isDragging && invalid && "opacity-50")}
    >
      {children}
    </li>
  )
}

/**
 * A list you can rearrange by dragging: up and down to reorder, right to nest under the row above, left to come out again.
 * `canDrop` says what may go where. Rows are flat; the caller builds them from its own tree.
 */
export function SortableTree<R extends TreeRow>({ rows, label, canDrop, onMove, onDragging, selectedId, onRowKey, render }: {
  rows: R[]
  label: string
  canDrop: (active: R, parent: R | null) => boolean
  onMove: (id: string, parentId: string | null, beforeId: string | null) => void
  onDragging?: (on: boolean) => void
  selectedId?: string | null
  onRowKey?: (row: R, e: KeyboardEvent<HTMLLIElement>) => void
  render: (row: R) => ReactNode
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeId, setActive] = useState<string | null>(null)
  const [overId, setOver] = useState<string | null>(null)
  const [offsetX, setOffset] = useState(0)

  // While a row is in the air, whatever is nested inside it travels with it and leaves the list.
  const visible = useMemo(() => {
    if (!activeId) return rows
    const from = rows.findIndex((r) => r.id === activeId)
    if (from < 0) return rows
    let end = from + 1
    while (end < rows.length && rows[end].depth > rows[from].depth) end++
    return [...rows.slice(0, from + 1), ...rows.slice(end)]
  }, [rows, activeId])
  const drop = activeId && overId ? projectDrop(visible, activeId, overId, offsetX, INDENT, canDrop) : null

  const reset = () => { setActive(null); setOver(null); setOffset(0); onDragging?.(false) }
  const onEnd = (e: DragEndEvent) => {
    const active = visible.find((r) => r.id === e.active.id)
    const placed = e.over ? projectDrop(visible, String(e.active.id), String(e.over.id), e.delta.x, INDENT, canDrop) : null
    reset()
    if (!active || !placed) return
    if (e.active.id === e.over?.id && placed.parentId === active.parentId) return
    onMove(active.id, placed.parentId, placed.beforeId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => { setActive(String(e.active.id)); setOver(String(e.active.id)); onDragging?.(true) }}
      onDragMove={(e: DragMoveEvent) => setOffset(e.delta.x)}
      onDragOver={(e: DragOverEvent) => setOver(e.over ? String(e.over.id) : null)}
      onDragEnd={onEnd}
      onDragCancel={reset}
    >
      <SortableContext items={visible.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul role="tree" aria-label={label} className="grid min-w-0 gap-px">
          {visible.map((row) => (
            <Row key={row.id} row={row} depth={row.id === activeId && drop ? drop.depth : row.depth} selected={selectedId === row.id} invalid={row.id === activeId && !drop} onKey={onRowKey ? (e) => onRowKey(row, e) : undefined}>
              {render(row)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
