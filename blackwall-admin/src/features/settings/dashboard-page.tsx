import { useEffect } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { CategoryIcon } from "@/components/common/category-icon"
import { OptionSelect } from "@/components/forms/fields"
import { PANEL_TYPES, type PanelType } from "@/lib/home-slots"
import { PANELS } from "@/features/home/panel-registry"
import { useConnections } from "@/services/connector"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { SettingRow, SettingsPage } from "./settings-pages"

export function DashboardSettings() {
  const { homeSlots, showHomeProjects, showHomeLog, feedConnections, set, setSlot, swapSlots } = usePrefs()
  const { list, available, refresh } = useConnections()
  useEffect(() => { void refresh() }, [refresh])

  return <SettingsPage>
    <Panel title="Home panels" meta="saved automatically" bodyClassName="divide-y divide-line">
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">Choose up to four panels. Selecting a panel already shown elsewhere swaps the two positions. Positions 1 and 4 are wide; 2 and 3 are narrow. Hidden positions take up no space. Projects and Daily log have separate controls below.</p>
      {homeSlots.map((type, index) => <SettingRow key={index} title={`Position ${index + 1}`} description={type === "empty" ? "Hidden from Home" : PANELS[type].label} htmlFor={`home-panel-${index}`} keywords="dashboard panels widgets layout order hide">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
          {PANELS[type].category && <CategoryIcon category={PANELS[type].category!} />}
          <OptionSelect id={`home-panel-${index}`} value={type} onChange={(value) => setSlot(index, value as PanelType)} options={PANEL_TYPES.map((value) => ({ value, label: PANELS[value].label }))} className="w-40 max-w-full sm:w-52" />
          <Button variant="quiet" size="icon-sm" aria-label={`Move position ${index + 1} up`} disabled={index === 0} onClick={() => swapSlots(index, index - 1)}><ArrowUp /></Button>
          <Button variant="quiet" size="icon-sm" aria-label={`Move position ${index + 1} down`} disabled={index === homeSlots.length - 1} onClick={() => swapSlots(index, index + 1)}><ArrowDown /></Button>
        </div>
      </SettingRow>)}
      <SettingRow title="Projects on Home" description="Show a preview of your active projects." htmlFor="home-projects" inline><Switch id="home-projects" checked={showHomeProjects} onCheckedChange={(value) => set({ showHomeProjects: value })} /></SettingRow>
      <SettingRow title="Daily log on Home" description="Show today’s log and its writing shortcut." htmlFor="home-log" inline><Switch id="home-log" checked={showHomeLog} onCheckedChange={(value) => set({ showHomeLog: value })} /></SettingRow>
    </Panel>
    <Panel title="Data sources" bodyClassName="divide-y divide-line">
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">Choose which account supplies each feed throughout Blackwall in this browser. Automatic uses the first working connection. Selecting an account keeps that choice even if its connection fails.</p>
      {(["github", "analytics"] as const).map((provider) => {
        const options = list.filter((c) => c.provider === provider)
        const selected = feedConnections[provider]
        const missing = selected && !options.some((c) => c.id === selected)
        const label = provider === "github" ? "GitHub activity" : "Website traffic"
        return <SettingRow key={provider} title={label} description={available === false ? "The server is unavailable. Your saved source choice is kept." : available === null ? "Loading connections…" : options.length ? "Manage credentials and test access in Connections." : "Add a connection before choosing a source."} htmlFor={`feed-${provider}`} keywords="source account connection site provider">
          <OptionSelect id={`feed-${provider}`} value={selected || "auto"} onChange={(value) => set({ feedConnections: { ...feedConnections, [provider]: value === "auto" ? undefined : value } })} options={[
            { value: "auto", label: "Automatic" },
            ...(missing ? [{ value: selected, label: "Unavailable connection — choose another" }] : []),
            ...options.map((c) => ({ value: c.id, label: `${c.label}${c.status !== "ok" ? " · Needs attention" : ""}` })),
          ]} className="w-52 max-w-full" />
          <Button variant="outline" onClick={() => useUi.getState().openSettings("connections", options.length ? undefined : provider)}>{options.length ? "Manage" : "Add connection"}</Button>
        </SettingRow>
      })}
      <SettingRow title="Website publishing" description="Publishing and scheduled posts use the installation’s publishing connection across all devices. Per-browser source selection applies only to GitHub activity and website traffic.">
        <Button variant="outline" onClick={() => useUi.getState().openSettings("connections")}>Manage publishing</Button>
      </SettingRow>
    </Panel>
  </SettingsPage>
}
