import { createContext, isValidElement, useContext, useEffect, useState, type ReactNode } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { NOTIFY_EVENTS, NOTIFY_GROUP_LABEL, channelsFor, type NotifyChannel, type NotifyGroup, type NotifySettings } from "@shared/notifications"
import { api, useConnections } from "@/services/connector"
import { useNotifications } from "@/services/notifications"
import { useUi } from "@/stores/ui"
import { timeFmt } from "@/lib/dates"
import { Bell, Check, Database, GraduationCap, Info, Keyboard, LayoutDashboard, Monitor, PanelLeft, Palette, Plug, Server, SlidersHorizontal, type LucideIcon } from "lucide-react"
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
import { ROUNDNESS, THEMES, cleanHex } from "@/lib/look"
import { NAV } from "@/components/layout/nav-config"
import type { SettingsSection } from "@/stores/ui"

/** True inside the Mac app, which has the desktop rail and windows. */
export const IS_MAC_APP = typeof document !== "undefined" && document.documentElement.dataset.runtime === "mac-native"

const ALL_SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; blurb: string; macOnly?: boolean }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal, blurb: "Your name, dates and times, and where Blackwall opens." },
  { id: "appearance", label: "Appearance", icon: Palette, blurb: "Theme, color, spacing and motion in this browser." },
  { id: "desktop", label: "Desktop", icon: Monitor, blurb: "The Mac desktop: sidebar names, which apps show, and how windows come back.", macOnly: true },
  { id: "learning", label: "Learning", icon: GraduationCap, blurb: "How the planner spreads your work, and what shows on the calendar." },
  { id: "home", label: "Home", icon: LayoutDashboard, blurb: "Which panels Home shows, in what order and width." },
  { id: "sidebar", label: "Sidebar", icon: PanelLeft, blurb: "Labels, names and which sections show in the sidebar." },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "What notifies you, and whether it reaches the bell, your phone (ntfy) or email." },
  { id: "connections", label: "Connections", icon: Plug, blurb: "Linked services, which account feeds each panel, and your session. Credentials stay on your server." },
  { id: "data", label: "Data & storage", icon: Database, blurb: "Sample data, export and import, and resets." },
  { id: "server", label: "Server & backups", icon: Server, blurb: "Where server data lives and whether backups run." },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, blurb: "Keys that work anywhere in Blackwall." },
  { id: "about", label: "About", icon: Info, blurb: "Version, updates and installing the app." },
]

