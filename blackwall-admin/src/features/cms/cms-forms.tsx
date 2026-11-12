import { Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { PAGE_KINDS, TEMPLATES, importHtml, mk, nameFirstHeading, rid, section, slugify } from "@shared/sitebuilder"
import { pageFromTask } from "@shared/site-links"
import { withLink } from "@shared/links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field, OptionSelect } from "@/components/forms/fields"
import { FormFrame } from "@/components/forms/form-frame"
import { cmsPagesHref, sitePageHref } from "@/lib/routes"
import type { SiteForm, SiteFormField } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/stores/workspace"
import { createSite, createSiteFromSite, useCurrentSite } from "./use-cms"

export { slugify }

/** New site: a name, a domain and a starting point (one of Pagesmith's templates, or a site you kept as a template). */
export function NewSiteForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const sites = useWorkspace((s) => s.sites)
  const pageCount = useWorkspace((s) => s.pages)
  const mine = useMemo(() => sites.filter((x) => x.template), [sites])
  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [template, setTemplate] = useState("portal")
  const own = template.startsWith("mine:") ? mine.find((x) => x.id === template.slice(5)) : undefined
  return (
    <FormFrame
      title="New site"
      submitLabel="Create site"
      canSubmit={name.trim().length > 0}
      onSubmit={() => {
        const host = domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
        if (own) createSiteFromSite(name.trim(), own.id, host)
        else createSite(name.trim(), template, host)
        toast.success(`${name.trim()} created`, { description: "Follow the checklist to finish it." })
        onDone()
        navigate(cmsPagesHref)
      }}
    >
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Site name" htmlFor="site-name"><Input id="site-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BCnD Labs" /></Field>
        <Field label="Domain" htmlFor="site-domain" hint="Optional: you can add it later."><Input id="site-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="bcndlabs.dev" /></Field>
      </div>
      <Field label="Start from" htmlFor="tpl-portal" hint="Everything can be changed afterwards: pages, sections, colors.">
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
      {mine.length > 0 && (
        <Field label="My templates" htmlFor={`tpl-mine-${mine[0].id}`} hint="Sites you kept as templates in their Settings.">
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {mine.map((t) => (
              <button key={t.id} id={`tpl-mine-${t.id}`} type="button" role="radio" aria-checked={template === `mine:${t.id}`} onClick={() => setTemplate(`mine:${t.id}`)}
                className={cn("rounded-xl bg-raised px-3 py-2.5 text-left", template === `mine:${t.id}` && "ring-2 ring-[var(--bw-red)]")}>
                <span className="block text-[13px] font-semibold text-ink">{t.name}</span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">{t.templateAbout || "A copy of this site's look and pages."}</span>
                <span className="mt-1 block text-[11px] text-faint">{pageCount.filter((p) => p.siteId === t.id).map((p) => p.title).join(" · ")}</span>
              </button>
            ))}
          </div>
        </Field>
      )}
    </FormFrame>
  )
}

