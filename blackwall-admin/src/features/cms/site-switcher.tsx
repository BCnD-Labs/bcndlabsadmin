import { Check, ChevronDown, Globe, LayoutGrid, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { sitesHref } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { selectSite, useCurrentSite } from "./use-cms"

/** Which site the Website section shows, next to the page title; "New site…" at the bottom. */
export function SiteSwitcher() {
  const sites = useWorkspace((s) => s.sites)
  const current = useCurrentSite()
  const openForm = useUi((s) => s.openForm)
  const navigate = useNavigate()
  if (!sites.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-semibold" aria-label={`Site: ${current?.name}`}>
          <Globe className="size-3.5 text-[var(--bw-category)]" data-category="website" aria-hidden /> {current?.domain || current?.name} <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="bw-label">Sites</DropdownMenuLabel>
        {sites.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => selectSite(s.id)} className="gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] text-ink">{s.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{s.domain || "No domain yet"}</span>
            </span>
            {s.id === current?.id && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(sitesHref)}><LayoutGrid /> All sites</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "site" })}><Plus /> New site…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
