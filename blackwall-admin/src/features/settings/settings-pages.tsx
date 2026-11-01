import { NavLink } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader, Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"

export function SettingsTabs() {
  const tabs = [
    ["General", "/settings/general"],
    ["Appearance", "/settings/appearance"],
    ["Navigation", "/settings/navigation"],
    ["Connections", "/settings/connections"],
    ["Server", "/settings/server"],
  ]
  return (
    <nav aria-label="Settings sections" className="mb-4 flex gap-1 overflow-x-auto border-b-2 border-edge">
      {tabs.map(([label, to]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "-mb-0.5 shrink-0 border-b-2 border-transparent px-3 py-2 font-heading text-sm font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase hover:text-teal",
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
  ["Ground", "var(--bw-ground)", "#0A0D13"],
  ["Panel", "var(--bw-panel)", "#161719"],
  ["Raised", "var(--bw-raised)", "#1C1D20"],
  ["Well", "var(--bw-well)", "#0F1012"],
  ["Ledge", "var(--bw-ledge)", "#2A2C30"],
  ["Text", "var(--bw-text)", "#EDEFF2"],
  ["Muted text", "var(--bw-muted)", "#9499A3"],
  ["Red (accent)", "var(--bw-red)", "#BC1515"],
  ["Amber", "var(--bw-amber)", "#E0A526"],
]

export function AppearanceSettings() {
  const retro = usePrefs((s) => s.retroDetails)
  const samples = usePrefs((s) => s.showSamples)
  const workspaceName = usePrefs((s) => s.workspaceName)
  const autoHide = usePrefs((s) => s.autoHideSeconds)
  const set = usePrefs((s) => s.set)
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Appearance">
          <div className="flex flex-wrap items-center gap-3 px-3 py-3">
            <div className="flex-1">
              <Label htmlFor="ws-name" className="text-sm font-bold">Workspace name</Label>
              <p className="text-sm text-muted-foreground">Used in the Home greeting and for the initials at the bottom of the rail.</p>
            </div>
            <Input id="ws-name" className="w-48" maxLength={32} placeholder="e.g. your org" value={workspaceName} onChange={(e) => set({ workspaceName: e.target.value })} />
          </div>
          <div className="border-t" />
          <div className="flex flex-wrap items-center gap-3 px-3 py-3">
            <div className="flex-1">
              <Label htmlFor="auto-hide" className="text-sm font-bold">Auto-hide cards</Label>
              <p className="text-sm text-muted-foreground">How long the calendar and notification cards stay open after the pointer leaves them.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="auto-hide"
                type="range"
                min={2}
                max={15}
                step={1}
                value={autoHide}
                onChange={(e) => set({ autoHideSeconds: Number(e.target.value) })}
                aria-valuetext={`${autoHide} seconds`}
                className="w-32 accent-[var(--bw-red)]"
              />
              <output htmlFor="auto-hide" className="w-8 text-right font-mono text-xs text-ink-2 tabular-nums">{autoHide}s</output>
            </div>
          </div>
          <div className="border-t" />
          <SettingRow id="retro" label="Retro details" description="Background grid and panel scanlines." checked={retro} onChange={(v) => set({ retroDetails: v })} />
          <div className="border-t" />
          <SettingRow
            id="samples"
            label="Show sample data"
            description="Fill panels that aren't connected yet (traffic, development) with made-up data, labelled “Sample data”. Useful for previewing the layout."
            checked={samples}
            onChange={(v) => set({ showSamples: v })}
          />
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
          </div>
        </Panel>
      </div>
    </>
  )
}

export function NavigationSettings() {
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Sidebar">
          <div className="space-y-2 px-3 py-3 text-sm">
            <p>The icon strip on the left is always there. Hover an icon (or Tab to it) and just that item opens into its label and pages; click to go.</p>
            <p className="text-muted-foreground">On a phone, use the ☰ button for the full menu.</p>
          </div>
        </Panel>
        <Panel title="Keyboard">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-3 py-3 text-sm">
            <dt><Kbd>⌘K</Kbd> / <Kbd>/</Kbd></dt><dd className="text-muted-foreground">Search everything</dd>
            <dt><Kbd>Tab</Kbd></dt><dd className="text-muted-foreground">Into the sidebar after the header</dd>
            <dt><Kbd>↑</Kbd> <Kbd>↓</Kbd></dt><dd className="text-muted-foreground">Move between sidebar items</dd>
            <dt><Kbd>→</Kbd> / <Kbd>←</Kbd></dt><dd className="text-muted-foreground">Into / out of an item's pages</dd>
            <dt><Kbd>Esc</Kbd></dt><dd className="text-muted-foreground">Close the open item</dd>
            <dt><Kbd>⌘</Kbd> + <Kbd>Enter</Kbd></dt><dd className="text-muted-foreground">Add a note from the Notes composer</dd>
          </dl>
        </Panel>
      </div>
    </>
  )
}
