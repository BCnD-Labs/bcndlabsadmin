import { Check } from "lucide-react"
import { toast } from "sonner"
import { CORNERS, FONTS, STARTERS, SWATCH_INFO, SWATCH_KEYS, WIDTHS, contrast } from "@shared/sitebuilder"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/common/panel"
import { OptionSelect } from "@/components/forms/fields"
import type { Site, SitePalette } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"

function Palette({ site, mode, onChange }: { site: Site; mode: "light" | "dark"; onChange: (p: SitePalette) => void }) {
  const pal = site[mode]
  return (
    <div className="grid gap-1.5 @md:grid-cols-2">
      {SWATCH_KEYS.map((k) => {
        const ratio = k === "text" || k === "muted" || k === "accent" ? contrast(pal[k], pal.bg) : undefined
        return (
          <label key={k} className="flex items-center gap-2 rounded-[8px] bg-raised px-2 py-1.5">
            <input type="color" value={pal[k]} onChange={(e) => onChange({ ...pal, [k]: e.target.value })} className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent" aria-label={`${SWATCH_INFO[k].l} (${mode})`} />
            <span className="min-w-0 flex-1"><span className="block text-xs text-ink">{SWATCH_INFO[k].l}</span><span className="block truncate font-mono text-[10.5px] text-muted-foreground">{pal[k]}</span></span>
            {ratio != null && <span className={cn("text-[10.5px] tabular-nums", ratio >= (k === "muted" ? 3 : 4.5) ? "text-green" : "text-amber")} title="Contrast against the page: higher is easier to read">{ratio.toFixed(1)}</span>}
          </label>
        )
      })}
    </div>
  )
}

/** A row of big choices, one selected. */
function Choice<V extends string>({ label, value, options, onPick }: { label: string; value: V; options: { value: V; node: React.ReactNode; name: string; about?: string }[]; onPick: (v: V) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 @md:grid-cols-4">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onPick(o.value)} className={cn("flex flex-col items-start gap-0.5 rounded-[10px] bg-raised px-2.5 py-2 text-left transition-colors hover:bg-selected", o.value === value && "ring-2 ring-[var(--bw-red)]")}>
          <span className="flex w-full items-center justify-between text-lg leading-none text-ink">{o.node}{o.value === value && <Check className="size-3.5 text-[var(--bw-red)]" aria-hidden />}</span>
          <span className="text-xs font-semibold text-ink">{o.name}</span>
          {o.about && <span className="text-[10.5px] leading-tight text-muted-foreground">{o.about}</span>}
        </button>
      ))}
    </div>
  )
}

/** Look: colors, type, corners and width. The canvas beside it is the live preview, so every click shows straight away. */
export function LookPanel({ site }: { site: Site }) {
  const sites = useWorkspace((s) => s.sites)
  const { update } = useWorkspace.getState()
  const set = (patch: Partial<Site>) => update("sites", site.id, patch)
  const others = sites.filter((s) => s.id !== site.id)
  const starterHere = (k: string) => JSON.stringify(STARTERS[k].light) === JSON.stringify(site.light) && JSON.stringify(STARTERS[k].dark) === JSON.stringify(site.dark)

  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]">
            <Panel category="website" title="Theme" meta="colors, light and dark" bodyClassName="grid gap-3 px-3.5 py-3">
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
                {Object.entries(STARTERS).map(([k, t]) => (
                  <button key={k} type="button" role="radio" aria-checked={starterHere(k)} onClick={() => set({ starter: k, light: { ...t.light }, dark: { ...t.dark } })} className={cn("overflow-hidden rounded-[10px] bg-raised text-left transition-colors hover:bg-selected", starterHere(k) && "ring-2 ring-[var(--bw-red)]")}>
                    <span className="flex h-9" aria-hidden>
                      {(["bg", "surface", "accent", "text"] as const).map((c) => <span key={c} className="flex-1" style={{ background: t.light[c] }} />)}
                      {(["bg", "surface", "accent"] as const).map((c) => <span key={`d${c}`} className="flex-1" style={{ background: t.dark[c] }} />)}
                    </span>
                    <span className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-ink">{t.name}{starterHere(k) && <Check className="size-3.5 text-[var(--bw-red)]" />}</span>
                  </button>
                ))}
              </div>
              {others.length > 0 && (
                <div className="flex items-center gap-2 border-t border-line-soft pt-3">
                  <Label className="shrink-0 text-xs font-normal text-muted-foreground">Copy the look of</Label>
                  <OptionSelect label="Copy the look of" value="none" onChange={(id) => { const o = sites.find((s) => s.id === id); if (!o) return; set({ starter: o.starter, light: { ...o.light }, dark: { ...o.dark }, darkMode: o.darkMode, font: o.font, corners: o.corners, width: o.width }); toast.success(`Now looks like ${o.name}`) }} options={[{ value: "none", label: "another site…" }, ...others.map((o) => ({ value: o.id, label: o.name }))]} className="min-w-0 flex-1" />
                </div>
              )}
            </Panel>
            <Panel category="website" title="Type, corners and width" bodyClassName="grid gap-4 px-3.5 py-3">
              <div className="grid gap-1.5"><span className="text-xs font-semibold text-ink">Type</span>
                <Choice label="Type" value={site.font ?? "sans"} onPick={(font) => set({ font })} options={(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((k) => ({ value: k, name: FONTS[k].name, about: FONTS[k].about, node: <span style={{ fontFamily: FONTS[k].css }}>Aa</span> }))} /></div>
              <div className="grid gap-1.5"><span className="text-xs font-semibold text-ink">Corners</span>
                <Choice label="Corners" value={site.corners ?? "soft"} onPick={(corners) => set({ corners })} options={(Object.keys(CORNERS) as (keyof typeof CORNERS)[]).map((k) => ({ value: k, name: CORNERS[k].name, node: <span className="inline-block size-6 border-t-2 border-l-2 border-ink-2" style={{ borderTopLeftRadius: CORNERS[k].px }} /> }))} /></div>
              <div className="grid gap-1.5"><span className="text-xs font-semibold text-ink">Page width</span>
                <Choice label="Page width" value={site.width ?? "normal"} onPick={(width) => set({ width })} options={(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => ({ value: k, name: WIDTHS[k].name, about: `${WIDTHS[k].px}px`, node: <span className="inline-block h-3 rounded-sm bg-ink-2" style={{ width: `${(WIDTHS[k].px / 1320) * 28}px` }} /> }))} /></div>
            </Panel>
            <Panel category="website" title="Fine-tune colors" meta="optional" bodyClassName="grid gap-3 px-3.5 py-3">
              <p className="text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">Light</p>
              <Palette site={site} mode="light" onChange={(light) => set({ light })} />
              <div className="flex items-center gap-2 border-t border-line-soft pt-3"><Switch id="look-dark" checked={site.darkMode} onCheckedChange={(darkMode) => set({ darkMode })} /><Label htmlFor="look-dark" className="text-xs font-normal">Dark mode for visitors whose device is set to dark</Label></div>
              {site.darkMode && <Palette site={site} mode="dark" onChange={(dark) => set({ dark })} />}
            </Panel>
            <Panel category="website" title="Your CSS" meta="for anything else" bodyClassName="px-3.5 py-3">
              <Textarea rows={5} value={site.customCss} onChange={(e) => set({ customCss: e.target.value })} className="font-mono text-xs" placeholder=".site-title { letter-spacing: .05em; }" aria-label="Custom CSS" />
              <p className="mt-1.5 text-[11px] text-faint">Added at the end of theme.css on every page.</p>
            </Panel>
    </div>
  )
}
