import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Field, OptionSelect } from "@/components/forms/fields"
import { FormFrame } from "@/components/forms/form-frame"
import type { Service } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { KNOWN_APPS, slugify } from "./known-apps"
import { SERVICE_ICONS, ServiceGlyph, ServiceLogo, useLogo, type ServiceIconName } from "./service-icons"

/** Add or edit a Mikoshi launcher tile. Picking a known app fills everything but the address. */
export function ServiceForm({ id, defaults, onDone }: { id?: string; defaults?: Partial<Service>; onDone: () => void }) {
  const existing = useWorkspace((s) => s.services.find((x) => x.id === id))
  const services = useWorkspace((s) => s.services)
  const { create, update, remove } = useWorkspace.getState()
  const base = existing ?? defaults
  // New tiles start on the same host as the last one you added (e.g. your Tailscale name).
  const lastHost = useMemo(() => {
    try {
      return services[0] ? `${new URL(services[0].url).protocol}//${new URL(services[0].url).hostname}` : ""
    } catch {
      return ""
    }
  }, [services])
  const [d, setD] = useState({
    name: base?.name ?? "",
    url: base?.url ?? (lastHost ? `${lastHost}:` : "https://"),
    description: base?.description ?? "",
    group: base?.group ?? "",
    logo: base?.logo ?? "",
    logoTouched: !!base?.logo,
    materialIcon: (base?.materialIcon as ServiceIconName | undefined) ?? "dns",
    pinned: base?.pinned ?? false,
    urlTouched: !!base?.url,
  })
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }))
  const groups = [...new Set(services.map((s) => s.group).filter(Boolean))]
  const logoSlug = (d.logoTouched ? d.logo : slugify(d.name)).trim()
  const logo = useLogo(logoSlug || undefined)
  const url = d.url.trim()
  const urlBad = !/^https?:\/\/[^\s/:]+(:\d{1,5})?(\/\S*)?$/i.test(url)

  const pick = (name: string) => {
    const app = KNOWN_APPS.find((a) => a.name === name)
    if (app) set({ name: app.name, logo: app.logo, logoTouched: true, description: d.description || app.description, group: d.group || app.group })
  }

  const save = () => {
    const values = {
      name: d.name.trim(),
      url,
      description: d.description.trim(),
      group: d.group.trim() || "Services",
      logo: logo.url ? logoSlug : undefined,
      materialIcon: d.materialIcon,
      pinned: d.pinned,
    }
    if (existing) {
      update("services", existing.id, values)
      toast.success(`${values.name} updated`)
    } else {
      create("services", values)
      toast.success(`${values.name} added to Mikoshi`)
    }
    onDone()
  }

  return (
    <FormFrame
      title={existing ? `Edit ${existing.name}` : "New service"}
      onSubmit={save}
      submitLabel={existing ? "Save" : "Add service"}
      canSubmit={d.name.trim().length > 0 && !urlBad}
      onDelete={existing ? () => (remove("services", existing.id), toast(`${existing.name} removed`), onDone()) : undefined}
    >
      {!existing && (
        <Field label="Start from a known app" htmlFor="svc-pick" hint="Fills the name, logo, what it is and a group. Optional.">
          <OptionSelect id="svc-pick" value="none" onChange={pick} options={[{ value: "none", label: "Choose an app…" }, ...KNOWN_APPS.map((a) => ({ value: a.name, label: a.name }))]} className="w-full" />
        </Field>
      )}
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Name" htmlFor="svc-name">
          <Input id="svc-name" autoFocus={!!existing} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Portainer" />
        </Field>
        <Field label="What it is" htmlFor="svc-desc">
          <Input id="svc-desc" value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Containers" maxLength={40} />
        </Field>
      </div>
      <Field label="Address" htmlFor="svc-url" hint="Opens in a new tab. Your Tailscale name with the port works from anywhere." error={d.urlTouched && url && urlBad ? "Start with http:// or https:// and use a host, an optional :port and path." : undefined}>
        <Input id="svc-url" type="url" value={d.url} onChange={(e) => set({ url: e.target.value })} onBlur={() => set({ urlTouched: true })} placeholder="https://mikoshi.example.ts.net:9443" />
      </Field>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Group" htmlFor="svc-group" hint="Tiles with the same group sit together.">
          <Input id="svc-group" list="svc-groups" value={d.group} onChange={(e) => set({ group: e.target.value })} placeholder="e.g. Infrastructure" maxLength={32} />
          <datalist id="svc-groups">{[...new Set([...groups, "Infrastructure", "Apps", "AI", "Media"])].map((g) => <option key={g} value={g} />)}</datalist>
        </Field>
        <Field
          label="Logo"
          htmlFor="svc-logo"
          hint={!logoSlug ? "A dashboard-icons name, e.g. portainer." : logo.loading ? "Looking it up…" : logo.url ? "Found in dashboard-icons. Your server keeps a copy." : "Not found in dashboard-icons: the icon below is used."}
        >
          <div className="flex items-center gap-2">
            <ServiceLogo service={{ name: d.name, logo: logo.url ? logoSlug : undefined, materialIcon: d.materialIcon }} size={32} />
            <Input id="svc-logo" className="font-mono" value={d.logoTouched ? d.logo : slugify(d.name)} onChange={(e) => set({ logo: e.target.value.toLowerCase(), logoTouched: true })} placeholder="portainer" maxLength={64} />
          </div>
        </Field>
      </div>
      <Field label="Icon without a logo" htmlFor="svc-icon-dns">
        <div role="radiogroup" aria-label="Icon without a logo" data-category="mikoshi" className="flex flex-wrap gap-1.5">
          {(Object.keys(SERVICE_ICONS) as ServiceIconName[]).map((name) => (
            <button
              key={name}
              id={`svc-icon-${name}`}
              type="button"
              role="radio"
              aria-checked={d.materialIcon === name}
              aria-label={name.replace(/_/g, " ")}
              title={name.replace(/_/g, " ")}
              onClick={() => set({ materialIcon: name })}
              className={cn("flex size-8 items-center justify-center rounded-[7px] bg-well text-muted-foreground hover:text-ink", d.materialIcon === name && "text-[var(--bw-category)] ring-2 ring-[var(--bw-category)]")}
            >
              <ServiceGlyph name={name} style={{ width: 18, height: 18 }} />
            </button>
          ))}
        </div>
      </Field>
      <div className="flex items-center gap-2">
        <Switch id="svc-pinned" checked={d.pinned} onCheckedChange={(pinned) => set({ pinned })} />
        <Label htmlFor="svc-pinned" className="text-xs font-normal">Pin to the top row</Label>
      </div>
    </FormFrame>
  )
}
