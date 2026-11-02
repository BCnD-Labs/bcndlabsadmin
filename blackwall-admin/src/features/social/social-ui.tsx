import { useState } from "react"
import { toast } from "sonner"
import { DEFAULT_BRANDS, PLATFORMS, platformDef } from "@shared/social"
import { Input } from "@/components/ui/input"
import { Field, OptionSelect } from "@/components/forms/fields"
import { FormFrame } from "@/components/forms/form-frame"
import type { FilterOption } from "@/components/common/filter-chips"
import type { SocialAccount, SocialPlatform } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePrefs } from "@/stores/prefs"
import { useWorkspace } from "@/stores/workspace"

/** The platform's two-letter badge in its own color. */
export function PlatformBadge({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const p = platformDef(platform)
  return (
    <span title={p.label} aria-label={p.label} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold tracking-tight", className)}
      style={{ color: p.color, background: `color-mix(in srgb, ${p.color} 18%, transparent)` }}>{p.short}</span>
  )
}

/** "Sprouts & Scraps · IG" chip for an account. */
export function AccountChip({ account, done }: { account: SocialAccount; done?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-well py-0.5 pr-2 pl-0.5 text-[11.5px]", done ? "text-faint line-through" : "text-ink-2")}>
      <PlatformBadge platform={account.platform} className="size-[18px] rounded-full" />
      <span className="truncate">{account.brand}</span>
    </span>
  )
}

/** Every brand in use, plus the usual three, for suggestions and the brand filter. */
export function useBrands() {
  const accounts = useWorkspace((s) => s.socialAccounts)
  return [...new Set([...accounts.map((a) => a.brand), ...DEFAULT_BRANDS])]
}

/** The shared platform + brand filter (remembered per browser). */
export function useSocialFilter() {
  const platforms = usePrefs((s) => s.socialPlatforms)
  const brands = usePrefs((s) => s.socialBrands)
  const set = usePrefs((s) => s.set)
  const accounts = useWorkspace((s) => s.socialAccounts)
  const platformOptions: FilterOption[] = PLATFORMS.filter((p) => accounts.some((a) => a.platform === p.id)).map((p) => ({ value: p.id, label: p.label, icon: <PlatformBadge platform={p.id} className="size-4 text-[7.5px]" /> }))
  const brandOptions: FilterOption[] = [...new Set(accounts.map((a) => a.brand))].map((b) => ({ value: b, label: b }))
  return {
    platforms, brands, platformOptions, brandOptions,
    setPlatforms: (v: string[]) => set({ socialPlatforms: v }),
    setBrands: (v: string[]) => set({ socialBrands: v }),
    /** Accounts the filter currently shows. */
    visibleAccounts: accounts.filter((a) => (!platforms.length || platforms.includes(a.platform)) && (!brands.length || brands.includes(a.brand))),
  }
}

/** Add or edit a social account. */
export function SocialAccountForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const existing = useWorkspace((s) => s.socialAccounts.find((a) => a.id === id))
  const { create, update, remove } = useWorkspace.getState()
  const brands = useBrands()
  const [d, setD] = useState({ platform: existing?.platform ?? ("instagram" as SocialPlatform), name: existing?.name ?? "", brand: existing?.brand ?? "", url: existing?.url ?? "" })
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }))
  const url = d.url.trim()
  const urlBad = !!url && !/^https?:\/\/\S+$/i.test(url)
  const save = () => {
    const values = { platform: d.platform, name: d.name.trim(), brand: d.brand.trim() || "Personal", url }
    if (existing) update("socialAccounts", existing.id, values)
    else create("socialAccounts", values)
    toast.success(existing ? "Account updated" : `${values.name} added`)
    onDone()
  }
  return (
    <FormFrame title={existing ? `Edit ${existing.name}` : "New social account"} onSubmit={save} submitLabel={existing ? "Save" : "Add account"} canSubmit={!!d.name.trim() && !urlBad}
      onDelete={existing ? () => (remove("socialAccounts", existing.id), toast(`${existing.name} removed`), onDone()) : undefined}>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Platform" htmlFor="sa-platform">
          <OptionSelect id="sa-platform" value={d.platform} onChange={(platform) => set({ platform })} options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))} className="w-full" />
        </Field>
        <Field label="Handle or page name" htmlFor="sa-name">
          <Input id="sa-name" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="@sproutsandscraps" maxLength={60} />
        </Field>
      </div>
      <Field label="Brand" htmlFor="sa-brand" hint="Who this account speaks for. Filters and posts group by it.">
        <Input id="sa-brand" list="sa-brands" value={d.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Personal" maxLength={40} />
        <datalist id="sa-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      </Field>
      <Field label="Profile address" htmlFor="sa-url" hint="Optional. Open buttons go here." error={urlBad ? "Start with https://" : undefined}>
        <Input id="sa-url" type="url" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder={platformDef(d.platform).home || "https://"} />
      </Field>
    </FormFrame>
  )
}