export const SETTINGS_SECTIONS = ALL_SECTIONS.filter((s) => !s.macOnly || IS_MAC_APP)

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
  const customAccent = usePrefs((s) => s.customAccent)
  const roundness = usePrefs((s) => s.roundness)
  const density = usePrefs((s) => s.density)
  const motion = usePrefs((s) => s.motion)
  const layoutMode = usePrefs((s) => s.layoutMode)
  const set = usePrefs((s) => s.set)

  return (
    <SettingsPage>
      <Panel title="Look" tool="appearance" command="edit" bodyClassName="divide-y divide-line">
        <SettingRow title="Theme" description="Colors for the whole app." keywords="dark mode dim light midnight mocha forest graphite colour color contrast">
          <div role="radiogroup" aria-label="Theme" className="grid w-full grid-cols-2 gap-2 sm:w-[26rem] sm:grid-cols-4">
            {THEMES.map((t) => (
              <button key={t.value} type="button" role="radio" aria-checked={theme === t.value} onClick={() => set({ theme: t.value })} title={t.blurb}
                className={cn("grid gap-1.5 rounded-lg border p-1.5 text-left transition-colors hover:bg-raised", theme === t.value ? "border-[var(--bw-red)] bg-raised" : "border-line")}>
                <span className="flex h-9 overflow-hidden rounded-[5px] border border-black/20" aria-hidden>
                  <span className="flex-1" style={{ background: t.swatch[0] }} /><span className="flex-[1.4]" style={{ background: t.swatch[1] }} /><span className="w-3" style={{ background: t.swatch[2] }} />
                </span>
                <span className="px-0.5 text-[12px] font-medium text-ink">{t.label}</span>
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Accent color" description="Buttons, the logo and active markers. Errors stay red. Pick your own with the last swatch." keywords="accent brand color colour primary custom hex">
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap items-center gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={!customAccent && accent === a} aria-label={a} title={a[0].toUpperCase() + a.slice(1)} onClick={() => set({ accent: a, customAccent: "" })}
                className={cn("size-6 rounded-full outline-offset-2", !customAccent && accent === a && "outline-2 outline-ink")} style={{ background: ACCENT_SWATCH[a] }} />
            ))}
            <label className={cn("relative size-6 cursor-pointer overflow-hidden rounded-full outline-offset-2", customAccent && "outline-2 outline-ink")} title="Your own color" style={{ background: customAccent || "conic-gradient(#e53935, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935)" }}>
              <input type="color" aria-label="Your own accent color" value={customAccent || ACCENT_SWATCH[accent]} onChange={(e) => set({ customAccent: cleanHex(e.target.value) })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
            </label>
            {customAccent && <Button variant="quiet" size="xs" onClick={() => set({ customAccent: "" })}>Clear</Button>}
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
        <SettingRow title="Corners" description="How round panels and buttons are." keywords="radius rounded sharp square corners">
          <SegmentedTabs label="Corners" className="w-full sm:w-52" tabs={ROUNDNESS.map((r) => ({ value: r.value, label: r.label }))} value={roundness} onChange={(v) => set({ roundness: v })} />
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

const CHANNEL_LABEL: Record<NotifyChannel, string> = { bell: "Bell", ntfy: "Phone", email: "Email" }

/** One event's channels as three small toggles: Bell, Phone (ntfy), Email. */
function ChannelToggles({ event, on, onChange, connected }: { event: string; on: NotifyChannel[]; onChange: (next: NotifyChannel[]) => void; connected: Record<NotifyChannel, boolean> }) {
  return (
    <div role="group" aria-label={`Channels for ${event}`} className="flex gap-1">
      {(["bell", "ntfy", "email"] as const).map((ch) => {
        const active = on.includes(ch)
        return (
          <button key={ch} type="button" aria-pressed={active} title={!connected[ch] ? `${CHANNEL_LABEL[ch]} isn't connected yet; this choice applies once it is.` : undefined}
            onClick={() => onChange(active ? on.filter((x) => x !== ch) : [...on, ch])}
            className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium transition-colors", active ? "bg-[color-mix(in_srgb,var(--bw-red)_24%,transparent)] text-ink" : "text-faint ring-1 ring-line ring-inset hover:text-ink-2", active && !connected[ch] && "text-ink-2")}>
            {active && <Check className="size-3" aria-hidden />}
            {CHANNEL_LABEL[ch]}
          </button>
        )
      })}
    </div>
  )
}

export function NotificationsSettings() {
  const autoHide = usePrefs((s) => s.autoHideSeconds)
  const keepOpen = usePrefs((s) => s.keepCardsOpen)
  const set = usePrefs((s) => s.set)
  const connections = useConnections((s) => s.list)
  const [settings, setSettings] = useState<NotifySettings | null>(null)
  const [errors, setErrors] = useState<Partial<Record<NotifyChannel, { at: string; message: string }>>>({})
  const [testing, setTesting] = useState<NotifyChannel | null>(null)
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => {
    api<{ settings: NotifySettings; errors: typeof errors }>("notifications/settings")
      .then((r) => {
        setErrors(r.errors ?? {})
        // First visit: the server doesn't know your time zone yet, so take this device's.
        if (r.settings.timeZone === "UTC" && deviceZone !== "UTC" && !Object.keys(r.settings.rules).length) save({ ...r.settings, timeZone: deviceZone })
        else setSettings(r.settings)
      })
      .catch((e: Error) => toast.error(`Couldn't load notification settings: ${e.message}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const save = (next: NotifySettings) => {
    setSettings(next)
    void api("notifications/settings", { method: "PUT", body: JSON.stringify(next) }).catch((e: Error) => toast.error(e.message))
  }
  const ok = (p: "ntfy" | "email") => connections.find((c) => c.provider === p && c.status === "ok")
  const connected: Record<NotifyChannel, boolean> = { bell: true, ntfy: !!ok("ntfy"), email: !!ok("email") }
  const test = async (ch: NotifyChannel) => {
    setTesting(ch)
    try {
      await api("notifications/test", { method: "POST", body: JSON.stringify({ channel: ch }) })
      toast.success(ch === "bell" ? "Test sent to the bell" : ch === "ntfy" ? "Test push sent" : "Test email sent")
      if (ch === "bell") void useNotifications.getState().refresh()
      setErrors((e) => ({ ...e, [ch]: undefined }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(null)
    }
  }
  const zones = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [deviceZone, "UTC"]

  return (
    <SettingsPage>
      <Panel title="Delivery" tool="notifications" command="channels" bodyClassName="divide-y divide-line">
        {([["bell", "Bell", "The feed in Blackwall's header."], ["ntfy", "Phone (ntfy)", "Push notifications through your ntfy server, even with Blackwall closed."], ["email", "Email", "From your own mail account over SMTP."]] as const).map(([ch, title, desc]) => {
          const c = ch === "bell" ? undefined : ok(ch)
          const err = errors[ch]
          return (
            <SettingRow key={ch} title={title} description={<>{ch !== "bell" && (c ? <span className="text-green">Connected · {c.account ?? c.label}. </span> : <span>Not set up. </span>)}{desc}{err && <span className="block text-red-text">Last send failed: {err.message}</span>}</>} keywords="notification channel push ntfy email smtp bell">
              {ch !== "bell" && !c && <Button variant="outline" size="sm" onClick={() => useUi.getState().openSettings("connections", ch)}>Set up</Button>}
              {(ch === "bell" || c) && <Button variant="outline" size="sm" disabled={testing === ch} onClick={() => void test(ch)}>{testing === ch ? "Sending…" : "Send test"}</Button>}
            </SettingRow>
          )
        })}
      </Panel>
      {settings && (
        <>
          <Panel title="Daily summary" tool="notifications" command="digest" bodyClassName="divide-y divide-line">
            <SettingRow title="Send at" description="When the morning summary of due and overdue work goes out." htmlFor="digest-hour" keywords="digest morning summary time">
              <OptionSelect id="digest-hour" value={String(settings.digestHour)} onChange={(v) => save({ ...settings, digestHour: Number(v) })} options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: format(new Date(2000, 0, 1, h), timeFmt()) }))} className="w-32" />
            </SettingRow>
            <SettingRow title="Time zone" description={settings.timeZone === deviceZone ? "This device's time zone." : `This device is on ${deviceZone}.`} htmlFor="digest-tz" keywords="time zone timezone">
              <OptionSelect id="digest-tz" value={settings.timeZone} onChange={(v) => save({ ...settings, timeZone: v })} options={[...new Set([settings.timeZone, deviceZone, ...zones])].map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} className="w-56 max-w-full" />
            </SettingRow>
          </Panel>
          {(Object.keys(NOTIFY_GROUP_LABEL) as NotifyGroup[]).map((g) => (
            <Panel key={g} title={NOTIFY_GROUP_LABEL[g]} tool="notifications" command={g} bodyClassName="divide-y divide-line">
              {NOTIFY_EVENTS.filter((e) => e.group === g).map((e) => (
                <SettingRow key={e.id} title={e.label} description={e.description} keywords={`notification ${e.label} ${NOTIFY_GROUP_LABEL[g]}`}>
                  <ChannelToggles event={e.label} on={channelsFor(settings, e.id)} connected={connected} onChange={(next) => save({ ...settings, rules: { ...settings.rules, [e.id]: next } })} />
                </SettingRow>
              ))}
            </Panel>
          ))}
        </>
      )}
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


/** Mac desktop only: the left rail, which apps show on it, and how windows come back. */
export function DesktopSettings() {
  const railLabels = usePrefs((s) => s.railLabels)
  const railHidden = usePrefs((s) => s.railHidden)
  const restore = usePrefs((s) => s.restoreWindows)
  const set = usePrefs((s) => s.set)
  return (
    <SettingsPage>
      <Panel title="Sidebar" tool="desktop" command="rail" bodyClassName="divide-y divide-line">
        <SettingRow title="Show names" description="Write each app's name next to its icon so you can read the sidebar. You can also use the arrow at its top." htmlFor="rail-labels" inline keywords="sidebar rail labels names expand collapse icons">
          <Switch id="rail-labels" checked={railLabels} onCheckedChange={(v) => set({ railLabels: v })} />
        </SettingRow>
        {RAIL_APPS.map(({ id, label }) => (
          <SettingRow key={id} title={label} inline keywords="sidebar rail hide show app">
            <Switch aria-label={`Show ${label} in the sidebar`} checked={!railHidden.includes(id)} onCheckedChange={(on) => set({ railHidden: on ? railHidden.filter((x) => x !== id) : [...railHidden, id] })} />
          </SettingRow>
        ))}
      </Panel>
      <Panel title="Windows" tool="desktop" command="windows" bodyClassName="divide-y divide-line">
        <SettingRow title="Reopen windows" description="Open the apps that were open when you last quit. Their size and place are always remembered." htmlFor="restore-windows" inline keywords="restore windows launch startup reopen">
          <Switch id="restore-windows" checked={restore} onCheckedChange={(v) => set({ restoreWindows: v })} />
        </SettingRow>
        <SettingRow title="Reset window layout" description="Close every window and put them back where they start. Your data is not touched." keywords="reset windows layout positions">
          <ConfirmButton confirmLabel="Reset layout" onConfirm={() => { try { localStorage.removeItem("blackwall-mac-desktop-windows-v2"); localStorage.removeItem("blackwall-mac-desktop-windows-v1") } catch { /* nothing to reset */ } window.location.reload() }}>Reset layout…</ConfirmButton>
        </SettingRow>
      </Panel>
      <p className="px-1 text-[11px] text-muted-foreground">Hidden apps stay reachable from search (⌘K). Theme, accent and corners are under Appearance.</p>
    </SettingsPage>
  )
}

/** Same order and grouping as the sidebar itself (src/mac/desktop-workspace.tsx). */
const RAIL_APPS = [
  { id: "home", label: "Home (with Insights)" }, { id: "learning", label: "Learning" }, { id: "journal", label: "Journal" }, { id: "notes", label: "Notes" },
  { id: "projects", label: "Projects (with GitHub activity)" }, { id: "website", label: "Publish (Websites and Social)" },
  { id: "files", label: "Files (with Docs and Assets)" }, { id: "browser", label: "Browser" },
  { id: "mikoshi", label: "Mikoshi" },
]

/** How the Learning planner spreads work. The Android app uses its own copy of these choices. */
export function LearningSettings() {
  const perDay = usePrefs((s) => s.planPerDay)
  const horizon = usePrefs((s) => s.planHorizon)
  const showClassTimes = usePrefs((s) => s.showClassTimes)
  const weekStartsOn = usePrefs((s) => s.weekStartsOn)
  const set = usePrefs((s) => s.set)
  return (
    <SettingsPage>
      <Panel title="Planning" tool="learning" command="plan" bodyClassName="divide-y divide-line">
        <SettingRow title="Most things per day" description="The planner never puts more than this on one day when it suggests a plan or a study schedule." htmlFor="plan-per-day" keywords="plan cap limit per day workload">
          <input id="plan-per-day" type="range" min={1} max={6} step={1} value={perDay} onChange={(e) => set({ planPerDay: Number(e.target.value) })} aria-valuetext={`${perDay} per day`} className="w-32 accent-[var(--bw-red)]" />
          <output htmlFor="plan-per-day" className="w-6 text-right font-mono text-xs text-ink-2 tabular-nums">{perDay}</output>
        </SettingRow>
        <SettingRow title="Plan ahead" description="How far ahead “Plan my next weeks” looks." keywords="plan horizon weeks days ahead">
          <SegmentedTabs label="Plan ahead" className="w-full sm:w-64" tabs={[{ value: "7", label: "1 week" }, { value: "14", label: "2 weeks" }, { value: "21", label: "3 weeks" }, { value: "28", label: "4 weeks" }]} value={String(horizon)} onChange={(v) => set({ planHorizon: Number(v) as 7 | 14 | 21 | 28 })} />
        </SettingRow>
      </Panel>
      <Panel title="Calendar" tool="learning" command="calendar" bodyClassName="divide-y divide-line">
        <SettingRow title="Show class times" description="Draw each course's class and office-hour times on the Planner calendar." htmlFor="show-class-times" inline keywords="calendar classes meetings office hours">
          <Switch id="show-class-times" checked={showClassTimes} onCheckedChange={(v) => set({ showClassTimes: v })} />
        </SettingRow>
        <SettingRow title="Week starts on" description="Also under General." keywords="week start sunday monday">
          <SegmentedTabs label="Week starts on" className="w-full sm:w-52" tabs={[{ value: "0", label: "Sunday" }, { value: "1", label: "Monday" }]} value={String(weekStartsOn)} onChange={(v) => set({ weekStartsOn: v === "1" ? 1 : 0 })} />
        </SettingRow>
      </Panel>
    </SettingsPage>
  )
}
