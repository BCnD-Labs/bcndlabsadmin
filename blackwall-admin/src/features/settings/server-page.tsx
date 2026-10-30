import { formatDistanceToNowStrict } from "date-fns"
import { Archive, CloudUpload, Database, LogOut, RotateCw, Server } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { api, useSession } from "@/services/connector"
import { SettingsTabs } from "./settings-pages"

interface Health {
  ok: boolean
  store: string
  database?: string
}
interface Backups {
  configured: boolean
  count?: number
  files?: { name: string; bytes: number; at: string }[]
  status?: { at: string; ok: boolean; file?: string; error?: string; offsite?: "ok" | "failed" | "off"; offsiteRemote?: string; offsiteError?: string }
}

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
const size = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`)

/** Where Blackwall's server-side data lives, sign-out, and backup health. */
export function ServerSettings() {
  const { state, authRequired, logout } = useSession()
  const [health, setHealth] = useState<Health | null>(null)
  const [backups, setBackups] = useState<Backups | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([api<Health>("health"), api<Backups>("backups")])
      .then(([h, b]) => live && (setHealth(h), setBackups(b), setError(null)))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [nonce])

  const onServer = authRequired
  const last = backups?.status
  const stale = last ? Date.now() - new Date(last.at).getTime() > 36 * 3600_000 : false

  return (
    <>
      <PageHeader title="Settings" actions={<Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}><RotateCw /> Refresh</Button>} />
      <SettingsTabs />
      {state === "offline" || error ? (
        <div className="brutal max-w-xl rounded-xl bg-card p-4 text-sm">
          <p className="text-red-text">Can't reach Blackwall's server{error ? `: ${error}` : "."}</p>
          <p className="mt-1 text-muted-foreground">The panel still works with the data in this browser.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Server" icon={<Server />} accent="teal" bodyClassName="space-y-2 px-3 py-3 text-sm">
            <p>
              <span className="text-muted-foreground">Mode </span>
              {onServer ? "Home server (sign-in required)" : "Local development (this computer only)"}
            </p>
            <p className="flex items-center gap-1.5">
              <Database className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Connections stored in </span>
              <code className="font-mono text-xs break-all">{health?.store ?? "…"}</code>
            </p>
            <p className="text-muted-foreground">
              Tokens and passwords are encrypted before they're stored and never sent to the browser. Tasks, notes and logs are still saved in each browser.
            </p>
            {onServer && (
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut /> Sign out
              </Button>
            )}
          </Panel>

          <Panel title="Backups" icon={<Archive />} accent="amber" bodyClassName="space-y-3 px-3 py-3 text-sm">
            {!backups?.configured ? (
              <p className="text-muted-foreground">
                {onServer
                  ? "No backup folder is mounted. Check the backup service in the Portainer stack."
                  : "Backups run on the home server. In local development your connections are only in .blackwall/connections.json."}
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-muted-foreground">Last backup</dt>
                  <dd className={cn(!last ? "text-muted-foreground" : !last.ok || stale ? "text-red-text" : "text-teal")}>
                    {last ? `${last.ok ? "OK" : "Failed"} · ${ago(last.at)}${stale ? " (overdue)" : ""}` : "None yet"}
                    {last?.error && <span className="block text-xs">{last.error}</span>}
                  </dd>
                  <dt className="text-muted-foreground">Local copies</dt>
                  <dd>{backups.count ?? 0} on the server</dd>
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <CloudUpload className="size-3.5" aria-hidden /> Off-site
                  </dt>
                  <dd className={cn(last?.offsite === "ok" ? "text-teal" : last?.offsite === "failed" ? "text-red-text" : "text-muted-foreground")}>
                    {last?.offsite === "ok" ? `Uploaded to ${last.offsiteRemote}` : last?.offsite === "failed" ? `Upload failed${last.offsiteError ? `: ${last.offsiteError}` : ""}` : "Not set up"}
                  </dd>
                </dl>
                {backups.files && backups.files.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto rounded-md border-2 border-edge bg-recessed font-mono text-xs">
                    {backups.files.map((f) => (
                      <li key={f.name} className="flex justify-between gap-3 border-b border-border px-2 py-1 last:border-0">
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-muted-foreground">{size(f.bytes)} · {ago(f.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
