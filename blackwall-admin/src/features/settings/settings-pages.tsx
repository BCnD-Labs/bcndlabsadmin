import { Database, Download, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { NavLink } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader, Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { WORKSPACE_STORAGE_KEY, WORKSPACE_VERSION, useWorkspace } from "@/stores/workspace"

export function SettingsTabs() {
  const tabs = [
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
  const samples = usePrefs((s) => s.showSamples)
  const workspaceName = usePrefs((s) => s.workspaceName)
  const set = usePrefs((s) => s.set)
  const clearAll = useWorkspace((s) => s.clearAll)
  const [confirm, setConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? "{}"
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `blackwall-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [pending, setPending] = useState<{ raw: unknown; summary: string } | null>(null)
  const describe = (s: Record<string, unknown[] | undefined>) =>
    `${s.tasks?.length ?? 0} tasks, ${s.journal?.length ?? 0} logs, ${s.notes?.length ?? 0} notes`

  const readImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed?.state || typeof parsed.version !== "number") throw new Error("Not a Blackwall export")
      setPending({ raw: parsed, summary: describe(parsed.state) })
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`)
    }
  }

  const applyImport = async () => {
    if (!pending) return
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(pending.raw))
    await useWorkspace.persist.rehydrate()
    setPending(null)
    toast.success("Workspace imported")
  }

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Appearance">
          <div className="flex flex-wrap items-center gap-3 px-3 py-3">
            <div className="flex-1">
              <Label htmlFor="ws-name" className="text-sm font-bold">Workspace name</Label>
              <p className="text-sm text-muted-foreground">Shown next to the Blackwall wordmark.</p>
            </div>
            <Input id="ws-name" className="w-48" maxLength={32} placeholder="e.g. your org" value={workspaceName} onChange={(e) => set({ workspaceName: e.target.value })} />
          </div>
          <div className="border-t" />
          <SettingRow id="retro" label="Retro details" description="Dot texture and scanlines on the header and navigation rail." checked={retro} onChange={(v) => set({ retroDetails: v })} />
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
            <p className="mt-2 text-xs text-muted-foreground">* Lightened for contrast.</p>
          </div>
        </Panel>
        <Panel title="Your data" icon={<Database />}>
          <div className="space-y-2 px-3 py-3 text-sm">
            <p>
              Tasks, notes, daily logs, projects, repositories and drafts are saved in this browser (
              <code className="font-mono text-xs">{WORKSPACE_STORAGE_KEY}</code>, v{WORKSPACE_VERSION}). They don't sync between
              browsers or devices, so export a copy now and then.
            </p>
            <p className="text-muted-foreground">There's no sign-in. Anyone using this browser profile can see your workspace.</p>
          </div>
          {pending && (
            <div className="space-y-2 border-t bg-recessed/50 px-3 py-3 text-sm" role="alert">
              <p>
                Replace what's here now ({describe(useWorkspace.getState() as unknown as Record<string, unknown[]>)}) with the file ({pending.summary})?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportData}><Download /> Export current first</Button>
                <Button size="sm" variant="destructive" onClick={applyImport}>Replace</Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-3">
            <Button size="sm" variant="outline" onClick={exportData}><Download /> Export</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) readImport(f)
                e.target.value = ""
              }}
            />
            {confirm ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-sm text-red-text">Delete everything?</span>
                <Button size="sm" variant="destructive" onClick={() => { clearAll(); setConfirm(false); toast.success("Workspace cleared") }}>Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="ml-auto text-red-text" onClick={() => setConfirm(true)}>Clear workspace</Button>
            )}
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
