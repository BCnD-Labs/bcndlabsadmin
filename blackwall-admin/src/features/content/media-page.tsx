import { ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { useUi } from "@/stores/ui"

export function MediaPage() {
  return (
    <>
      <PageHeader title="Media" subtitle="Images and files for your content." />
      <Panel tool="media" command="ls" className="max-w-3xl">
        <EmptyState
          icon={ImageOff}
          title="No media library yet"
          action={<Button variant="outline" onClick={() => useUi.getState().openSettings("connections")}>Open Connections</Button>}
        >
          Blackwall doesn't store images or files yet. If your media lives with a CDN or a host, you can keep its details in Connections.
        </EmptyState>
      </Panel>
    </>
  )
}
