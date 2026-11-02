import { useEffect } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Panel } from "@/components/common/panel"
import { CategoryIcon } from "@/components/common/category-icon"
import { OptionSelect } from "@/components/forms/fields"
import { BLOCK_LABELS, BLOCK_WIDTHS, DEFAULT_LAYOUT, patchBlock, stepBlock, type BlockId, type BlockWidth, type LayoutItem } from "@/lib/home-layout"
import type { Category } from "@/components/common/category-icon"

const WIDTH_TEXT: Record<BlockWidth, string> = { narrow: "Narrow", wide: "Wide", full: "Full width" }
const BLOCK_CATEGORY: Record<BlockId, Category> = { prs: "development", week: "calendar", repos: "development", productivity: "tasks", coursework: "learning", calendar: "calendar", development: "development", website: "website", analytics: "analytics", projects: "projects", log: "journal", services: "service" }
import { useConnections } from "@/services/connector"
import { usePrefs } from "@/stores/prefs"
import { useUi } from "@/stores/ui"
import { SettingRow, SettingsPage } from "./settings-pages"

export function DashboardSettings() {
  const { homeLayout, feedConnections, set } = usePrefs()
  const saveLayout = (next: LayoutItem[]) => set({ homeLayout: next })
  const { list, available, refresh } = useConnections()
  useEffect(() => { void refresh() }, [refresh])

  return <SettingsPage>
    <Panel title="Home layout" meta="saved automatically" bodyClassName="divide-y divide-line">
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">Every panel Home can show, in order. Narrow takes one column, Wide two, Full the whole row (phones stack everything). You can also use Customize on Home to drag panels around.</p>
      {homeLayout.map((b, index) => {
        const category = BLOCK_CATEGORY[b.id]
        return <SettingRow key={b.id} title={<span className="flex items-center gap-2"><CategoryIcon category={category} />{BLOCK_LABELS[b.id]}</span>} description={b.visible ? `${WIDTH_TEXT[b.width]} · position ${homeLayout.filter((x) => x.visible).findIndex((x) => x.id === b.id) + 1}` : "Hidden from Home"} htmlFor={`home-block-${b.id}`} keywords="dashboard panels widgets layout order hide width">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
            <Switch id={`home-block-${b.id}`} aria-label={`Show ${BLOCK_LABELS[b.id]} on Home`} checked={b.visible} onCheckedChange={(visible) => saveLayout(patchBlock(homeLayout, b.id, { visible }))} />
            <OptionSelect label={`${BLOCK_LABELS[b.id]} width`} value={b.width} onChange={(width) => saveLayout(patchBlock(homeLayout, b.id, { width }))} options={BLOCK_WIDTHS.map((value) => ({ value, label: WIDTH_TEXT[value] }))} className="w-28" />
            <Button variant="quiet" size="icon-sm" aria-label={`Move ${BLOCK_LABELS[b.id]} up`} disabled={index === 0} onClick={() => saveLayout(stepBlock(homeLayout, b.id, -1))}><ArrowUp /></Button>
            <Button variant="quiet" size="icon-sm" aria-label={`Move ${BLOCK_LABELS[b.id]} down`} disabled={index === homeLayout.length - 1} onClick={() => saveLayout(stepBlock(homeLayout, b.id, 1))}><ArrowDown /></Button>
          </div>
        </SettingRow>
      })}
      <SettingRow title="Reset layout" description="Back to the default panels, order and widths.">
        <Button variant="outline" onClick={() => saveLayout(DEFAULT_LAYOUT.map((b) => ({ ...b })))}>Reset</Button>
      </SettingRow>
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
