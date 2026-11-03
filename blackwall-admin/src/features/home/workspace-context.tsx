import { ArrowRight, FolderKanban, Plus, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel, PanelFooter } from "@/components/common/panel"
import { ProjectStatusLabel } from "@/components/common/tags"
import { useNow } from "@/hooks/use-now"
import { toDateKey } from "@/lib/dates"
import { logHref, projectHref, projectsHref } from "@/lib/routes"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { useEffect } from "react"
import { CategoryIcon } from "@/components/common/category-icon"
import { useConnections } from "@/services/connector"
import { CONNECTION_GUIDANCE } from "@/features/settings/connection-guidance"
import { ConnectionStatusPill } from "@/features/settings/connections-page"
import { providerDef, type ProviderId } from "@shared/connections"

const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`

/** Active projects with their real repo/draft counts. */
export function ProjectsPanel() {
  const { projects, repos, drafts } = useWorkspace()
  const openForm = useUi((s) => s.openForm)
  const shown = projects.filter((p) => p.status !== "done").sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
  return (
    <Panel className="flex-1" category="projects" title="Projects" tool="projects" command="active" actions={<Button variant="quiet" size="icon-sm" aria-label="New project" onClick={() => openForm({ kind: "project" })}><Plus /></Button>} bodyClassName="flex min-h-0 flex-1 flex-col">
      {shown.length ? <ul className="grid divide-y divide-line-soft">
        {shown.map((p) => <li key={p.id}><Link to={projectHref(p.id)} className="flex min-h-14 items-center gap-2.5 px-4 py-2 hover:bg-raised">
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{p.name}</span><span className="block text-[11.5px] text-muted-foreground">{countLabel(repos.filter((r) => r.projectId === p.id).length, "repo")} · {countLabel(drafts.filter((d) => d.projectId === p.id).length, "draft")}</span></span>
          <ProjectStatusLabel status={p.status} /><ArrowUpRight className="size-3.5 shrink-0 text-faint" aria-hidden />
        </Link></li>)}
      </ul> : <p className="px-4 py-4 text-xs text-muted-foreground">Group related repositories and drafts into a project.</p>}
      <PanelFooter><Link to={projectsHref} className="bw-action-link">All projects <ArrowRight className="size-3.5" aria-hidden /></Link></PanelFooter>
    </Panel>
  )
}

/** Today's real log entry and a shortcut to write it. */
export function DailyLogPanel() {
  const journal = useWorkspace((s) => s.journal)
  const today = toDateKey(useNow())
  const entry = journal.find((j) => j.id === today)
  return (
    <Panel className="flex-1" category="journal" title="Daily log" tool="log" command={today} bodyClassName="overflow-y-auto px-4 py-3.5">
      <p className="line-clamp-4 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{entry?.text.trim() || "Keep a short record of what shipped, what you learned, and what comes next."}</p>
      <Link to={logHref(today)} className="mt-2 bw-action-link text-xs text-ink-2 hover:text-ink">{entry?.text.trim() ? "Continue today's log" : "Write today's log"}<ArrowUpRight className="size-3.5" aria-hidden /></Link>
    </Panel>
  )
}

/** What is actually linked, at a glance. Status comes from each connection's last test. */
export function LinkedServicesPanel() {
  const { available, list, refresh } = useConnections()
  useEffect(() => { refresh() }, [refresh])
  const open = (add?: ProviderId) => useUi.getState().openSettings("connections", add)
  const failing = list.filter((c) => c.status === "error").length
  return (
      <Panel
        className="flex-1"
        category="service"
        title="Linked services"
        tool="connections"
        command="ls"
        meta={available ? (failing ? <span className="text-red-text">{failing} need attention</span> : `${list.length} linked`) : undefined}
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {available === false ? (
          <p className="px-3.5 py-4 text-xs text-muted-foreground">Blackwall’s server is unavailable, so connections can’t be listed.</p>
        ) : list.length ? (
          <ul className="max-h-[14rem] divide-y divide-line-soft overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open()} className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-raised">
                  <CategoryIcon category={CONNECTION_GUIDANCE[c.provider].category} className="size-6 [&_svg]:size-3.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{c.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{[c.label !== providerDef(c.provider).name && providerDef(c.provider).name, c.account].filter(Boolean).join(" · ") || "No account details"}</span>
                  </span>
                  <ConnectionStatusPill status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2 px-3.5 py-4">
            <p className="text-xs text-muted-foreground">No services linked yet. Link GitHub, your website or analytics to fill these panels with real data.</p>
            <Button variant="outline" size="sm" onClick={() => open()}><Plus /> Link a service</Button>
          </div>
        )}
        <PanelFooter><button type="button" onClick={() => open()} className="bw-action-link">Manage connections <ArrowRight className="size-3.5" aria-hidden /></button></PanelFooter>
      </Panel>
  )
}
