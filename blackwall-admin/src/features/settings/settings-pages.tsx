import { ArrowRight, Database } from "lucide-react"
import { useState } from "react"
import { NavLink } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader, Panel } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"
import { cn } from "@/lib/utils"
import { integrations } from "@/services"
import { usePrefs } from "@/stores/prefs"
import { WORKSPACE_STORAGE_KEY, WORKSPACE_VERSION, useWorkspace } from "@/stores/workspace"

function SettingsTabs() {
  const tabs = [
    ["Appearance", "/settings/appearance"],
    ["Navigation", "/settings/navigation"],
    ["Integrations", "/settings/integrations"],
  ]
  return (
    <nav aria-label="Settings sections" className="mb-4 flex gap-1 border-b">
      {tabs.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
              isActive && "border-amber text-foreground",
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SettingRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3">
      <div className="flex-1">
        <Label htmlFor={id} className="text-sm font-bold">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

const SWATCHES: Array<[string, string, string]> = [
  ["Background", "var(--background)", "#3B3E44"],
  ["Recessed / nav", "var(--recessed)", "#303339"],
  ["Panel", "var(--card)", "#41444A"],
  ["Border", "var(--border)", "#555A63"],
  ["Text", "var(--foreground)", "#E6E8EB"],
  ["Secondary text", "var(--muted-foreground)", "#BCC2CA*"],
  ["Teal", "var(--teal)", "#86BDB9"],
  ["Amber (actions)", "var(--amber)", "#D8B477"],
  ["Red", "var(--red)", "#D78F88"],
]

export function AppearanceSettings() {
  const retro = usePrefs((s) => s.retroDetails)
  const set = usePrefs((s) => s.set)
  const resetToSeed = useWorkspace((s) => s.resetToSeed)
  const clearAll = useWorkspace((s) => s.clearAll)
  const [confirm, setConfirm] = useState<null | "reset" | "clear">(null)

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Appearance">
          <SettingRow id="retro" label="Retro details" description="Dot field and scanlines on the header and rail. Content backgrounds stay plain." checked={retro} onChange={(v) => set({ retroDetails: v })} />
          <div className="border-t px-3 py-3">
            <h3 className="eyebrow mb-2">Palette</h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SWATCHES.map(([label, v, hex]) => (
                <li key={label} className="flex items-center gap-2 text-xs">
                  <span className="size-6 shrink-0 rounded-md border" style={{ background: v }} aria-hidden />
                  <span>
                    <span className="block">{label}</span>
                    <span className="font-mono text-muted-foreground">{hex}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              * Lifted for contrast. Motion follows your system's reduced-motion setting.
            </p>
          </div>
        </Panel>
        <Panel title="Local data" icon={<Database />} badge={<SourceBadge status="local" />}>
          <div className="space-y-2 px-3 py-3 text-sm">
            <p>
              Workspace records are stored in this browser's localStorage under{" "}
              <code className="font-mono text-xs">{WORKSPACE_STORAGE_KEY}</code> (schema v{WORKSPACE_VERSION}). They don't
              sync to other devices. Interface preferences use <code className="font-mono text-xs">blackwall.prefs</code>.
            </p>
            <p className="text-muted-foreground">
              Blackwall is a local prototype without authentication. Don't store secrets or credentials here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-3">
            {confirm ? (
              <>
                <span className="text-sm text-red-text">
                  {confirm === "reset" ? "Replace all records with starter data?" : "Delete all local records?"}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm === "reset") resetToSeed()
                    else clearAll()
                    toast.success(confirm === "reset" ? "Starter data restored" : "Workspace cleared")
                    setConfirm(null)
                  }}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setConfirm("reset")}>Restore starter data</Button>
                <Button size="sm" variant="ghost" className="text-red-text" onClick={() => setConfirm("clear")}>Clear workspace</Button>
              </>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}

export function NavigationSettings() {
  const { railPinned, edgeReveal, set } = usePrefs()
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Navigation rail">
          <SettingRow id="pin" label="Pin rail" description="Keep the icon rail visible. The page reserves space for it." checked={railPinned} onChange={(v) => set({ railPinned: v })} />
          <div className="border-t" />
          <SettingRow id="edge" label="Reveal on left-edge hover" description="Hovering the far left edge shows the rail. Turn off to use only the menu button." checked={edgeReveal} onChange={(v) => set({ edgeReveal: v })} />
        </Panel>
        <Panel title="Keyboard">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-3 py-3 text-sm">
            <dt><Kbd>⌘K</Kbd> / <Kbd>/</Kbd></dt><dd className="text-muted-foreground">Search workspace</dd>
            <dt><Kbd>Tab</Kbd> to menu, <Kbd>Enter</Kbd></dt><dd className="text-muted-foreground">Open the rail and focus the current section</dd>
            <dt><Kbd>↑</Kbd> <Kbd>↓</Kbd></dt><dd className="text-muted-foreground">Move between rail destinations</dd>
            <dt><Kbd>→</Kbd> / <Kbd>←</Kbd></dt><dd className="text-muted-foreground">Enter / leave a submenu</dd>
            <dt><Kbd>Esc</Kbd></dt><dd className="text-muted-foreground">Close the rail or flyout</dd>
            <dt><Kbd>⌘S</Kbd></dt><dd className="text-muted-foreground">Save in draft and note editors</dd>
          </dl>
        </Panel>
      </div>
    </>
  )
}

export function IntegrationSettings() {
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <p className="mb-3 max-w-prose text-sm text-muted-foreground">
        Nothing external is connected. Each integration sits behind a typed service interface in{" "}
        <code className="font-mono text-xs">src/services</code>. Real adapters need a server-side boundary to hold
        credentials; tokens must never go in browser code or localStorage.
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {integrations.map((i) => (
          <li key={i.id} className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <h2 className="text-sm font-bold">{i.name}</h2>
              <SourceBadge status={i.status} />
              <code className="ml-auto font-mono text-xs text-muted-foreground">{i.contract}</code>
            </div>
            <div className="space-y-2 px-3 py-3 text-sm">
              <p><span className="text-muted-foreground">Feeds: </span>{i.serves}</p>
              <p><span className="text-muted-foreground">Now: </span>{i.current}</p>
              <div>
                <p className="text-muted-foreground">Needed next:</p>
                <ol className="mt-1 space-y-1">
                  {i.next.map((n) => (
                    <li key={n} className="flex gap-2">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden />
                      {n}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
