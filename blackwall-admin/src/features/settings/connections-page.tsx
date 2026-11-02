import { useNavigate } from "react-router-dom"
import { CategoryIcon } from "@/components/common/category-icon"
import { ACCOUNT_COLORS, ACCOUNT_ICONS, AccountAvatar, MaterialIcon, accountLook, type AccountIconName } from "@/components/accounts/account-appearance"
import { DEVELOPMENT, postsHref, siteAnalyticsHref } from "@/lib/routes"
import { CONNECTION_GUIDANCE } from "./connection-guidance"
import { ChevronRight, Loader2, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useUi } from "@/stores/ui"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field, OptionSelect } from "@/components/forms/fields"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import {
  APPEARANCE_KEYS,
  CUSTOM_PREFIX,
  PROVIDERS,
  providerDef,
  visibleFields,
  type ConnectionStatus,
  type FieldDef,
  type ProviderId,
  type PublicConnection,
} from "@shared/connections"
import { Panel } from "@/components/common/panel"
import { SettingsPage } from "./settings-pages"

/**
 * Connection-record status, styled like SourceBadge (sentence case, tinted pill, square marker)
 * so "Connected" looks the same here as on the panels it feeds.
 */
const STATUS: Record<ConnectionStatus, { label: string; square: string; className: string; hint: string }> = {
  ok: { label: "Connected", square: "bg-green", className: "bg-green/12 text-green", hint: "The last test reached the service with these details." },
  error: { label: "Error", square: "bg-red-light", className: "bg-red-soft text-red-light", hint: "The last test failed. Edit the details or test again." },
  untested: { label: "Not tested", square: "bg-faint", className: "bg-ink-2/8 text-muted-foreground", hint: "Saved, but not tested yet. Click Test." },
  saved: { label: "Link only", square: "bg-faint", className: "bg-ink-2/8 text-muted-foreground", hint: "A saved link and details. There is no endpoint to test." },
}

export function ConnectionStatusPill({ status }: { status: ConnectionStatus }) {
  const s = STATUS[status]
  return (
    <span title={s.hint} className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium", s.className)}>
      <span className={cn("size-1.5 rounded-[1.5px]", s.square)} aria-hidden />
      {s.label}
    </span>
  )
}

