import { FileText, Plus } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { DataTable, Toolbar } from "@/components/common/list"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { DraftStatusTag, ProjectTag } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { draftHref } from "@/lib/routes"
import type { Draft, DraftKind } from "@/lib/types"
import { useProjectMap, useWorkspace } from "@/stores/workspace"
import { useCreateDraft } from "./use-create-draft"

/** `all`: every page & post. `drafts`: only work in progress (not yet marked ready). */
export function ContentList({ mode }: { mode: "all" | "drafts" }) {
  const drafts = useWorkspace((s) => s.drafts)
  const projects = useProjectMap()
  const createDraft = useCreateDraft()
  const navigate = useNavigate()
  const [kind, setKind] = useState<DraftKind | "any">("any")

  const inMode = drafts.filter((d) => (mode === "drafts" ? d.status !== "ready" : true))
  const rows = inMode.filter((d) => (kind === "any" ? true : d.kind === kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const count = (k: DraftKind) => inMode.filter((d) => d.kind === k).length
  const newDraft = () => navigate(draftHref(createDraft(kind === "page" ? { kind: "page" } : undefined).id))

  return (
    <>
      <PageHeader
        title={mode === "all" ? "Pages & posts" : "Drafts"}
        subtitle={
          mode === "all"
            ? "Everything you've written for your site. Saved in this browser; publishing isn't set up yet."
            : "Work in progress: anything not marked Ready. Saved in this browser."
        }
        actions={<Button size="lg" onClick={newDraft}><Plus /> New draft</Button>}
      />
      <Panel tool="content" command={mode === "all" ? "ls" : "ls --drafts"} meta={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}>
        <Toolbar>
          <SegmentedTabs
            label="Content type"
            value={kind}
            onChange={setKind}
            className="w-full sm:w-72"
            tabs={[
              { value: "any", label: "All", count: inMode.length },
              { value: "post", label: "Posts", count: count("post") },
              { value: "page", label: "Pages", count: count("page") },
            ]}
          />
        </Toolbar>
        {rows.length ? (
          <DataTable<Draft>
            label={mode === "all" ? "Pages and posts" : "Drafts"}
            rows={rows}
            rowKey={(d) => d.id}
            columns={[
              {
                key: "title",
                header: "Title",
                cell: (d) => (
                  <>
                    <Link to={draftHref(d.id)} className="text-[13px] text-ink hover:underline">{d.title}</Link>
                    <div className="mt-0.5 font-mono text-[11px] break-all text-muted-foreground">/{d.kind === "post" ? "writing/" : ""}{d.slug}</div>
                  </>
                ),
              },
              { key: "type", header: "Type", optional: true, cell: (d) => <span className="text-muted-foreground capitalize">{d.kind}</span> },
              { key: "status", header: "Status", cell: (d) => <DraftStatusTag status={d.status} /> },
              { key: "project", header: "Project", optional: true, cell: (d) => <ProjectTag project={d.projectId ? projects.get(d.projectId) : undefined} /> },
              { key: "updated", header: "Updated", optional: true, align: "right", cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(d.updatedAt)}</span> },
            ]}
          />
        ) : (
          <EmptyState icon={FileText} title={kind === "any" ? "Nothing written yet" : `No ${kind}s here`} action={<Button variant="outline" onClick={newDraft}><Plus /> New draft</Button>}>
            Drafts hold a title, excerpt and Markdown body.
          </EmptyState>
        )}
      </Panel>
    </>
  )
}
