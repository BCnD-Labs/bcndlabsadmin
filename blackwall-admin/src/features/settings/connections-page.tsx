import {
  BarChart3,
  Cloud,
  GitBranch,
  Loader2,
  Pencil,
  Plug,
  Plus,
  RotateCw,
  Shield,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/common/panel"
import { Field, OptionSelect } from "@/components/forms/fields"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import {
  CUSTOM_PREFIX,
  PROVIDERS,
  providerDef,
  visibleFields,
  type ConnectionStatus,
  type ProviderId,
  type PublicConnection,
} from "@shared/connections"
import { SettingsTabs } from "./settings-pages"

export const PROVIDER_ICON: Record<ProviderId, LucideIcon> = {
  github: GitBranch,
  azure: Cloud,
  cloudflare: Shield,
  analytics: BarChart3,
  other: Plug,
}

const STATUS: Record<ConnectionStatus, { label: string; className: string }> = {
  ok: { label: "Connected", className: "border-teal/50 text-teal" },
  error: { label: "Error", className: "border-red/60 text-red-text" },
  untested: { label: "Not tested", className: "border-border text-muted-foreground" },
  saved: { label: "Saved", className: "border-border text-muted-foreground" },
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const s = STATUS[status]
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full border-2 px-2 font-mono text-[0.65rem] tracking-wide uppercase", s.className)}>
      {s.label}
    </span>
  )
}

