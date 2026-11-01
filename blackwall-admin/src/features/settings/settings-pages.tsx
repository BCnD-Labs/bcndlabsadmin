import { useState, type ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"

export const SETTINGS_TABS = [
  { label: "General", to: "/settings/general" },
  { label: "Appearance", to: "/settings/appearance" },
  { label: "Connections", to: "/settings/connections" },
  { label: "Server & backups", to: "/settings/server" },
  { label: "Shortcuts", to: "/settings/shortcuts" },
] as const

/** Section tabs plus the page's actions, on one line under the app header (which says "Settings"). */
export function SettingsHeader({ actions }: { actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-line">
      <nav aria-label="Settings sections" className="-mb-px flex min-w-0 gap-1 overflow-x-auto">
        {SETTINGS_TABS.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "shrink-0 border-b-2 border-transparent px-3 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                isActive && "border-[var(--bw-red)] text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {actions && <div className="mb-1.5 ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Settings page frame: header, then a single readable column of panels. */
export function SettingsPage({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <SettingsHeader actions={actions} />
      <div className="grid max-w-3xl gap-3">{children}</div>
    </>
  )
}

/** One setting: name and description on the left, its control on the right (stacked on phones). */
export function SettingRow({
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4", className)}>
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm">{title}</Label>
        ) : (
          <div className="text-sm font-medium">{title}</div>
        )}
        {description && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** A button that asks "Sure?" inline before doing something you can't undo. */
export function ConfirmButton({ children, confirmLabel, onConfirm, danger }: { children: ReactNode; confirmLabel: string; onConfirm: () => void; danger?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button size="sm" variant="outline" className={cn(danger && "text-red-text")} onClick={() => setAsking(true)}>
        {children}
      </Button>
    )
  }
  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => (onConfirm(), setAsking(false))}>{confirmLabel}</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
    </>
  )
}

export function AppearanceSettings() {
  const retro = usePrefs((s) => s.retroDetails)
  const samples = usePrefs((s) => s.showSamples)
  const workspaceName = usePrefs((s) => s.workspaceName)
  const autoHide = usePrefs((s) => s.autoHideSeconds)
  const set = usePrefs((s) => s.set)

  return (
    <SettingsPage>
      <Panel tool="appearance" command="edit" meta="this browser" bodyClassName="divide-y divide-line">
        <SettingRow title="Workspace name" description="Shown in the Home greeting and as initials at the bottom of the sidebar." htmlFor="ws-name">
          <Input id="ws-name" className="w-48" maxLength={32} placeholder="e.g. your org" value={workspaceName} onChange={(e) => set({ workspaceName: e.target.value })} />
        </SettingRow>
        <SettingRow title="Auto-hide cards" description="How long the calendar and notification cards stay open after you move away." htmlFor="auto-hide">
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
        </SettingRow>
        <SettingRow title="Retro details" description="Background grid and panel scanlines." htmlFor="retro">
          <Switch id="retro" checked={retro} onCheckedChange={(v) => set({ retroDetails: v })} />
        </SettingRow>
        <SettingRow title="Sample data" description="Fill panels that aren't connected yet with made-up data, labelled “Sample data”, to preview the layout." htmlFor="samples">
          <Switch id="samples" checked={samples} onCheckedChange={(v) => set({ showSamples: v })} />
        </SettingRow>
      </Panel>
    </SettingsPage>
  )
}

/** Each entry: the keys (pressed together), an optional alternative, and what it does. */
const SHORTCUTS: Array<{ keys: string[]; or?: string[]; does: string }> = [
  { keys: ["⌘K"], or: ["/"], does: "Search everything" },
  { keys: ["Tab"], does: "Move from the header into the sidebar" },
  { keys: ["↑", "↓"], does: "Move between sidebar items" },
  { keys: ["→", "←"], does: "Into and out of an item's pages" },
  { keys: ["Esc"], does: "Close the open item or card" },
  { keys: ["⌘", "Enter"], does: "Add a note from the Notes composer" },
]

export function ShortcutsSettings() {
  return (
    <SettingsPage>
      <Panel tool="keyboard" command="shortcuts" bodyClassName="divide-y divide-line">
        {SHORTCUTS.map(({ keys, or, does }) => (
          <SettingRow key={does} title={does}>
            <span className="flex items-center gap-1">
              {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
              {or && <span className="px-1 text-xs text-muted-foreground">or</span>}
              {or?.map((k) => <Kbd key={k}>{k}</Kbd>)}
            </span>
          </SettingRow>
        ))}
      </Panel>
      <p className="px-1 text-xs text-muted-foreground">On a phone, the ☰ button in the header opens the full menu.</p>
    </SettingsPage>
  )
}
