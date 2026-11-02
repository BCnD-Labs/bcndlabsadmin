import { createContext, isValidElement, useContext, useState, type ReactNode } from "react"
import { Bell, Database, Info, Keyboard, LayoutDashboard, PanelLeft, Palette, Plug, Server, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { cn } from "@/lib/utils"
import { OptionSelect } from "@/components/forms/fields"
import { ACCENTS, LANDING_PAGES, usePrefs, type Accent } from "@/stores/prefs"
import { NAV } from "@/components/layout/nav-config"
import type { SettingsSection } from "@/stores/ui"

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal, blurb: "Your name, dates and times, and where Blackwall opens." },
  { id: "appearance", label: "Appearance", icon: Palette, blurb: "Theme, color, spacing and motion in this browser." },
  { id: "home", label: "Home", icon: LayoutDashboard, blurb: "Which panels Home shows, in what order and width." },
  { id: "sidebar", label: "Sidebar", icon: PanelLeft, blurb: "Labels, names and which sections show in the sidebar." },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "How the notification and calendar cards behave." },
  { id: "connections", label: "Connections", icon: Plug, blurb: "Linked services, which account feeds each panel, and your session. Credentials stay on your server." },
  { id: "data", label: "Data & storage", icon: Database, blurb: "Sample data, export and import, and resets." },
  { id: "server", label: "Server & backups", icon: Server, blurb: "Where server data lives and whether backups run." },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, blurb: "Keys that work anywhere in Blackwall." },
  { id: "about", label: "About", icon: Info, blurb: "Version, updates and installing the app." },
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
    <div data-settings-section={id} className="grid min-w-0 content-start gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-bold tracking-tight">{section.label}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{section.blurb}</p>
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
      className={cn("flex min-h-12 gap-2 px-4 py-2.5 sm:items-center sm:gap-6", inline ? "items-center gap-4" : "flex-col sm:flex-row", className)}
    >
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{title}</Label>
        ) : (
          <div className="text-[13px] font-medium text-ink">{title}</div>
        )}
        {description && <div className="mt-0.5 max-w-[62ch] text-xs leading-snug text-muted-foreground">{description}</div>}
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

export function GeneralSettings() {
  const workspaceName = usePrefs((s) => s.workspaceName)
  const weekStartsOn = usePrefs((s) => s.weekStartsOn)
  const timeFormat = usePrefs((s) => s.timeFormat)
  const landingPage = usePrefs((s) => s.landingPage)
  const set = usePrefs((s) => s.set)
  return (
    <SettingsPage>
      <Panel title="Workspace" tool="general" command="edit" bodyClassName="divide-y divide-line">
        <SettingRow title="Your name" description="Shown in the Home greeting." htmlFor="ws-name" keywords="workspace name greeting">
          <Input id="ws-name" className="h-8 w-full sm:w-52" maxLength={32} placeholder="e.g. Blake" value={workspaceName} onChange={(e) => set({ workspaceName: e.target.value })} />
        </SettingRow>
        <SettingRow title="Open on" description="The page Blackwall shows when it first opens." htmlFor="landing" keywords="default landing start page home">
          <OptionSelect id="landing" value={landingPage} onChange={(v) => set({ landingPage: v })} options={LANDING_PAGES.map((l) => ({ value: l.value, label: l.label }))} className="w-52 max-w-full" />
        </SettingRow>
      </Panel>
      <Panel title="Date & time" tool="general" command="time" bodyClassName="divide-y divide-line">
        <SettingRow title="Week starts on" description="Calendars, the Planner and Insights." keywords="week start sunday monday calendar">
          <SegmentedTabs label="Week starts on" className="w-full sm:w-52" tabs={[{ value: "0", label: "Sunday" }, { value: "1", label: "Monday" }]} value={String(weekStartsOn)} onChange={(v) => set({ weekStartsOn: v === "1" ? 1 : 0 })} />
        </SettingRow>
        <SettingRow title="Time format" description="Clock, due times and schedules." keywords="clock 24 hour 12 hour am pm time">
          <SegmentedTabs label="Time format" className="w-full sm:w-52" tabs={[{ value: "12h", label: "1:30 PM" }, { value: "24h", label: "13:30" }]} value={timeFormat} onChange={(v) => set({ timeFormat: v })} />
        </SettingRow>
      </Panel>
    </SettingsPage>
  )
}

