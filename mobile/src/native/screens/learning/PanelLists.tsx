import { Card, Empty, ListRow } from "../../ui.tsx"
import type { SampleCoursework } from "../../sample.ts"
import { shortDate } from "./dates.ts"
import { activePanels, panelList, panelSubtitle, type PanelState } from "./panels.ts"

/** One card per switched-on panel, listing that type of coursework. Nothing is drawn while all are off. */
export function PanelLists({ items, on, isDone }: { items: SampleCoursework[]; on: PanelState; isDone: (w: SampleCoursework) => boolean }) {
  return (
    <>
      {activePanels(on).map((p) => {
        const list = panelList(items, p.type)
        return (
          <Card key={p.type} title={p.label}>
            {list.length === 0 ? <Empty>{`No ${p.label.toLowerCase()} in this course.`}</Empty> : null}
            {list.map((w) => (
              <ListRow key={w.id} title={w.title} subtitle={panelSubtitle(shortDate(w.due), isDone(w))} done={isDone(w)} />
            ))}
          </Card>
        )
      })}
    </>
  )
}
