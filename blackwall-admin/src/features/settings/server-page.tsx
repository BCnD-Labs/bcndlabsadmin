import { formatDistanceToNowStrict } from "date-fns"
import { LogOut, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { api, useSession } from "@/services/connector"
import { SettingRow, SettingsPage } from "./settings-pages"

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

function Marker({ tone }: { tone: "ok" | "warn" | "error" | "off" }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0", tone === "ok" && "bg-green", tone === "warn" && "bg-amber", tone === "error" && "bg-[var(--bw-red)]", tone === "off" && "bg-faint")}
      aria-hidden
    />
  )
}

/** Where Blackwall's server-side data lives, sign-out, and backup health. */
export function ServerSettings() {
  const { authRequired, logout } = useSession()
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
  const backupTone = !last ? "off" : !last.ok ? "error" : stale ? "warn" : "ok"
  const offsite = last?.offsite ?? "off"

  return (
    <SettingsPage
      actions={
        <Button variant="outline" onClick={() => setNonce((n) => n + 1)}>
          <RotateCw /> Refresh
        </Button>
      }
    >
      {error ? (
        <Panel title="Server status" tool="server" command="status" bodyClassName="px-3.5 py-3 text-sm">
          <p className="text-red-text">Can't reach Blackwall's server: {error}</p>
          <p className="mt-1 text-muted-foreground">The panel still works with the data in this browser.</p>
        </Panel>
      ) : (
        <>
          <Panel title="Server status" tool="server" command="status" meta={health?.database === "ok" ? "database ok" : undefined} bodyClassName="divide-y divide-line">
            <SettingRow
              title="Running on"
              description={onServer ? "Home server. Signing in is required." : "This computer (local development). No sign-in."}
            />
            <SettingRow
              title="Connections stored in"
              description={
                <>
                  <code className="font-mono break-all text-foreground">{health?.store ?? "…"}</code>
                  <span className="block">Tokens and passwords are encrypted before they're stored and never sent to the browser.</span>
                </>
              }
            />
            {onServer && (
              <SettingRow title="Sign out" description="End your session in this browser.">
                <Button variant="outline" onClick={() => void logout()}>
                  <LogOut /> Sign out
                </Button>
              </SettingRow>
            )}
          </Panel>

          <Panel title="Backups" tool="server" command="backups" meta={backups?.configured ? `${backups.count ?? 0} on the server` : undefined} bodyClassName="divide-y divide-line">
            {!backups?.configured ? (
              <SettingRow
                title="Backups"
                description={
                  onServer
                    ? "No backup folder is mounted. Check the backup service in the Portainer stack."
                    : "Backups run on the home server. In local development, connections are only in .blackwall/connections.json."
                }
              />
            ) : (
              <>
                <SettingRow
                  title={
                    <span className="flex items-center gap-2">
                      <Marker tone={backupTone} />
                      Last backup
                    </span>
                  }
                  description={
                    <span className={cn(backupTone === "error" && "text-red-text", backupTone === "warn" && "text-amber")}>
                      {last ? `${last.ok ? "Succeeded" : "Failed"} ${ago(last.at)}${stale ? ". Overdue: backups run every day." : "."}` : "None yet. The first one runs shortly after the stack starts."}
                      {last?.error && <span className="block">{last.error}</span>}
                    </span>
                  }
                />
                <SettingRow
                  title={
                    <span className="flex items-center gap-2">
                      <Marker tone={offsite === "ok" ? "ok" : offsite === "failed" ? "error" : "off"} />
                      Off-site copy
                    </span>
                  }
                  description={
                    <span className={cn(offsite === "failed" && "text-red-text")}>
                      {offsite === "ok"
                        ? `Uploaded to ${last?.offsiteRemote}.`
                        : offsite === "failed"
                          ? `Upload failed${last?.offsiteError ? `: ${last.offsiteError}` : "."}`
                          : "Not set up. Backups stay on the server only (see deploy/README.md to add one)."}
                    </span>
                  }
                />
                {backups.files && backups.files.length > 0 && (
                  <ul className="max-h-56 overflow-y-auto font-mono text-xs" aria-label="Backup files">
                    {backups.files.map((f) => (
                      <li key={f.name} className="flex justify-between gap-3 border-b border-line px-3.5 py-1.5 last:border-0">
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {size(f.bytes)} · {ago(f.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>
        </>
      )}
    </SettingsPage>
  )
}