export function AppearanceSettings() {
  const categoryColors = usePrefs((s) => s.categoryColors)
  const retro = usePrefs((s) => s.retroDetails)
  const theme = usePrefs((s) => s.theme)
  const uiFont = usePrefs((s) => s.uiFont)
  const accent = usePrefs((s) => s.accent)
  const density = usePrefs((s) => s.density)
  const motion = usePrefs((s) => s.motion)
  const layoutMode = usePrefs((s) => s.layoutMode)
  const set = usePrefs((s) => s.set)

  return (
    <SettingsPage>
      <Panel title="Look" tool="appearance" command="edit" bodyClassName="divide-y divide-line">
        <SettingRow title="Theme" description="Dim is soft slate; Dark is near-black." keywords="dark mode dim colour color contrast">
          <SegmentedTabs label="Theme" className="w-full sm:w-52" tabs={[{ value: "dim", label: "Dim" }, { value: "dark", label: "Dark" }]} value={theme} onChange={(v) => set({ theme: v })} />
        </SettingRow>
        <SettingRow title="Accent color" description="Buttons, the logo and active markers. Errors stay red." keywords="accent brand color colour primary">
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={accent === a} aria-label={a} title={a[0].toUpperCase() + a.slice(1)} onClick={() => set({ accent: a })}
                className={cn("size-6 rounded-full outline-offset-2", accent === a && "outline-2 outline-ink")} style={{ background: ACCENT_SWATCH[a] }} />
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Interface font" description="Sans with mono for numbers, or mono everywhere." keywords="typeface font monospace">
          <SegmentedTabs label="Interface font" className="w-full sm:w-52" tabs={[{ value: "sans", label: "Sans" }, { value: "mono", label: "Mono" }]} value={uiFont} onChange={(v) => set({ uiFont: v })} />
        </SettingRow>
        <SettingRow title="Category colors" description="Colored icons for tasks, learning, GitHub, website and traffic." htmlFor="category-colors" inline>
          <Switch id="category-colors" checked={categoryColors} onCheckedChange={(v) => set({ categoryColors: v })} />
        </SettingRow>
        <SettingRow title="Background grid & scanlines" description="The faint grid behind pages and lines on panels." htmlFor="retro" inline keywords="retro details">
          <Switch id="retro" checked={retro} onCheckedChange={(v) => set({ retroDetails: v })} />
        </SettingRow>
      </Panel>
      <Panel title="Layout & motion" tool="appearance" command="layout" bodyClassName="divide-y divide-line">
        <SettingRow title="Density" description="Space between and inside panels." keywords="spacing compact comfortable gap padding">
          <SegmentedTabs label="Density" className="w-full sm:w-52" tabs={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} value={density} onChange={(v) => set({ density: v })} />
        </SettingRow>
        <SettingRow title="Motion" description="Animations and transitions." keywords="reduce motion animation accessibility">
          <SegmentedTabs label="Motion" className="w-full sm:w-52" tabs={[{ value: "system", label: "System" }, { value: "reduce", label: "Reduce" }, { value: "full", label: "Full" }]} value={motion} onChange={(v) => set({ motion: v })} />
        </SettingRow>
        <SettingRow
          title="Layout on phones"
          description={<>Phone-sized screens only.{" "}
            <details className="inline [&[open]]:block">
              <summary className="inline cursor-pointer underline-offset-2 hover:underline">Learn more</summary>
              <span className="mt-1 block">
                <strong className="font-medium text-ink-2">Mobile view</strong> is built for phones page by page; pages without a mobile version show the responsive page inside it.{" "}
                <strong className="font-medium text-ink-2">Responsive</strong> is the desktop layout reflowed: it works, but phones aren't its focus. If the mobile view breaks, switch back here or open any address with <code className="font-mono">?layout=responsive</code>.
              </span>
            </details>
          </>}
          keywords="mobile phone layout responsive view pwa"
        >
          <SegmentedTabs label="Layout on phones" className="w-full sm:w-56" tabs={[{ value: "responsive", label: "Responsive" }, { value: "mobile", label: "Mobile view" }]} value={layoutMode} onChange={(v) => set({ layoutMode: v })} />
        </SettingRow>
      </Panel>
    </SettingsPage>
  )
}