export function ConnectionsPage() {
  const { available, list, busy, refresh, test, remove } = useConnections()
  const addParam = useUi((s) => s.settings?.add ?? null)
  const [dialog, setDialog] = useState<{ provider?: ProviderId; existing?: PublicConnection } | null>(() =>
    addParam && PROVIDERS.some((p) => p.id === addParam) ? { provider: addParam } : null,
  )
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  // "Connect GitHub" links elsewhere open this section with ?add; open the form once, then forget it.
  useEffect(() => {
    if (addParam) useUi.getState().clearSettingsAdd()
  }, [addParam])

  const runTest = async (c: PublicConnection) => {
    try {
      const r = await test(c.id)
      if (r.status === "ok") toast.success(`${r.label} is connected`)
      else if (r.status === "error") toast.error(`${r.label}: ${r.message ?? "check failed"}`)
      else toast(r.message ?? "Saved")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Linked services first (in their usual order), then the ones still to set up.
  const groups = PROVIDERS.map((p) => ({ def: p, accounts: list.filter((c) => c.provider === p.id) }))
  const linked = groups.filter((g) => g.accounts.length)
  const unlinked = groups.filter((g) => !g.accounts.length)
  const counts = {
    ok: list.filter((c) => c.status === "ok").length,
    error: list.filter((c) => c.status === "error").length,
    other: list.filter((c) => c.status === "untested" || c.status === "saved").length,
  }

  const accountRow = (c: PublicConnection) => {
    const working = busy[c.id]
    const details = c.summary?.length || c.provider === "other" || (c.message && c.status !== "error")
    return (
      <li key={c.id} data-testid="connection-card" className={cn("rounded-[8px] border bg-well/50", c.status === "error" ? "border-red/40" : "border-line")}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-2 pr-1.5 pl-3">
          {c.provider === "github" && <AccountAvatar look={accountLook(c, list.filter((x) => x.provider === "github").findIndex((x) => x.id === c.id))} size={24} />}
          <ConnectionStatusPill status={c.status} />
          <span className="min-w-0 truncate text-[13px] font-medium text-ink">{c.label}</span>
          {c.account && <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{c.account}</span>}
          <span className="text-[11px] text-faint">{c.checkedAt ? `checked ${timeAgo(c.checkedAt)}` : c.status === "saved" ? "" : "never checked"}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {c.status !== "saved" && (
              <Button variant="quiet" onClick={() => runTest(c)} disabled={working} aria-label={`Test ${c.label}`}>
                {working ? <Loader2 className="animate-spin" /> : <RotateCw />} Test
              </Button>
            )}
            <Button size="icon-sm" variant="quiet" aria-label={`Edit ${c.label}`} onClick={() => setDialog({ existing: c })}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="quiet" aria-label={`Remove ${c.label}`} onClick={() => setConfirmRemove(c.id)}>
              <Trash2 />
            </Button>
          </span>
        </div>
        {c.status === "error" && c.message && <p className="border-t border-line-soft px-3 py-2 text-xs break-words text-red-text">{c.message}</p>}
        {details ? (
          <details className="group border-t border-line-soft">
            <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
              Details
            </summary>
            <div className="space-y-1.5 px-3 pb-2.5 text-xs">
              {c.provider === "other" && <OtherDetails c={c} />}
              {c.message && c.status !== "error" && <p className="text-muted-foreground">{c.message}</p>}
              {c.summary?.length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {c.summary.map((s) => (
                    <div key={s.label} className="contents">
                      <dt className="text-muted-foreground">{s.label}</dt>
                      <dd className="min-w-0 break-words">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </details>
        ) : null}
        {confirmRemove === c.id && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-3 py-2 text-xs">
            <span className="text-red-text">Remove {c.label} and its saved secrets?</span>
            <span className="ml-auto flex gap-2">
              <Button variant="quiet" onClick={() => setConfirmRemove(null)}>Keep</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await remove(c.id)
                  setConfirmRemove(null)
                  toast(`${c.label} removed`)
                }}
              >
                Remove
              </Button>
            </span>
          </div>
        )}
      </li>
    )
  }

  const serviceRow = ({ def, accounts }: (typeof groups)[number]) => {
    const guide = CONNECTION_GUIDANCE[def.id]
    const isLinked = accounts.length > 0
    return (
      <li key={def.id} className="px-3.5 py-3">
        <div className="flex items-start gap-3">
          <CategoryIcon category={guide.category} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-semibold text-ink">
              {def.name}
              {!isLinked && <span className="text-[11px] font-normal text-faint">Not linked</span>}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isLinked ? <><span className="text-faint">Feeds </span>{guide.feeds}</> : def.blurb}
            </p>
          </div>
          <Button variant={isLinked ? "quiet" : "outline"} onClick={() => setDialog({ provider: def.id })} aria-label={isLinked ? `Add another ${def.name} connection` : `Set up ${def.name}`}>
            <Plus /> {isLinked ? "Add" : "Set up"}
          </Button>
        </div>
        {isLinked && <ul className="mt-2.5 grid gap-1.5 sm:pl-10" aria-label={`${def.name} connections`}>{accounts.map(accountRow)}</ul>}
      </li>
    )
  }

  return (
    <SettingsPage>

      {available === false && (
        <Alert className="border-amber/50">
          <AlertDescription className="text-foreground">
            Blackwall’s server is unavailable. Check that your installation is running, then retry. Connections require the server; a standalone static page cannot connect to services.
            <Button variant="outline" className="ml-2" onClick={refresh}>
              <RotateCw /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {available && (
        <>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
            <span><strong className="font-semibold text-ink">{linked.length}</strong> of {PROVIDERS.length} services linked</span>
            {counts.ok > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-[1.5px] bg-green" aria-hidden />{counts.ok} connected</span>}
            {counts.error > 0 && <span className="inline-flex items-center gap-1.5 text-red-text"><span className="size-1.5 rounded-[1.5px] bg-red-light" aria-hidden />{counts.error} need attention</span>}
            {counts.other > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-[1.5px] bg-faint" aria-hidden />{counts.other} not tested or link only</span>}
          </p>

          {linked.length > 0 && (
            <Panel title="Linked" tool="connections" command="ls" meta={`${list.length} ${list.length === 1 ? "connection" : "connections"}`} bodyClassName="p-0">
              <ul className="divide-y divide-line">{linked.map(serviceRow)}</ul>
            </Panel>
          )}

          {unlinked.length > 0 && (
            <Panel title={linked.length ? "Available to link" : "Link a service"} tool="connections" command="add" bodyClassName="p-0">
              <ul className="divide-y divide-line">{unlinked.map(serviceRow)}</ul>
            </Panel>
          )}
        </>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          {dialog && (
            <ConnectionForm
              key={dialog.existing?.id ?? dialog.provider ?? "pick"}
              provider={dialog.existing?.provider ?? dialog.provider}
              existing={dialog.existing}
              onPick={(provider) => setDialog({ provider })}
              onDone={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </SettingsPage>
  )
}

/** The details entered for an "Any service" connection. Secrets show only as "saved". */
function OtherDetails({ c }: { c: PublicConnection }) {
  const rows: [string, React.ReactNode][] = []
  if (c.config.url)
    rows.push([
      "URL",
      <a key="url" href={c.config.url} target="_blank" rel="noreferrer" className="break-all text-ink-2 underline-offset-2 hover:text-ink hover:underline">
        {c.config.url}
      </a>,
    ])
  if (c.config.username && !c.account) rows.push(["Account", c.config.username])
  for (const [k, v] of Object.entries(c.config)) if (k.startsWith(CUSTOM_PREFIX)) rows.push([k.slice(CUSTOM_PREFIX.length), v])
  for (const k of Object.keys(c.secrets)) rows.push([k === "secret" ? "Password / key" : k.replace(CUSTOM_PREFIX, ""), <span key={k} className="text-muted-foreground">saved</span>])
  if (c.config.notes) rows.push(["Notes", c.config.notes])
  if (!rows.length) return null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface CustomRow {
  name: string
  value: string
  secret: boolean
  /** Secret already stored under this name (value left blank keeps it). */
  saved?: string
}

function ConnectionForm({
  provider,
  existing,
  onPick,
  onDone,
}: {
  provider?: ProviderId
  existing?: PublicConnection
  onPick: (p: ProviderId) => void
  onDone: () => void
}) {
  const { create, update, busy } = useConnections()

  if (!provider) {
    return (
      <div className="p-4">
        <DialogTitle className="mb-1 font-heading text-base font-bold">Add a connection</DialogTitle>
        <DialogDescription className="mb-3">Pick the kind of service.</DialogDescription>
        <ul className="grid gap-2">
          {PROVIDERS.map((p) => {
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="flex w-full items-start gap-3 rounded-[8px] border border-rim p-3 text-left hover:border-ledge-hi hover:bg-raised"
                >
                  <CategoryIcon category={CONNECTION_GUIDANCE[p.id].category} />
                  <span>
                    <span className="block text-[13px] font-semibold">{p.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{p.blurb}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return <ProviderForm provider={provider} existing={existing} onDone={onDone} create={create} update={update} saving={!!busy[existing?.id ?? "new"]} />
}

function ProviderForm({
  provider,
  existing: initial,
  onDone,
  create,
  update,
  saving,
}: {
  provider: ProviderId
  existing?: PublicConnection
  onDone: () => void
  create: ReturnType<typeof useConnections.getState>["create"]
  update: ReturnType<typeof useConnections.getState>["update"]
  saving: boolean
}) {
  const def = providerDef(provider)
  const guide = CONNECTION_GUIDANCE[provider]
  const allGithub = useConnections((st) => st.list.filter((c) => c.provider === "github"))
  const githubCount = allGithub.length
  const githubIndex = (id: string) => Math.max(0, allGithub.findIndex((c) => c.id === id))
  const navigate = useNavigate()
  const [preparing, setPreparing] = useState(!initial)
  const [complete, setComplete] = useState<PublicConnection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { stepHeading.current?.focus() }, [preparing, complete])
  const working = saving || submitting
  // Becomes the saved record after the first save, so retries update instead of duplicating.
  const [existing, setExisting] = useState(initial)
  const [label, setLabel] = useState(existing?.label ?? def.name)
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const base = { ...(existing?.config ?? {}) }
    for (const f of def.fields) if (f.type === "select" && !base[f.key] && f.options) base[f.key] = f.options[0].value
    return base
  })
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [cleared, setCleared] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<CustomRow[]>(() => {
    if (!existing) return []
    const rows: CustomRow[] = Object.entries(existing.config)
      .filter(([k]) => k.startsWith(CUSTOM_PREFIX))
      .map(([k, v]) => ({ name: k.slice(CUSTOM_PREFIX.length), value: v, secret: false }))
    for (const [k, v] of Object.entries(existing.secrets)) {
      if (k.startsWith(CUSTOM_PREFIX)) rows.push({ name: k.slice(CUSTOM_PREFIX.length), value: "", secret: true, saved: v.hint ?? "saved" })
    }
    return rows
  })
  const [error, setError] = useState<string | null>(existing?.status === "error" ? (existing.message ?? null) : null)

  const fields = visibleFields(def, config)
  const secretSaved = (key: string) => !!existing?.secrets[key]?.set && !cleared.has(key)
  const missing = fields.filter((f) => f.required && (f.secret ? !secrets[f.key] && !secretSaved(f.key) : !config[f.key]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (working) return
    if (!initial && provider === "other" && !config.url?.trim() && !config.healthUrl?.trim()) return setError("Enter a service URL or an HTTP endpoint so this service has something to open or test.")
    if (missing.length) return setError(`Fill in: ${missing.map((f) => f.label).join(", ")}`)
    const visibleKeys = new Set(fields.map((f) => f.key))
    const outConfig: Record<string, string> = {}
    for (const f of fields) if (!f.secret && config[f.key]) outConfig[f.key] = config[f.key]
    // Account appearance (GitHub): not a provider field, so it is carried explicitly.
    for (const key of Object.values(APPEARANCE_KEYS)) if (config[key]) outConfig[key] = config[key]
    const outSecrets: Record<string, string | null> = {}
    for (const f of def.fields) {
      if (!f.secret) continue
      if (!visibleKeys.has(f.key) || cleared.has(f.key)) outSecrets[f.key] = secrets[f.key] || null
      else if (secrets[f.key]) outSecrets[f.key] = secrets[f.key]
    }
    // Custom fields ("Any service")
    const keptCustomSecrets = new Set<string>()
    for (const row of custom) {
      const name = row.name.trim()
      if (!name) continue
      const key = CUSTOM_PREFIX + name
      if (row.secret) {
        keptCustomSecrets.add(key)
        if (row.value) outSecrets[key] = row.value
      } else if (row.value) outConfig[key] = row.value
    }
    for (const k of Object.keys(existing?.secrets ?? {})) {
      if (k.startsWith(CUSTOM_PREFIX) && !keptCustomSecrets.has(k)) outSecrets[k] = null
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = existing
        ? await update(existing.id, { label, config: outConfig, secrets: outSecrets })
        : await create({ provider, label, config: outConfig, secrets: outSecrets })
      setExisting(result)
      setSecrets({})
      setCleared(new Set())
      if (result.status === "error") {
        setError(`Details saved, but the test failed. ${result.message ?? "Check the details below and try Save & test again."}`)
        toast.error(`Saved, but the test failed`)
        return
      }
      toast.success(result.status === "ok" ? `${result.label} connected` : `${result.label} saved`)
      setComplete(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (f: FieldDef) => {
    const id = `conn-${f.key}`
    if (f.type === "select" && f.options) {
      return (
        <Field key={f.key} label={f.label} htmlFor={id} hint={f.help}>
          <OptionSelect id={id} value={config[f.key] ?? f.options[0].value} onChange={(v) => setConfig({ ...config, [f.key]: v })} options={f.options} />
        </Field>
      )
    }
    if (f.secret) {
      const saved = secretSaved(f.key)
      const hint = existing?.secrets[f.key]?.hint
      return (
        <Field
          key={f.key}
          label={f.label + (f.required ? "" : " (optional)")}
          htmlFor={id}
          hint={
            <>
              {saved && (
                <span className="mr-1 text-ink-2">
                  Saved{hint ? ` (${hint})` : ""}.
                  {!f.required && (
                    <button type="button" className="ml-1 text-red-text hover:underline" onClick={() => setCleared(new Set(cleared).add(f.key))}>
                      Remove
                    </button>
                  )}
                </span>
              )}
              {f.help}
            </>
          }
        >
          <Input
            id={id}
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder={saved ? "Leave blank to keep the saved value" : f.placeholder}
            value={secrets[f.key] ?? ""}
            onChange={(e) => setSecrets({ ...secrets, [f.key]: e.target.value })}
          />
        </Field>
      )
    }
    return (
      <Field key={f.key} label={f.label + (f.required ? "" : " (optional)")} htmlFor={id} hint={f.help}>
        <Input
          id={id}
          type={f.type === "url" ? "url" : "text"}
          spellCheck={false}
          placeholder={f.placeholder}
          value={config[f.key] ?? ""}
          onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
        />
      </Field>
    )

  }

  const openDestination = (to: string) => {
    onDone()
    useUi.getState().closeSettings()
    navigate(to)
  }

  if (preparing) return <div className="flex max-h-[85dvh] flex-col">
    <div className="border-b border-line px-4 py-4 pr-12">
      <div className="mb-2 flex items-center gap-2"><CategoryIcon category={guide.category} /><span className="text-xs text-muted-foreground">Step 1 of 3 · Prepare</span></div>
      <DialogTitle ref={stepHeading} tabIndex={-1} className="font-heading text-lg font-bold outline-none">Set up {def.name}</DialogTitle>
      <DialogDescription className="mt-2 text-sm leading-relaxed">{guide.outcome}</DialogDescription>
    </div>
    <div className="space-y-4 overflow-y-auto p-4 text-sm">
      <p className="text-ink-2">{guide.prepare}</p>
      <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {def.help && <a href={def.help.url} target="_blank" rel="noreferrer" className="bw-action-link underline underline-offset-2">{def.help.label} ↗</a>}
    </div>
    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line p-3">
      <Button variant="quiet" onClick={onDone}>Cancel</Button>
      <Button onClick={() => setPreparing(false)}>Continue to connection details</Button>
    </div>
  </div>

  if (complete) return <div className="flex max-h-[85dvh] flex-col">
    <div className="border-b border-line px-4 py-4 pr-12">
      <div className="mb-2 flex items-center gap-2"><CategoryIcon category={guide.category} /><span className="text-xs text-green">{!initial && "Step 3 of 3 · "}{complete.status === "ok" ? "Test passed" : "Saved without an endpoint test"}</span></div>
      <DialogTitle ref={stepHeading} tabIndex={-1} className="font-heading text-lg font-bold outline-none">{complete.label} {complete.status === "ok" ? "connected" : "saved"}</DialogTitle>
      <DialogDescription className="mt-2 text-sm leading-relaxed">{guide.outcome}</DialogDescription>
    </div>
    <div className="space-y-3 overflow-y-auto p-4 text-sm">
      {complete.account && <p>Account: <strong>{complete.account}</strong></p>}
      {complete.message && <p className="text-muted-foreground">{complete.message}</p>}
      {complete.summary?.map((item) => <p key={item.label}><span className="text-muted-foreground">{item.label}: </span>{item.value}</p>)}
      {provider === "github" && <p className="text-xs text-muted-foreground">Next, add the repositories you want to track. Connecting an account does not automatically track all repositories.</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-line p-3">
      <Button variant="outline" onClick={onDone}>Done</Button>
      {provider === "github" && <Button onClick={() => { onDone(); useUi.getState().closeSettings(); navigate(DEVELOPMENT); useUi.getState().openForm({ kind: "repo" }) }}>Track a repository</Button>}
      {provider === "website" && <Button onClick={() => openDestination(postsHref)}>Open posts & pages</Button>}
      {provider === "analytics" && <Button onClick={() => openDestination(siteAnalyticsHref)}>View website traffic</Button>}
    </div>
  </div>

  return (
    <form onSubmit={submit} className="flex max-h-[85dvh] flex-col">
      <div className="border-b border-line py-3 pr-12 pl-4">
        {!initial && <p className="mb-2 text-xs text-muted-foreground">Step 2 of 3 · Enter details & test</p>}
        <DialogTitle ref={stepHeading} tabIndex={-1} className="font-heading text-base font-bold outline-none">{initial ? `Edit ${initial.label}` : `${def.name} connection details`}</DialogTitle>
        <DialogDescription className="mt-1 text-[11px] leading-relaxed">
          {def.blurb}
          {def.help && (
            <>
              {" "}
              <a href={def.help.url} target="_blank" rel="noreferrer" className="text-ink-2 underline underline-offset-2 hover:text-ink">
                {def.help.label} ↗
              </a>
            </>
          )}
        </DialogDescription>
      </div>
      <fieldset disabled={working} className="grid min-h-0 min-w-0 gap-3.5 overflow-y-auto px-4 py-4">
        <Field label="Display name" htmlFor="conn-label" hint="How it appears in Blackwall, e.g. “Work GitHub” or “School VPN”.">
          <Input id="conn-label" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
        {provider === "github" && <AppearancePicker config={config} index={existing ? githubIndex(existing.id) : githubCount} onChange={(patch) => setConfig({ ...config, ...patch })} />}
        {fields.filter((f) => !f.advanced).map(renderField)}
        {fields.some((f) => f.advanced) && <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium">Advanced settings · branch & folders</summary>
          <p className="mt-2 text-xs text-muted-foreground">Defaults work for the standard Blackwall website layout. Change these to match your repository.</p>
          <div className="mt-3 grid gap-3.5">{fields.filter((f) => f.advanced).map(renderField)}</div>
        </details>}

        {provider === "other" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Extra fields</span>
              <Button type="button" variant="outline" onClick={() => setCustom([...custom, { name: "", value: "", secret: false }])}>
                <Plus /> Add field
              </Button>
            </div>
            {custom.map((row, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]">
                <Input
                  aria-label="Field name"
                  placeholder="Name, e.g. Region"
                  value={row.name}
                  onChange={(e) => setCustom(custom.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                />
                <Input
                  aria-label={`${row.name || "Field"} value`}
                  type={row.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={row.saved ? `Saved (${row.saved}), blank keeps it` : "Value"}
                  value={row.value}
                  onChange={(e) => setCustom(custom.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox
                    checked={row.secret}
                    disabled={!!row.saved}
                    onCheckedChange={(v) => setCustom(custom.map((r, j) => (j === i ? { ...r, secret: !!v } : r)))}
                  />
                  Secret
                </label>
                <Button type="button" size="icon-sm" variant="quiet" aria-label="Remove field" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="flex gap-2 rounded-[8px] border border-rim bg-well px-3 py-2.5 text-xs leading-relaxed break-words text-red-text">
            <span className="mt-1 size-1.5 shrink-0 rounded-[1.5px] bg-red" aria-hidden />
            {error}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-well/60 px-4 py-3">
        <span className="text-[11px] text-muted-foreground">{provider === "other" && !config.healthUrl ? "Saves details without an endpoint test." : "Saves details, then tests access."}</span>
        <div className="ml-auto flex gap-2">
          {!initial && <Button type="button" variant="quiet" disabled={working} onClick={() => setPreparing(true)}>Back</Button>}
          <Button type="button" variant="quiet" size="lg" disabled={working} onClick={onDone}>
            {error && existing ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" size="lg" disabled={working}>
            {working && <Loader2 className="animate-spin" />}
            {working ? "Testing…" : provider === "other" && !config.healthUrl ? "Save service" : "Save & test"}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Color + Material Symbol for a GitHub account, used by its avatar and chips across Home. */
function AppearancePicker({ config, index, onChange }: { config: Record<string, string>; index: number; onChange: (patch: Record<string, string>) => void }) {
  const look = accountLook({ config }, index)
  return (
    <fieldset className="grid gap-2.5 rounded-lg border border-line p-3">
      <legend className="px-1 text-[13px] font-medium">Account appearance</legend>
      <div className="flex items-center gap-3">
        <AccountAvatar look={look} size={40} />
        <p className="text-xs leading-relaxed text-muted-foreground">Shown next to this account’s pull requests and repositories, so you can tell accounts apart at a glance.</p>
      </div>
      <div role="radiogroup" aria-label="Account color" className="flex flex-wrap gap-1.5">
        {ACCOUNT_COLORS.map((color) => (
          <button key={color} type="button" role="radio" aria-checked={look.color === color} aria-label={`Color ${color}`} onClick={() => onChange({ [APPEARANCE_KEYS.color]: color })}
            className={cn("size-7 rounded-full outline-offset-2", look.color === color && "outline-2 outline-ink")} style={{ background: color }} />
        ))}
      </div>
      <div role="radiogroup" aria-label="Account icon" className="flex flex-wrap gap-1">
        {(Object.keys(ACCOUNT_ICONS) as AccountIconName[]).map((name) => (
          <button key={name} type="button" role="radio" aria-checked={look.icon === name} aria-label={name.replace(/_/g, " ")} title={name.replace(/_/g, " ")} onClick={() => onChange({ [APPEARANCE_KEYS.icon]: name })}
            className={cn("flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-ink", look.icon === name && "bg-selected text-ink")}>
            <MaterialIcon name={name} className="size-[18px]" style={look.icon === name ? { color: look.color } : undefined} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}
