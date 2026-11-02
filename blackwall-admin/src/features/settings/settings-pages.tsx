import { createContext, isValidElement, useContext, useState, type ReactNode } from "react"
import { Keyboard, Palette, Plug, Server, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import type { SettingsSection } from "@/stores/ui"

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal, blurb: "Version and updates, plus the data saved in this browser." },
  { id: "appearance", label: "Appearance", icon: Palette, blurb: "How Blackwall looks and behaves in this browser." },
  { id: "connections", label: "Connections", icon: Plug, blurb: "Accounts Blackwall reads from. Tokens and passwords are stored encrypted on the server and never sent back to the browser." },
  { id: "server", label: "Server & backups", icon: Server, blurb: "Where server-side data lives, your session, and whether backups are running." },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, blurb: "Keys that work anywhere in Blackwall." },
]

/** Which section a SettingsPage belongs to (set by the settings modal). */
export const SectionContext = createContext<SettingsSection>("general")
/** The settings search, lowercased; rows that don't match hide while it's set. */
export const SettingsQuery = createContext("")

/** Plain text of a React node, for matching rows against the settings search. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(" ")
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ""
}

/** One settings section inside the modal: its heading and description, then its panels. */
export function SettingsPage({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const id = useContext(SectionContext)
  const section = SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0]
  return (
    <div data-settings-section={id} className="grid min-w-0 content-start gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pb-1">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold tracking-tight">{section.label}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-2">{section.blurb}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
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
  keywords,
}: {
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  children?: ReactNode
  className?: string
  /** Keep the control on the right even on phones (switches and other small controls). */
  inline?: boolean
  /** Extra words the settings search should find this row by. */
  keywords?: string
}) {
  const query = useContext(SettingsQuery)
  const match = query ? `${textOf(title)} ${textOf(description)} ${keywords ?? ""}`.toLowerCase().includes(query) : undefined
  return (
    <div
      data-setting-row
      data-match={match}
      className={cn("flex gap-2 px-4 py-3 sm:items-center sm:gap-6", inline ? "items-center gap-4" : "flex-col sm:flex-row", className)}
    >
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{title}</Label>
        ) : (
          <div className="text-[13px] font-medium text-ink">{title}</div>
        )}
        {description && <div className="mt-1 max-w-[62ch] text-xs leading-relaxed text-muted-foreground">{description}</div>}
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
  const theme = usePrefs((s) => s.theme)
  const uiFont = usePrefs((s) => s.uiFont)
  const set = usePrefs((s) => s.set)

  return (
    <SettingsPage>
      <Panel title="Preferences" tool="appearance" command="edit" meta="this browser" bodyClassName="divide-y divide-line">
        <SettingRow title="Theme" description="Dim is a softer slate between dark and light. Dark is the original near-black look." keywords="dark mode dim colour color contrast">
          <SegmentedTabs
            label="Theme"
            className="w-full sm:w-52"
            tabs={[
              { value: "dim", label: "Dim" },
              { value: "dark", label: "Dark" },
            ]}
            value={theme}
            onChange={(v) => set({ theme: v })}
          />
        </SettingRow>
        <SettingRow title="Interface font" description="Sans for everyday text with mono kept for prompts and numbers, or mono everywhere." keywords="typeface font monospace">
          <SegmentedTabs
            label="Interface font"
            className="w-full sm:w-52"
            tabs={[
              { value: "sans", label: "Sans" },
              { value: "mono", label: "Mono" },
            ]}
            value={uiFont}
            onChange={(v) => set({ uiFont: v })}
          />
        </SettingRow>
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
  { keys: ["⌘", ","], does: "Open settings" },
  { keys: ["Tab"], does: "Move from the header into the sidebar" },
  { keys: ["↑", "↓"], does: "Move between icon-strip items" },
  { keys: ["→", "←"], does: "Into and out of an item's pages; open and close a section in the full sidebar" },
  { keys: ["Esc"], does: "Close the open item or card" },
  { keys: ["⌘", "Enter"], does: "Add a note from the Notes composer" },
]

export function ShortcutsSettings() {
  return (
    <SettingsPage>
      <Panel title="Keyboard shortcuts" tool="keyboard" command="shortcuts" bodyClassName="divide-y divide-line">
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
