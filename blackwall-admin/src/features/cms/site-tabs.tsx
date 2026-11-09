import { Link } from "react-router-dom"
import { cmsPagesHref, formsHref, postsHref, siteFilesHref, siteLookHref, siteSettingsHref, sitesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { useCurrentSite } from "./use-cms"

const TABS = [
  { id: "pages", label: "Pages", to: cmsPagesHref },
  { id: "posts", label: "Posts", to: postsHref },
  { id: "look", label: "Look", to: siteLookHref },
  { id: "forms", label: "Forms", to: formsHref },
  { id: "settings", label: "Settings", to: siteSettingsHref },
  { id: "files", label: "Get files", to: siteFilesHref },
] as const
export type SiteTab = (typeof TABS)[number]["id"]

/** The Website section's own navigation: every part of the site one tap away, with the one you're on marked. */
export function SiteTabs({ current }: { current: SiteTab }) {
  const site = useCurrentSite()
  const pages = useWorkspace((s) => s.pages.filter((p) => p.siteId === site?.id).length)
  const posts = useWorkspace((s) => s.drafts.filter((d) => d.siteId === site?.id && d.kind === "post").length)
  const counts: Partial<Record<SiteTab, number>> = { pages, posts }
  return (
    <nav aria-label="Website sections" className="flex gap-1 overflow-x-auto rounded-[8px] border border-line-soft bg-well p-0.5 [scrollbar-width:none]">
      <Link to={sitesHref} className="flex h-8 shrink-0 items-center gap-1 rounded-[6px] px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-ink" aria-label="All sites">← All sites</Link>
      <span className="my-1.5 w-px shrink-0 bg-line-soft" aria-hidden />
      {site && <span className="flex max-w-44 shrink-0 items-center truncate px-2 text-xs font-semibold text-ink" title={site.name} data-testid="current-site">{site.name}</span>}
      {TABS.map((t) => (
        <Link key={t.id} to={t.to} aria-current={t.id === current ? "page" : undefined}
          className={cn("flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-3 text-xs font-medium whitespace-nowrap transition-colors", t.id === current ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}>
          {t.label}{counts[t.id] != null && <span className="text-[10.5px] text-faint tabular-nums">{counts[t.id]}</span>}
        </Link>
      ))}
    </nav>
  )
}