/** New page on the current site: what kind of page, its title and address, or an existing page pasted in as HTML. */
export function NewPageForm({ onDone }: { onDone: () => void }) {
  const site = useCurrentSite()
  const allPages = useWorkspace((s) => s.pages)
  const pages = useMemo(() => allPages.filter((p) => p.siteId === site?.id), [allPages, site?.id])
  const navigate = useNavigate()
  const [kind, setKind] = useState(() => Object.keys(PAGE_KINDS).find((k) => PAGE_KINDS[k].slug && !pages.some((p) => p.slug === PAGE_KINDS[k].slug)) ?? "blank")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [touched, setTouched] = useState(false)
  const [inMenu, setInMenu] = useState(true)
  const [html, setHtml] = useState("")
  const imported = kind === "import" ? importHtml(html) : null
  const k = PAGE_KINDS[kind]
  const shownTitle = title || (imported ? imported.title : k?.title ?? "")
  const finalSlug = slugify(touched ? slug : shownTitle || k?.slug || "")
  const clash = pages.some((p) => p.slug === finalSlug)
  if (!site) return null
  return (
    <FormFrame
      title="New page"
      submitLabel="Create page"
      canSubmit={!!shownTitle.trim() && !!finalSlug && !clash && (kind !== "import" || !!imported?.body)}
      onSubmit={() => {
        const sections = kind === "import" ? [mk("section", {}, [mk("html", { code: imported!.body })])] : nameFirstHeading((k?.sections ?? []).map(section), shownTitle.trim())
        const p = useWorkspace.getState().create("pages", { siteId: site.id, title: shownTitle.trim(), slug: finalSlug, description: imported?.description ?? "", inMenu, order: Math.max(-1, ...pages.map((x) => x.order)) + 1, sections })
        onDone()
        navigate(sitePageHref(p.id))
      }}
    >
      <Field label="What kind of page?" htmlFor="kind-about" hint="It arrives with sections already laid out; you fill them in.">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {[...Object.entries(PAGE_KINDS).map(([id, v]) => ({ id, name: v.name, about: v.about })), { id: "import", name: "Paste a page", about: "Bring over a page from an existing site as HTML." }].map((o) => (
            <button key={o.id} id={`kind-${o.id}`} type="button" role="radio" aria-checked={kind === o.id} onClick={() => { setKind(o.id); setTouched(false); setTitle("") }} className={cn("rounded-xl bg-raised px-3 py-2 text-left", kind === o.id && "ring-2 ring-[var(--bw-red)]")}>
              <span className="block text-[13px] font-semibold text-ink">{o.name}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{o.about}</span>
            </button>
          ))}
        </div>
      </Field>
      {kind === "import" && (
        <Field label="The page's HTML" htmlFor="page-html" hint={imported?.body ? `Found ${imported.body.length.toLocaleString()} characters of content${imported.title ? ` titled “${imported.title}”` : ""}. The site's own header, footer and scripts are left out.` : "Open the page in your browser, view its source, and paste all of it here."}>
          <Textarea id="page-html" rows={5} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" placeholder="<!doctype html>…" />
        </Field>
      )}
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Title" htmlFor="page-title"><Input id="page-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={shownTitle || "e.g. Projects"} /></Field>
        <Field label="Address" htmlFor="page-slug" error={clash ? "Another page uses that address." : undefined}>
          <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span><Input id="page-slug" className="font-mono" value={touched ? slug : finalSlug} onChange={(e) => { setTouched(true); setSlug(e.target.value) }} placeholder="projects" /></div>
        </Field>
      </div>
      <div className="flex items-center gap-2"><Switch id="page-menu" checked={inMenu} onCheckedChange={setInMenu} /><Label htmlFor="page-menu" className="text-xs font-normal">Show in the site menu</Label></div>
    </FormFrame>
  )
}

/** Create page from this task: pick the site and kind; the title, course and week come from the task, and the two stay linked. */
export function PageFromTaskForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const task = useWorkspace((s) => s.tasks.find((t) => t.id === taskId))
  const course = useWorkspace((s) => s.courses.find((c) => c.id === task?.courseId))
  const sites = useWorkspace((s) => s.sites)
  const pages = useWorkspace((s) => s.pages)
  const current = useCurrentSite()
  const navigate = useNavigate()
  const [siteId, setSiteId] = useState(current?.id ?? "")
  const [kind, setKind] = useState(task?.courseId ? "assignment" : "blank")
  if (!task) return null
  return (
    <FormFrame title="Create page from this task" submitLabel="Create page" canSubmit={!!siteId}
      onSubmit={() => {
        const { create, update } = useWorkspace.getState()
        const made = create("pages", { ...pageFromTask(task, course, kind, pages.filter((p) => p.siteId === siteId)), siteId })
        update("tasks", task.id, { recordLinks: withLink(task.recordLinks, { kind: "page", id: made.id }, true) })
        toast.success("Page created and linked to the task")
        onDone()
        navigate(sitePageHref(made.id))
      }}>
      {sites.length ? (
        <>
          <p className="text-[13px] text-ink-2">“{task.title}”{course ? ` · ${course.code}` : ""}</p>
          <Field label="Site" htmlFor="pft-site"><OptionSelect id="pft-site" value={siteId} onChange={setSiteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} className="w-full" /></Field>
          <Field label="Kind of page" htmlFor="pft-kind" hint="It stays out of the site's menu until you add it."><OptionSelect id="pft-kind" value={kind} onChange={setKind} options={Object.entries(PAGE_KINDS).map(([value, k]) => ({ value, label: k.name }))} className="w-full" /></Field>
        </>
      ) : <p className="text-[13px] text-muted-foreground">Make a website first, then a page can start from this task.</p>}
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
