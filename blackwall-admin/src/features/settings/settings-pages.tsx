import { useState, type ReactNode } from "react"
import { Keyboard, Palette, Plug, Server, SlidersHorizontal } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SubNav } from "@/components/common/sub-nav"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"

export const SETTINGS_SECTIONS = [
  { label: "General", to: "/settings/general", icon: SlidersHorizontal, blurb: "Version and updates, plus the data saved in this browser." },
  { label: "Appearance", to: "/settings/appearance", icon: Palette, blurb: "How Blackwall looks and behaves in this browser." },
  { label: "Connections", to: "/settings/connections", icon: Plug, blurb: "Accounts Blackwall reads from. Tokens and passwords are stored encrypted on the server and never sent back to the browser." },
  { label: "Server & backups", to: "/settings/server", icon: Server, blurb: "Where server-side data lives, your session, and whether backups are running." },
  { label: "Shortcuts", to: "/settings/shortcuts", icon: Keyboard, blurb: "Keys that work anywhere in Blackwall." },
] as const

/**
 * Settings frame (spec §7): page header, the section sub-nav on the left (a select on
 * phones), then the section's heading and a single readable column of panels.
 */
export function SettingsPage({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const { pathname } = useLocation()
  const section = SETTINGS_SECTIONS.find((s) => pathname.startsWith(s.to)) ?? SETTINGS_SECTIONS[0]
  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences for this browser, your connections and the home server." />
      <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-4">
        <SubNav items={SETTINGS_SECTIONS} label="Settings sections" className="lg:sticky lg:top-[92px]" />
        <div className="grid max-w-3xl min-w-0 content-start gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-1">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-bold">{section.label}</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{section.blurb}</p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
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
  inline,
}: {
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  children?: ReactNode
  className?: string
  /** Keep the control on the right even on phones (switches and other small controls). */
  inline?: boolean
}) {
  return (
    <div className={cn("flex gap-2 px-3.5 py-3 sm:items-center sm:gap-4", inline ? "items-center gap-4" : "flex-col sm:flex-row", className)}>
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-[13px]">{title}</Label>
        ) : (
          <div className="text-[13px] font-medium">{title}</div>
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
      <Button variant="outline" className={cn(danger && "text-red-text")} onClick={() => setAsking(true)}>
        {children}
      </Button>
    )
  }
  return (
    <>
      <Button variant="destructive" onClick={() => (onConfirm(), setAsking(false))}>{confirmLabel}</Button>
      <Button variant="quiet" onClick={() => setAsking(false)}>Cancel</Button>
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
          <Input id="ws-name" className="h-8 w-full sm:w-52" maxLength={32} placeholder="e.g. your org" value={workspaceName} onChange={(e) => set({ workspaceName: e.target.value })} />
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
        <SettingRow title="Retro details" description="Background grid and panel scanlines." htmlFor="retro" inline>
          <Switch id="retro" checked={retro} onCheckedChange={(v) => set({ retroDetails: v })} />
        </SettingRow>
        <SettingRow title="Sample data" description="Fill panels that aren't connected yet with made-up data, labelled “Sample data”, to preview the layout." htmlFor="samples" inline>
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
          <SettingRow key={does} title={does} inline>
            <span className="flex items-center gap-1">
              {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
              {or && <span className="px-1 text-xs text-muted-foreground">or</span>}
              {or?.map((k) => <Kbd key={k}>{k}</Kbd>)}
            </span>
          </SettingRow>
        ))}
      </Panel>
      <p className="px-1 text-[11px] text-muted-foreground">On a phone, the ☰ button in the header opens the full menu.</p>
    </SettingsPage>
  )
}
