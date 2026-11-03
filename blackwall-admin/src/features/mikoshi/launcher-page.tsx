import { ArrowUpRight, Check, LayoutGrid, List, Pencil, Plus, Search, Server } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StatStrip } from "@/components/common/stat-strip"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import type { Service } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { ServiceLogo } from "./service-icons"
import { useServiceStatus, type ServiceStatus } from "./use-service-status"
import { usePrefs } from "@/stores/prefs"
import { shortAgo } from "@/lib/dates"

/** ":9443" when the address has a port, else its path or host: enough to tell tiles apart. */
export function addressLabel(url: string) {
  try {
    const u = new URL(url)
    if (u.port) return `:${u.port}${u.pathname !== "/" ? u.pathname : ""}`
    return u.pathname !== "/" ? u.pathname : u.hostname
  } catch {
    return url
  }
}

const GROUP_ORDER = ["Infrastructure", "Apps", "AI", "Media"]
const byGroup = (a: string, b: string) => {
  const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
}

/** Green when it answered, red when it didn't, grey until the first check. Hover for details. */
function StatusDot({ status, className }: { status?: ServiceStatus; className?: string }) {
  const label = !status ? "Not checked yet" : status.up ? `Up · ${status.ms} ms${status.status ? ` · HTTP ${status.status}` : ""}` : `Down · ${status.error ?? `HTTP ${status.status}`}`
  return (
    <span role="img" aria-label={label} title={`${label} (checked from the Blackwall server)`} className={cn("inline-block size-2 shrink-0 rounded-full", !status ? "bg-faint/50" : status.up ? "bg-green" : "bg-red-light", className)} />
  )
}

/** Opens the service; in edit mode the same tile opens its form instead. */
function TileShell({ service, editing, className, children }: { service: Service; editing: boolean; className: string; children: ReactNode }) {
  const openForm = useUi((s) => s.openForm)
  if (editing) {
    return (
      <button type="button" onClick={() => openForm({ kind: "service", id: service.id })} className={cn(className, "text-left ring-1 ring-transparent hover:ring-[var(--bw-category)]")} aria-label={`Edit ${service.name}`}>
        {children}
        <Pencil className="absolute top-2.5 right-2.5 size-3.5 text-muted-foreground" aria-hidden />
      </button>
    )
  }
  return (
    <a href={service.url} target="_blank" rel="noreferrer" className={className} title={`Open ${service.name} (${service.url})`}>
      {children}
    </a>
  )
}

function PinnedTile({ service, editing, status }: { service: Service; editing: boolean; status?: ServiceStatus }) {
  return (
    <TileShell service={service} editing={editing} className="bw-panel group relative flex flex-col items-center gap-2.5 px-3 pt-5 pb-4 transition-colors hover:bg-raised">
      {!editing && <StatusDot status={status} className="absolute top-3 right-3" />}
      <ServiceLogo service={service} size={52} />
      <span className="max-w-full truncate text-sm font-semibold text-ink">{service.name}</span>
      {service.description && <span className="-mt-2 max-w-full truncate text-[11.5px] text-muted-foreground">{service.description}</span>}
    </TileShell>
  )
}

/** Grid view: logo and name only, the status dot in the corner (Homarr-style). */
function GridTile({ service, editing, status }: { service: Service; editing: boolean; status?: ServiceStatus }) {
  return (
    <TileShell service={service} editing={editing} className="group relative flex w-[7.5rem] min-w-0 flex-col items-center gap-2 rounded-xl bg-raised px-2 pt-4 pb-3 transition-colors hover:bg-selected">
      {!editing && <StatusDot status={status} className="absolute top-2.5 right-2.5" />}
      <ServiceLogo service={service} size={40} />
      <span className="max-w-full truncate text-[12.5px] font-medium text-ink">{service.name}</span>
    </TileShell>
  )
}