export function SidebarSettings() {
  const expanded = usePrefs((s) => s.navExpanded)
  const set = usePrefs((s) => s.set)
  return (
    <SettingsPage>
      <Panel title="Sidebar" tool="sidebar" command="edit" bodyClassName="divide-y divide-line">
        <SettingRow title="Show labels" description="The full sidebar instead of icons with hover labels." htmlFor="sidebar-labels" inline keywords="sidebar labels expanded navigation">
          <Switch id="sidebar-labels" checked={expanded} onCheckedChange={(v) => set({ navExpanded: v })} />
        </SettingRow>
      </Panel>
      <SidebarPanel />
    </SettingsPage>
  )
}

export function NotificationsSettings() {
  const autoHide = usePrefs((s) => s.autoHideSeconds)
  const keepOpen = usePrefs((s) => s.keepCardsOpen)
  const set = usePrefs((s) => s.set)
  return (
    <SettingsPage>
      <Panel title="Cards" tool="notifications" command="edit" bodyClassName="divide-y divide-line">
        <SettingRow title="Keep cards open" description="Calendar and notification cards stay until you close them." htmlFor="keep-open" inline keywords="auto hide dismiss notification calendar card">
          <Switch id="keep-open" checked={keepOpen} onCheckedChange={(v) => set({ keepCardsOpen: v })} />
        </SettingRow>
        <SettingRow title="Hide after" description="How long a card stays open after the pointer leaves it." htmlFor="auto-hide" keywords="auto hide seconds timer">
          <input id="auto-hide" type="range" min={2} max={15} step={1} value={autoHide} disabled={keepOpen} onChange={(e) => set({ autoHideSeconds: Number(e.target.value) })} aria-valuetext={`${autoHide} seconds`} className="w-32 accent-[var(--bw-red)] disabled:opacity-40" />
          <output htmlFor="auto-hide" className="w-8 text-right font-mono text-xs text-ink-2 tabular-nums">{autoHide}s</output>
        </SettingRow>
      </Panel>
    </SettingsPage>
  )
}

/** Sample data plus the workspace export/import and resets (General page pieces). */
export function SampleDataGroup() {
  const samples = usePrefs((s) => s.showSamples)
  const set = usePrefs((s) => s.set)
  return (
    <Panel title="Preview" tool="data" command="samples" bodyClassName="divide-y divide-line">
      <SettingRow title="Sample data" description="Fill unconnected panels with labelled made-up data to preview them." htmlFor="samples" inline keywords="demo preview fake">
        <Switch id="samples" checked={samples} onCheckedChange={(v) => set({ showSamples: v })} />
      </SettingRow>
    </Panel>
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

const ACCENT_SWATCH: Record<Accent, string> = { red: "#c92a2a", blue: "#3b78e7", violet: "#8e44e0", cyan: "#0f9fb8", orange: "#e8710a", green: "#1e8e3e", pink: "#d6337f" }

/** Rename or hide sidebar sections (Home always stays). Pages stay reachable by link and search. */
function SidebarPanel() {
  const labels = usePrefs((s) => s.navLabels)
  const hidden = usePrefs((s) => s.navHidden)
  const set = usePrefs((s) => s.set)
  return (
    <Panel title="Sections" tool="sidebar" command="nav" meta="Rename or hide. Hidden pages stay reachable by search." bodyClassName="divide-y divide-line">
      {NAV.map((d) => (
        <SettingRow key={d.id} title={d.label} description={d.id === "home" ? "Always shown." : undefined} htmlFor={`nav-label-${d.id}`} keywords="sidebar navigation rename hide section">
          <div className="flex w-full min-w-0 items-center gap-2">
            <Input id={`nav-label-${d.id}`} aria-label={`Name for ${d.label}`} placeholder={d.label} value={labels[d.id] ?? ""} maxLength={32}
              onChange={(e) => set({ navLabels: { ...labels, [d.id]: e.target.value } })} className="w-44" />
            {d.id !== "home" && (
              <Switch aria-label={`Show ${d.label} in the sidebar`} checked={!hidden.includes(d.id)} onCheckedChange={(on) => set({ navHidden: on ? hidden.filter((x) => x !== d.id) : [...hidden, d.id] })} />
            )}
          </div>
        </SettingRow>
      ))}
    </Panel>
  )
}
