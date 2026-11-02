import { BarChart3, Cloud, GitBranch, Globe, Loader2, Pencil, Plug, Plus, RotateCw, Shield, Trash2, X, type LucideIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
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
  CUSTOM_PREFIX,
  PROVIDERS,
  providerDef,
  visibleFields,
  type ConnectionStatus,
  type ProviderId,
  type PublicConnection,
} from "@shared/connections"
import { Panel } from "@/components/common/panel"
import { SettingRow, SettingsPage } from "./settings-pages"

export const PROVIDER_ICON: Record<ProviderId, LucideIcon> = {
  github: GitBranch,
  azure: Cloud,
  cloudflare: Shield,
  analytics: BarChart3,
  website: Globe,
  other: Plug,
}

/** Same shape as SourceBadge: a small square marker and a caps label (spec §6: green = healthy, red = failed). */
const STATUS: Record<ConnectionStatus, { label: string; square: string; text: string }> = {
  ok: { label: "Connected", square: "bg-green", text: "text-ink-2" },
  error: { label: "Error", square: "bg-red", text: "text-red-text" },
  untested: { label: "Not tested", square: "bg-faint", text: "text-muted-foreground" },
  saved: { label: "Saved", square: "bg-faint", text: "text-muted-foreground" },
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const s = STATUS[status]
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-bold tracking-[0.03em] uppercase bg-ink-2/8", s.text)}>
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

  return (
    <SettingsPage>

      {available === false && (
        <Alert className="border-amber/50">
          <AlertDescription className="text-foreground">
            The local connector isn't responding. It runs inside <code className="font-mono text-xs">npm run dev</code> and{" "}
            <code className="font-mono text-xs">npm run preview</code>; a static build has no connector.
            <Button variant="outline" className="ml-2" onClick={refresh}>
              <RotateCw /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {available && list.length > 0 && (
        <ul className="grid gap-3" aria-label="Connections">
          {list.map((c) => {
            const working = busy[c.id]
            return (
              <li key={c.id} data-testid="connection-card">
                <Panel
                  title={c.label}
                  tool={providerDef(c.provider).name.toLowerCase()}
                  command={c.label}
                  badge={<StatusPill status={c.status} />}
                  actions={
                    <>
                      <Button variant="quiet" onClick={() => runTest(c)} disabled={working}>
                        {working ? <Loader2 className="animate-spin" /> : <RotateCw />} Test
                      </Button>
                      <Button size="icon-sm" variant="quiet" aria-label={`Edit ${c.label}`} onClick={() => setDialog({ existing: c })}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="quiet" aria-label={`Remove ${c.label}`} onClick={() => setConfirmRemove(c.id)}>
                        <Trash2 />
                      </Button>
                    </>
                  }
                  bodyClassName="divide-y divide-line"
                >
                  <div className="space-y-1.5 px-3.5 py-3 text-sm">
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
                  <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground">
                    {c.checkedAt ? `Checked ${timeAgo(c.checkedAt)}` : "Never checked"}
                    {confirmRemove === c.id && (
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        <span className="text-red-text">Remove this connection and its saved secrets?</span>
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
                        <Button variant="quiet" onClick={() => setConfirmRemove(null)}>
                          Keep
                        </Button>
                      </span>
                    )}
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}

      {available && (
        <Panel title="Add a connection" tool="connections" command={list.length ? "add another" : "add"} bodyClassName="divide-y divide-line">
          {PROVIDERS.map((p) => {
            const Icon = PROVIDER_ICON[p.id]
            return (
              <SettingRow
                key={p.id}
                title={
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {p.name}
                  </span>
                }
                description={p.blurb}
              >
                <Button variant="outline" onClick={() => setDialog({ provider: p.id })} aria-label={`Connect ${p.name}`}>
                  <Plus /> Connect
                </Button>
              </SettingRow>
            )
          })}
        </Panel>
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
            const Icon = PROVIDER_ICON[p.id]
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="flex w-full items-start gap-3 rounded-[8px] border border-rim p-3 text-left hover:border-ledge-hi hover:bg-raised"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-faint" strokeWidth={1.8} aria-hidden />
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
      <div className="border-b border-line py-3 pr-12 pl-4">
        <DialogTitle className="font-heading text-base font-bold">{existing ? `Edit ${existing.label}` : `Connect ${def.name}`}</DialogTitle>
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
      <div className="grid gap-3.5 overflow-y-auto px-4 py-4">
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
        })}

        {provider === "other" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Extra fields</span>
              <Button type="button" variant="outline" onClick={() => setCustom([...custom, { name: "", value: "", secret: false }])}>
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
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-well/60 px-4 py-3">
        <span className="text-[11px] text-muted-foreground">Saving runs a connection test.</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="quiet" size="lg" onClick={onDone}>
            {error && existing ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {existing ? "Save" : "Connect"}
          </Button>
        </div>
      </div>
    </form>
  )
}