function ServiceTile({ service, editing, status }: { service: Service; editing: boolean; status?: ServiceStatus }) {
  return (
    <TileShell service={service} editing={editing} className="group relative flex w-64 max-w-full min-w-0 items-center gap-3 rounded-xl bg-raised px-3.5 py-3 transition-colors hover:bg-selected" >
      <ServiceLogo service={service} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{service.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {service.description}
          {service.description && " · "}
          <span className="font-mono text-faint">{addressLabel(service.url)}</span>
        </span>
      </span>
      {!editing && <StatusDot status={status} />}
      {!editing && <ArrowUpRight className="size-3.5 shrink-0 text-faint group-hover:text-ink-2" aria-hidden />}
    </TileShell>
  )
}

export function LauncherPage() {
  const services = useWorkspace((s) => s.services)
  const openForm = useUi((s) => s.openForm)
  const [group, setGroup] = useState("all")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState(false)
  const view = usePrefs((s) => s.launcherView)
  const setPrefs = usePrefs((s) => s.set)
  const status = useServiceStatus(services)
  const add = () => openForm({ kind: "service" })

  const groups = [...new Set(services.map((s) => s.group || "Services"))].sort(byGroup)
  const effective = group !== "all" && !groups.includes(group) ? "all" : group
  const query = q.trim().toLowerCase()
  const shown = services
    .filter((s) => effective === "all" || (s.group || "Services") === effective)
    .filter((s) => !query || `${s.name} ${s.description} ${s.url} ${s.group}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
  const pinned = shown.filter((s) => s.pinned)
  const sections = groups.map((g) => ({ g, items: shown.filter((s) => (s.group || "Services") === g) })).filter((x) => x.items.length)

  return (
    <>
      <PageHeader
        title="Mikoshi"
        actions={
          services.length ? (
            <>
              <Button variant="ghost" aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? <><Check /> Done</> : <><Pencil /> Edit</>}</Button>
              <Button onClick={add}><Plus /> Add service</Button>
            </>
          ) : undefined
        }
      />
      {!services.length ? (
        <WorkspaceGrid><GridItem span={2}><Panel category="mikoshi" title="Launcher">
          <EmptyState roomy icon={Server} title="Put your services one click away" action={<Button onClick={add}><Plus /> Add a service</Button>}>
            Add Portainer, Cockpit, Nextcloud and the rest. Pick a known app to get its logo, then paste its address.
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      ) : (
        <WorkspaceGrid>
          <GridItem span="full">
            <StatStrip
              items={[
                { label: "Services", value: services.length },
                { label: "Up", value: status.ready ? <span className="text-green">{status.up}</span> : <span className="text-faint">—</span>, sub: status.error ? "Couldn't check" : status.checkedAt ? `checked ${shortAgo(status.checkedAt)} ago` : "checking…" },
                { label: "Down", value: status.ready ? status.down : <span className="text-faint">—</span>, tone: status.down ? "error" : undefined, sub: status.down ? services.filter((s) => status.get(s.url)?.up === false).map((s) => s.name).slice(0, 2).join(", ") : undefined },
                { label: "Avg response", value: status.avgMs != null ? `${status.avgMs} ms` : <span className="text-faint">—</span>, sub: "from the Blackwall server" },
              ]}
            />
          </GridItem>
          <GridItem span="full">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedTabs
                label="Show group"
                className="max-w-full overflow-x-auto [scrollbar-width:none]"
                tabClassName="flex-none px-2.5 sm:px-3"
                value={effective}
                onChange={setGroup}
                tabs={[{ value: "all", label: "All", count: services.length }, ...groups.map((g) => ({ value: g, label: g, count: services.filter((s) => (s.group || "Services") === g).length }))]}
              />
              <div role="radiogroup" aria-label="View" className="ml-auto flex gap-0.5 rounded-[8px] border border-line-soft bg-well p-0.5">
                {([["rows", List, "Rows"], ["grid", LayoutGrid, "Grid"]] as const).map(([v, Icon, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={view === v} aria-label={label} title={label} onClick={() => setPrefs({ launcherView: v })}
                    className={cn("flex size-7 items-center justify-center rounded-[6px]", view === v ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}>
                    <Icon className="size-3.5" aria-hidden />
                  </button>
                ))}
              </div>
              <label className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services" aria-label="Search services" className="h-8 w-full rounded-[var(--bw-control-radius)] border border-rim bg-well pr-2 pl-8 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-faint md:text-[13px]" />
              </label>
            </div>
            {editing && <p className="mt-2 text-xs text-muted-foreground">Editing: click a tile to change it. Pin tiles to put them in the top row.</p>}
          </GridItem>
          {pinned.length > 0 && (
            <GridItem span="full">
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-[var(--bw-grid-gap)]" aria-label="Pinned">
                {pinned.map((s) => <li key={s.id} className="flex [&>*]:flex-1"><PinnedTile service={s} editing={editing} status={status.get(s.url)} /></li>)}
              </ul>
            </GridItem>
          )}
          {sections.length > 0 && (
            <GridItem span="full">
              {/* Each group card is only as wide as its tiles; groups flow side by side and wrap. */}
              <div className="flex flex-wrap items-start gap-[var(--bw-grid-gap)]">
                {sections.map(({ g, items }) => (
                  <Panel key={g} category="mikoshi" title={g} className="w-fit max-w-full" bodyClassName="flex flex-wrap gap-2.5 p-3.5">
                    {items.map((s) => view === "grid"
                      ? <GridTile key={s.id} service={s} editing={editing} status={status.get(s.url)} />
                      : <ServiceTile key={s.id} service={s} editing={editing} status={status.get(s.url)} />)}
                  </Panel>
                ))}
              </div>
            </GridItem>
          )}
          {!sections.length && (
            <GridItem span="full"><Panel category="mikoshi" title="No matches"><EmptyState icon={Search} title="No services match" /></Panel></GridItem>
          )}
        </WorkspaceGrid>
      )}
    </>
  )
}
