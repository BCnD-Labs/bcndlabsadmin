import { Search, SearchX } from "lucide-react"
import { useState, type ComponentType } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useUi, type SettingsSection } from "@/stores/ui"
import { ConnectionsPage } from "./connections-page"
import { GeneralSettings } from "./general-page"
import { ServerSettings } from "./server-page"
import { AppearanceSettings, SETTINGS_SECTIONS, SectionContext, SettingsQuery, ShortcutsSettings } from "./settings-pages"

const BODY: Record<SettingsSection, ComponentType> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  connections: ConnectionsPage,
  server: ServerSettings,
  shortcuts: ShortcutsSettings,
}

/**
 * Settings as a modal (like a desktop app's preferences window): sections on the
 * left with a search box, the section's panels on the right. Searching shows the
 * matching rows from every section at once. Phones get the search and a section
 * menu above the content.
 */
export function SettingsModal() {
  const settings = useUi((s) => s.settings)
  const openSettings = useUi((s) => s.openSettings)
  const close = useUi((s) => s.closeSettings)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const current = settings?.section ?? "general"

  const go = (id: SettingsSection) => {
    setQuery("")
    openSettings(id)
  }

  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
      <Input
        id="settings-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search settings…"
        aria-label="Search settings"
        className="h-8 pl-8"
      />
    </div>
  )

  return (
    <Dialog
      open={!!settings}
      onOpenChange={(o) => {
        if (!o) {
          close()
          setQuery("")
        }
      }}
    >
      <DialogContent
        className="flex h-[min(760px,calc(100dvh-2rem))] w-[calc(100%-1.5rem)] max-w-[1040px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px] md:flex-row"
        onOpenAutoFocus={(e) => {
          // Land on the search box on desktop; on phones, don't pop the keyboard.
          if (!window.matchMedia("(min-width: 768px)").matches) e.preventDefault()
        }}
      >
        <aside className="flex shrink-0 flex-col gap-3 border-b border-line bg-panel p-3 pr-12 md:w-[232px] md:border-r md:border-b-0 md:pr-3">
          <div className="px-1 pt-0.5">
            <DialogTitle className="font-heading text-base font-bold">Settings</DialogTitle>
            <DialogDescription className="sr-only">Preferences for this browser, your connections and the home server.</DialogDescription>
          </div>
          {search}
          <div className="md:hidden">
            <Select value={current} onValueChange={(v) => go(v as SettingsSection)}>
              <SelectTrigger aria-label="Settings section" className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <SelectItem key={id} value={id}>
                    <Icon className="size-4 text-faint" strokeWidth={1.8} aria-hidden />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav aria-label="Settings sections" className="hidden md:block">
            <p className="bw-label mb-1.5 px-1">Options</p>
            <ul className="flex flex-col gap-0.5">
              {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
                const on = id === current && !q
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => go(id)}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-[7px] border-r-2 border-b-2 border-transparent px-2.5 text-left font-mono text-xs text-muted-foreground transition-colors duration-150 hover:bg-raised hover:text-ink",
                        on && "border-ledge-hi bg-selected text-ink hover:bg-selected",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", on ? "text-red" : "text-faint")} strokeWidth={1.8} aria-hidden />
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5" data-searching={q ? "" : undefined}>
          <SettingsQuery.Provider value={q}>
            {q ? (
              <div className="grid gap-8">
                {SETTINGS_SECTIONS.map(({ id }) => {
                  const Body = BODY[id]
                  return (
                    <SectionContext.Provider key={id} value={id}>
                      <Body />
                    </SectionContext.Provider>
                  )
                })}
                <div className="settings-no-match">
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <SearchX className="size-5 text-faint" strokeWidth={1.6} aria-hidden />
                    <p className="text-sm text-ink-2">No settings match “{query.trim()}”</p>
                  </div>
                </div>
              </div>
            ) : (
              <SectionContext.Provider value={current}>
                {(() => {
                  const Body = BODY[current]
                  return <Body key={current} />
                })()}
              </SectionContext.Provider>
            )}
          </SettingsQuery.Provider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
