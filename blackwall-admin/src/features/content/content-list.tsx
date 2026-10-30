import { Plus } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState, PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { DraftStatusTag, ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { draftHref } from "@/lib/routes"
import type { DraftKind } from "@/lib/types"
import { useProjectMap, useWorkspace } from "@/stores/workspace"
import { useCreateDraft } from "./use-create-draft"

/** `all`: every page & post. `drafts`: only work in progress (not yet marked ready). */
export function ContentList({ mode }: { mode: "all" | "drafts" }) {
  const drafts = useWorkspace((s) => s.drafts)
  const projects = useProjectMap()
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  const [kind, setKind] = useState<DraftKind | "any">("any")

  const rows = drafts
    .filter((d) => (mode === "drafts" ? d.status !== "ready" : true))
    .filter((d) => (kind === "any" ? true : d.kind === kind))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader
        title={mode === "all" ? "Pages & posts" : "Drafts"}
        badge={<SourceBadge status="local" />}
        description="Local drafts. Publishing to the website is not connected in this phase."
        actions={
          <Button onClick={() => navigate(draftHref(createDraft(kind === "page" ? { kind: "page" } : undefined).id))}>
            <Plus /> New draft
          </Button>
        }
      />
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as DraftKind | "any")} aria-label="Content type">
            <ToggleGroupItem value="any" className="px-2 text-xs data-[state=on]:text-amber">All</ToggleGroupItem>
            <ToggleGroupItem value="post" className="px-2 text-xs data-[state=on]:text-amber">Posts</ToggleGroupItem>
            <ToggleGroupItem value="page" className="px-2 text-xs data-[state=on]:text-amber">Pages</ToggleGroupItem>
          </ToggleGroup>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} items</span>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="eyebrow border-b text-left">
                  <th className="px-3 py-2 font-normal">Title</th>
                  <th className="px-3 py-2 font-normal">Type</th>
                  <th className="px-3 py-2 font-normal">Status</th>
                  <th className="px-3 py-2 font-normal">Project</th>
                  <th className="px-3 py-2 text-right font-normal">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link to={draftHref(d.id)} className="font-bold hover:underline">{d.title}</Link>
                      <div className="font-mono text-xs text-muted-foreground">/{d.kind === "post" ? "writing/" : ""}{d.slug}</div>
                    </td>
                    <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{d.kind}</td>
                    <td className="px-3 py-2"><DraftStatusTag status={d.status} /></td>
                    <td className="px-3 py-2"><ProjectTag project={d.projectId ? projects.get(d.projectId) : undefined} /></td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{timeAgo(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No content here yet.</EmptyState>
        )}
      </div>
    </>
  )
}
