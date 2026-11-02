import { Activity } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"

/** Mikoshi → Status: Uptime Kuma's monitors, once that connection exists. */
export function MikoshiStatusPage() {
  return (
    <>
      <PageHeader title="Mikoshi" />
      <WorkspaceGrid><GridItem span={2}><Panel category="mikoshi" title="Status">
        <EmptyState roomy icon={Activity} title="Uptime Kuma comes next">
          Your monitors from Uptime Kuma will show here, and their up or down state will light the dots on the launcher tiles.
        </EmptyState>
      </Panel></GridItem></WorkspaceGrid>
    </>
  )
}