export function ConnectionsPage() {
  const { available, list, busy, refresh, test, remove } = useConnections()
  const [params, setParams] = useSearchParams()
  const addParam = params.get("add") as ProviderId | null
  const [dialog, setDialog] = useState<{ provider?: ProviderId; existing?: PublicConnection } | null>(() =>
    addParam && PROVIDERS.some((p) => p.id === addParam) ? { provider: addParam } : null,
  )
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  // Deep links like /settings/connections?add=github open the form once; drop the param afterwards.
  useEffect(() => {
    if (addParam) setParams({}, { replace: true })
  }, [addParam, setParams])

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

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          available && (
            <Button onClick={() => setDialog({})}>
              <Plus /> Add connection
            </Button>
          )
        }
      />
      <SettingsTabs />

      <p className="mb-3 max-w-prose text-sm text-muted-foreground">
        Passwords, tokens and private links go to Blackwall's server, which stores them encrypted (on the home server, in
        Postgres; in local development, in <code className="font-mono text-xs">.blackwall/connections.json</code>). They aren't kept in
        the browser and aren't shown again after you save.
      </p>

      {available === false && (
        <Alert className="mb-3 border-amber/50">
          <AlertDescription className="text-foreground">
            The local connector isn't responding. It runs inside <code className="font-mono text-xs">npm run dev</code> and{" "}
            <code className="font-mono text-xs">npm run preview</code>; a static build has no connector.
            <Button size="sm" variant="outline" className="ml-2" onClick={refresh}>
              <RotateCw /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {available && list.length > 0 && (
        <ul className="mb-4 grid gap-3 lg:grid-cols-2" aria-label="Connections">
          {list.map((c) => {
            const Icon = PROVIDER_ICON[c.provider]
            const working = busy[c.id]
            return (
              <li key={c.id} className="flex flex-col brutal rounded-xl bg-card" data-testid="connection-card">
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-edge bg-recessed/70 px-3 py-2">
                  <Icon className="size-4 text-teal" aria-hidden />
                  <h2 className="font-heading text-sm font-bold tracking-wide uppercase">{c.label}</h2>
                  {c.label !== providerDef(c.provider).name && (
                    <span className="text-xs text-muted-foreground">{providerDef(c.provider).name}</span>
                  )}
                  <StatusPill status={c.status} />
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => runTest(c)} disabled={working}>
                      {working ? <Loader2 className="animate-spin" /> : <RotateCw />} Test
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.label}`} onClick={() => setDialog({ existing: c })}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${c.label}`} className="text-red-text" onClick={() => setConfirmRemove(c.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 px-3 py-2.5 text-sm">
                  {c.account && (
                    <p>
                      <span className="text-muted-foreground">Account </span>
                      {c.account}
                    </p>
                  )}
                  {c.provider === "other" && <OtherDetails c={c} />}
                  {c.message && <p className={c.status === "error" ? "break-words text-red-text" : "text-muted-foreground"}>{c.message}</p>}
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
                  {!c.account && !c.message && !c.summary?.length && c.provider !== "other" && <p className="text-muted-foreground">Not tested yet.</p>}
                </div>
                <div className="flex items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
                  {c.checkedAt ? `Checked ${timeAgo(c.checkedAt)}` : "Never checked"}
                  {confirmRemove === c.id && (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-red-text">Remove this connection and its saved secrets?</span>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={async () => {
                          await remove(c.id)
                          setConfirmRemove(null)
                          toast(`${c.label} removed`)
                        }}
                      >
                        Remove
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Keep
                      </Button>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {available && (
        <section aria-labelledby="add-heading">
          <h2 id="add-heading" className="eyebrow mb-2">
            {list.length ? "Add another" : "Connect a service"}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {PROVIDERS.map((p) => {
              const Icon = PROVIDER_ICON[p.id]
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setDialog({ provider: p.id })}
                    className="flex h-full w-full items-start gap-3 rounded-xl border-2 border-dashed border-edge bg-card/60 p-3 text-left outline-none hover:border-teal/60 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                    <span>
                      <span className="block text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.blurb}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
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
    </>
  )
}

/** The details entered for an "Any service" connection. Secrets show only as "saved". */
function OtherDetails({ c }: { c: PublicConnection }) {
  const rows: [string, React.ReactNode][] = []
  if (c.config.url)
    rows.push([
      "URL",
      <a key="url" href={c.config.url} target="_blank" rel="noreferrer" className="break-all text-teal hover:underline">
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
        <DialogTitle className="mb-1 text-base font-bold">Add a connection</DialogTitle>
        <DialogDescription className="mb-3">Pick the kind of service.</DialogDescription>
        <ul className="grid gap-2">
          {PROVIDERS.map((p) => {
            const Icon = PROVIDER_ICON[p.id]
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="flex w-full items-start gap-3 rounded-md border p-2.5 text-left outline-none hover:border-teal/60 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                  <span>
                    <span className="block text-sm font-bold">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.blurb}</span>
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
    if (missing.length) return setError(`Fill in: ${missing.map((f) => f.label).join(", ")}`)
    const visibleKeys = new Set(fields.map((f) => f.key))
    const outConfig: Record<string, string> = {}
    for (const f of fields) if (!f.secret && config[f.key]) outConfig[f.key] = config[f.key]
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

    try {
      const result = existing
        ? await update(existing.id, { label, config: outConfig, secrets: outSecrets })
        : await create({ provider, label, config: outConfig, secrets: outSecrets })
      setExisting(result)
      setSecrets({})
      setCleared(new Set())
      if (result.status === "error") {
        setError(result.message ?? "The connection test failed.")
        toast.error(`Saved, but the test failed`)
        return
      }
      toast.success(result.status === "ok" ? `${result.label} connected` : `${result.label} saved`)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-h-[85dvh] flex-col">
      <div className="border-b px-4 py-3">
        <DialogTitle className="text-base font-bold">{existing ? `Edit ${existing.label}` : `Connect ${def.name}`}</DialogTitle>
        <DialogDescription className="mt-0.5 text-xs">
          {def.blurb}
          {def.help && (
            <>
              {" "}
              <a href={def.help.url} target="_blank" rel="noreferrer" className="text-teal hover:underline">
                {def.help.label} ↗
              </a>
            </>
          )}
        </DialogDescription>
      </div>
      <div className="grid gap-3 overflow-y-auto px-4 py-4">
        <Field label="Name" htmlFor="conn-label" hint="How it appears in Blackwall, e.g. “Work GitHub” or “School VPN”.">
          <Input id="conn-label" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
        {fields.map((f) => {
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
                      <span className="mr-1 text-teal">
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
        })}

        {provider === "other" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Extra fields</span>
              <Button type="button" size="xs" variant="outline" onClick={() => setCustom([...custom, { name: "", value: "", secret: false }])}>
                <Plus /> Add field
              </Button>
            </div>
            {custom.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2">
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
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove field" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red/50 bg-red/10 px-2.5 py-2 text-sm break-words text-red-text">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 border-t bg-recessed/60 px-4 py-3">
        <span className="text-xs text-muted-foreground">Saving runs a connection test.</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            {error && existing ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {existing ? "Save" : "Connect"}
          </Button>
        </div>
      </div>
    </form>
  )
}
