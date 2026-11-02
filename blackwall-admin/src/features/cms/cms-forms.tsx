import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { SECTIONS, SECTION_ORDER, TEMPLATES, rid, section } from "@shared/sitebuilder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Field, OptionSelect } from "@/components/forms/fields"
import { FormFrame } from "@/components/forms/form-frame"
import { sitePageHref } from "@/lib/routes"
import type { SiteForm, SiteFormField } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { createSite, useCurrentSite } from "./use-cms"

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** New site: a name, a domain and one of Pagesmith's templates. */
export function NewSiteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [template, setTemplate] = useState("portal")
  return (
    <FormFrame
      title="New site"
      submitLabel="Create site"
      canSubmit={name.trim().length > 0}
      onSubmit={() => {
        createSite(name.trim(), template, domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, ""))
        toast.success(`${name.trim()} created`, { description: "Edit its pages, then publish from the Pages tab." })
        onDone()
      }}
    >
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Site name" htmlFor="site-name"><Input id="site-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BCnD Labs" /></Field>
        <Field label="Domain" htmlFor="site-domain" hint="Optional for now."><Input id="site-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="bcndlabs.dev" /></Field>
      </div>
      <Field label="Start from" htmlFor="tpl-portal">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TEMPLATES).map(([k, t]) => (
            <button key={k} id={`tpl-${k}`} type="button" role="radio" aria-checked={template === k} onClick={() => setTemplate(k)}
              className={cn("rounded-xl bg-raised px-3 py-2.5 text-left", template === k && "ring-2 ring-[var(--bw-red)]")}>
              <span className="block text-[13px] font-semibold text-ink">{t.name}</span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">{t.about}</span>
              <span className="mt-1 block text-[11px] text-faint">{t.pages.map((p) => p.title).join(" · ")}</span>
            </button>
          ))}
        </div>
      </Field>
    </FormFrame>
  )
}

/** New page on the current site: title, address and a first section. */
export function NewPageForm({ onDone }: { onDone: () => void }) {
  const site = useCurrentSite()
  const pages = useWorkspace((s) => s.pages.filter((p) => p.siteId === site?.id))
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [touched, setTouched] = useState(false)
  const [start, setStart] = useState("plainText")
  const [inMenu, setInMenu] = useState(true)
  const finalSlug = slugify(touched ? slug : title)
  const clash = pages.some((p) => p.slug === finalSlug)
  if (!site) return null
  return (
    <FormFrame
      title="New page"
      submitLabel="Create page"
      canSubmit={!!title.trim() && !!finalSlug && !clash}
      onSubmit={() => {
        const p = useWorkspace.getState().create("pages", { siteId: site.id, title: title.trim(), slug: finalSlug, description: "", inMenu, order: pages.length, sections: start === "blank" ? [] : [section(start)] })
        onDone()
        navigate(sitePageHref(p.id))
      }}
    >
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Title" htmlFor="page-title"><Input id="page-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Projects" /></Field>
        <Field label="Address" htmlFor="page-slug" error={clash ? "Another page uses that address." : undefined}>
          <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span><Input id="page-slug" className="font-mono" value={touched ? slug : slugify(title)} onChange={(e) => { setTouched(true); setSlug(e.target.value) }} placeholder="projects" /></div>
        </Field>
      </div>
      <Field label="Start with" htmlFor="page-start">
        <OptionSelect id="page-start" value={start} onChange={setStart} options={[{ value: "blank", label: "An empty page" }, ...SECTION_ORDER.map((k) => ({ value: k, label: SECTIONS[k].name }))]} className="w-full" />
      </Field>
      <div className="flex items-center gap-2"><Switch id="page-menu" checked={inMenu} onCheckedChange={setInMenu} /><Label htmlFor="page-menu" className="text-xs font-normal">Show in the site menu</Label></div>
    </FormFrame>
  )
}

const FIELD_TYPES: { value: SiteFormField["type"]; label: string }[] = [
  { value: "text", label: "Short text" }, { value: "textarea", label: "Long text" }, { value: "email", label: "Email" }, { value: "select", label: "Choice" }, { value: "checkbox", label: "Checkbox" },
]

/** Form library: a reusable form. Email is always collected and verified before a submission counts. */
export function SiteFormForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const existing = useWorkspace((s) => s.forms.find((f) => f.id === id))
  const pages = useWorkspace((s) => s.pages)
  const { create, update, remove } = useWorkspace.getState()
  const [d, setD] = useState<Omit<SiteForm, "id" | "createdAt" | "updatedAt">>(() => existing ?? {
    name: "", submitLabel: "Send", successMessage: "Thanks! Check your email and click the link to confirm.",
    fields: [{ id: "name", label: "Name", type: "text", required: true }, { id: "email", label: "Email", type: "email", required: true }, { id: "message", label: "Message", type: "textarea", required: true }],
  })
  const used = existing ? pages.filter((p) => JSON.stringify(p.sections).includes(existing.id)).length : 0
  const setField = (i: number, patch: Partial<SiteFormField>) => setD((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }))
  return (
    <FormFrame
      title={existing ? `Edit ${existing.name}` : "New form"}
      submitLabel={existing ? "Save" : "Add form"}
      canSubmit={!!d.name.trim() && d.fields.length > 0 && d.fields.every((f) => f.label.trim())}
      onSubmit={() => {
        const values = { ...d, name: d.name.trim(), fields: d.fields.map((f) => ({ ...f, id: f.id || slugify(f.label) || rid("f"), label: f.label.trim() })) }
        if (existing) update("forms", existing.id, values)
        else create("forms", values)
        toast.success(existing ? "Form saved" : "Form added to the library")
        onDone()
      }}
      onDelete={existing ? () => { remove("forms", existing.id); toast(used ? `Form deleted; ${used} page${used === 1 ? "" : "s"} now show "Choose a form"` : "Form deleted"); onDone() } : undefined}
    >
      <Field label="Name" htmlFor="form-name"><Input id="form-name" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Contact" /></Field>
      <Field label="Fields" htmlFor="form-field-0" hint="An email field is always included: every submission is confirmed by email.">
        <ul className="grid gap-1.5">
          {d.fields.map((f, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_8.5rem_auto_auto] items-center gap-1.5">
              <Input id={`form-field-${i}`} value={f.label} onChange={(e) => setField(i, { label: e.target.value, id: f.id && existing ? f.id : slugify(e.target.value) })} placeholder="Label" />
              <OptionSelect label="Type" value={f.type} onChange={(type) => setField(i, { type })} options={FIELD_TYPES} />
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={f.required || f.type === "email"} disabled={f.type === "email"} onChange={(e) => setField(i, { required: e.target.checked })} /> Required</label>
              <Button type="button" variant="quiet" size="icon-sm" aria-label={`Remove ${f.label || "field"}`} onClick={() => setD({ ...d, fields: d.fields.filter((_, j) => j !== i) })}><Trash2 /></Button>
              {f.type === "select" && <Input className="col-span-4" value={(f.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Choices, separated by commas" />}
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-2 self-start" onClick={() => setD({ ...d, fields: [...d.fields, { id: "", label: "", type: "text", required: false }] })}><Plus /> Field</Button>
      </Field>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-[10rem_1fr]">
        <Field label="Button" htmlFor="form-submit"><Input id="form-submit" value={d.submitLabel} onChange={(e) => setD({ ...d, submitLabel: e.target.value })} /></Field>
        <Field label="After sending" htmlFor="form-done"><Input id="form-done" value={d.successMessage} onChange={(e) => setD({ ...d, successMessage: e.target.value })} /></Field>
      </div>
    </FormFrame>
  )
}
