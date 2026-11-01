import { formatDistanceToNowStrict } from "date-fns"
import { Download, ExternalLink, RefreshCw, RotateCcw, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { api } from "@/services/connector"
import { clearFeedCache } from "@/services/data"
import { usePrefs } from "@/stores/prefs"
import { WORKSPACE_STORAGE_KEY, WORKSPACE_VERSION, useWorkspace } from "@/stores/workspace"
import { SettingsTabs } from "./settings-pages"

type UpdateState =
  | { state: "idle" }
  | { state: "running"; at: string }
  | { state: "unchanged" | "failed"; at: string; message: string }

interface SystemInfo {
  mode: "server" | "development"
  build: { tree: string; builtAt: string } | null
  bootId?: string
  startedAt?: string
  node: string
  updates?: { repo: string; ref: string; path: string; canCheck: boolean; canUpdate: boolean; missing: string[] }
  update?: UpdateState
}

interface UpdateCheck {
  upToDate: boolean
  running: string
  latest: { tree: string; commit: string; message: string; date: string; url: string }
  checkedAt: string
}

/** Where an update started from this page has got to. */
type Progress =
  | { phase: "idle" }
  | { phase: "building"; bootId: string; since: number }
  | { phase: "restarting"; bootId: string; since: number }
  | { phase: "done"; tree?: string }
  | { phase: "unchanged" | "failed" | "timeout"; message: string }

const PAGE_BUILD = __BLACKWALL_BUILD__
const short = (tree?: string) => (tree ? tree.slice(0, 7) : "—")
const ago = (iso?: string) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : "—")
const POLL_MS = 3000
const GIVE_UP_MS = 15 * 60_000

export function GeneralSettings() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const load = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let live = true
    api<SystemInfo>("system")
      .then((i) => live && (setInfo(i), setInfoError(null)))
      .catch((e: Error) => live && setInfoError(e.message))
    return () => {
      live = false
    }
  }, [nonce])

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="grid gap-3 lg:grid-cols-2">
        <AboutPanel info={info} error={infoError} />
        <UpdatesPanel info={info} onChanged={load} />
        <DataPanel />
        <ResetPanel />
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function AboutPanel({ info, error }: { info: SystemInfo | null; error: string | null }) {
  const pageIsOld = !!(info?.build && PAGE_BUILD && info.build.tree !== PAGE_BUILD)
  return (
    <Panel tool="blackwall" command="about" bodyClassName="space-y-3 px-3 py-3 text-sm">
      {error ? (
        <p className="text-red-text">Can't reach Blackwall's server: {error}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <Row label="Running">
            {info?.mode === "development" ? "Local development (npm run dev)" : info?.build ? <code className="font-mono text-xs">{short(info.build.tree)}</code> : info ? "Unknown build" : "…"}
          </Row>
          {info?.build && <Row label="Built">{ago(info.build.builtAt)}</Row>}
          {info?.startedAt && <Row label="Server started">{ago(info.startedAt)}</Row>}
          <Row label="This page">
            {PAGE_BUILD ? <code className="font-mono text-xs">{short(PAGE_BUILD)}</code> : "Development build"}
          </Row>
          {info && <Row label="Node">{info.node}</Row>}
        </dl>
      )}
      {pageIsOld && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber/60 bg-amber/10 px-3 py-2" role="status">
          <span className="flex-1">The server is running a newer version than this page.</span>
          <Button size="sm" onClick={() => location.reload()}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        The version is a fingerprint of the app's files (a Git tree hash), so it matches GitHub when the code is identical.
      </p>
    </Panel>
  )
}

function UpdatesPanel({ info, onChanged }: { info: SystemInfo | null; onChanged: () => void }) {
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<Progress>({ phase: "idle" })
  const cfg = info?.updates

  const fetchCheck = useCallback(
    (force: boolean) =>
      api<UpdateCheck>(`system/check${force ? "?force" : ""}`).then(
        (c) => (setCheck(c), setCheckError(null)),
        (e: Error) => setCheckError(e.message),
      ),
    [],
  )
  const runCheck = (force: boolean) => {
    setChecking(true)
    void fetchCheck(force).finally(() => setChecking(false))
  }

  useEffect(() => {
    if (cfg?.canCheck) void fetchCheck(false)
  }, [cfg?.canCheck, fetchCheck])

  // Pick up an update that's already running (e.g. started from another device).
  if (info?.update?.state === "running" && info.bootId && progress.phase === "idle") {
    setProgress({ phase: "building", bootId: info.bootId, since: new Date(info.update.at).getTime() })
  }

  // While an update runs: poll until the server restarts (new bootId) or reports it's finished.
  useEffect(() => {
    if (progress.phase !== "building" && progress.phase !== "restarting") return
    const { bootId, since } = progress
    const timer = setInterval(async () => {
      if (Date.now() - since > GIVE_UP_MS) {
        setProgress({ phase: "timeout", message: "This is taking longer than expected. Check the blackwall stack in Portainer." })
        return
      }
      try {
        const now = await api<SystemInfo>("system")
        if (now.bootId && now.bootId !== bootId) {
          setProgress({ phase: "done", tree: now.build?.tree })
          onChanged()
        } else if (now.update?.state === "unchanged") {
          setProgress({ phase: "unchanged", message: now.update.message })
        } else if (now.update?.state === "failed") {
          setProgress({ phase: "failed", message: now.update.message })
        }
        // Otherwise the same process is still building: keep waiting.
      } catch {
        // Unreachable while Portainer swaps the container.
        setProgress((p) => (p.phase === "building" ? { ...p, phase: "restarting" } : p))
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [progress, onChanged])

  const startUpdate = async () => {
    try {
      const r = await api<{ bootId: string }>("system/update", { method: "POST" })
      setProgress({ phase: "building", bootId: r.bootId, since: Date.now() })
    } catch (e) {
      setProgress({ phase: "failed", message: (e as Error).message })
    }
  }

  const busy = progress.phase === "building" || progress.phase === "restarting"

  if (info?.mode === "development") {
    return (
      <Panel tool="blackwall" command="update" bodyClassName="px-3 py-3 text-sm text-muted-foreground">
        Updates run on the home server. Here, pull the latest code with git and restart <code className="font-mono text-xs">npm run dev</code>.
      </Panel>
    )
  }

  return (
    <Panel
      tool="blackwall"
      command="update"
      meta={check ? `checked ${ago(check.checkedAt)}` : undefined}
      bodyClassName="space-y-3 px-3 py-3 text-sm"
    >
      {/* Status */}
      {progress.phase === "done" ? (
        <div className="space-y-2 rounded-md border border-line bg-well px-3 py-2" role="status">
          <p>
            Updated{progress.tree ? <> to <code className="font-mono text-xs">{short(progress.tree)}</code></> : ""}. Refresh to load the new version.
          </p>
          <Button size="sm" onClick={() => location.reload()}>
            <RefreshCw /> Refresh now
          </Button>
        </div>
      ) : busy ? (
        <div className="flex items-start gap-2 rounded-md border border-line bg-well px-3 py-2" role="status" aria-live="polite">
          <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
          <div>
            <p>{progress.phase === "building" ? "Portainer is pulling and building the new version…" : "Restarting Blackwall…"}</p>
            <p className="text-xs text-muted-foreground">
              {progress.phase === "building" ? "This usually takes a minute or two. The panel keeps working meanwhile." : "The panel will be unavailable for a few seconds."}
            </p>
          </div>
        </div>
      ) : progress.phase !== "idle" ? (
        <p className={cn(progress.phase === "unchanged" ? "text-muted-foreground" : "text-red-text")} role="status">
          {progress.message}
        </p>
      ) : null}

      {!busy && progress.phase !== "done" && (
        <>
          {!cfg?.canCheck ? (
            <p className="text-muted-foreground">
              {info?.build ? "Checking for updates isn't set up." : "This build has no version stamp, so it can't be compared with GitHub."}
            </p>
          ) : checkError ? (
            <p className="text-red-text">Couldn't check: {checkError}</p>
          ) : check ? (
            check.upToDate ? (
              <p>
                <span className="mr-1.5 inline-block size-2 bg-green" aria-hidden />
                Up to date with <code className="font-mono text-xs">{cfg.ref}</code>.
              </p>
            ) : (
              <div className="space-y-1">
                <p>
                  <span className="mr-1.5 inline-block size-2 bg-amber" aria-hidden />
                  An update is available.
                </p>
                <p className="text-muted-foreground">
                  Latest change, {ago(check.latest.date)}:{" "}
                  <a href={check.latest.url} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                    {check.latest.message}
                    <ExternalLink className="ml-1 inline size-3" aria-hidden />
                  </a>
                </p>
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Checking…</p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {cfg?.canCheck && (
          <Button size="sm" variant="outline" disabled={checking || busy} onClick={() => runCheck(true)}>
            <RefreshCw className={cn(checking && "animate-spin motion-reduce:animate-none")} /> Check for updates
          </Button>
        )}
        {cfg?.canUpdate && progress.phase !== "done" && (
          <Button size="sm" variant={check?.upToDate ? "outline" : "default"} disabled={busy} onClick={() => void startUpdate()}>
            <Download /> {check && !check.upToDate ? "Update now" : "Update"}
          </Button>
        )}
      </div>

      {cfg && cfg.missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          To turn this on, add {cfg.missing.map((m, i) => (
            <span key={m}>
              {i > 0 && " and "}
              <code className="font-mono">{m}</code>
            </span>
          ))}{" "}
          to the stack's environment variables in Portainer (see <code className="font-mono">deploy/README.md</code>).
        </p>
      )}
      {cfg?.canUpdate && (
        <p className="text-xs text-muted-foreground">
          Update asks Portainer to pull <code className="font-mono">{cfg.ref}</code> from GitHub, rebuild and restart the stack. Your data and backups are kept.
        </p>
      )}
    </Panel>
  )
}

function DataPanel() {
  const clearAll = useWorkspace((s) => s.clearAll)
  const [confirm, setConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ raw: unknown; summary: string } | null>(null)

  const exportData = () => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? "{}"
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `blackwall-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const describe = (s: Record<string, unknown[] | undefined>) =>
    `${s.tasks?.length ?? 0} tasks, ${s.journal?.length ?? 0} logs, ${s.notes?.length ?? 0} notes`

  const readImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed?.state || typeof parsed.version !== "number") throw new Error("Not a Blackwall export")
      setPending({ raw: parsed, summary: describe(parsed.state) })
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`)
    }
  }

  const applyImport = async () => {
    if (!pending) return
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(pending.raw))
    await useWorkspace.persist.rehydrate()
    setPending(null)
    toast.success("Workspace imported")
  }

  return (
    <Panel tool="workspace" command="data">
      <div className="space-y-2 px-3 py-3 text-sm">
        <p>
          Tasks, notes, daily logs, projects, repositories and drafts are saved in this browser (
          <code className="font-mono text-xs">{WORKSPACE_STORAGE_KEY}</code>, v{WORKSPACE_VERSION}). They don't sync between browsers or
          devices yet, so export a copy now and then. Importing on another device copies them there.
        </p>
      </div>
      {pending && (
        <div className="space-y-2 border-t bg-recessed/50 px-3 py-3 text-sm" role="alert">
          <p>
            Replace what's here now ({describe(useWorkspace.getState() as unknown as Record<string, unknown[]>)}) with the file ({pending.summary})?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportData}><Download /> Export current first</Button>
            <Button size="sm" variant="destructive" onClick={applyImport}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-3">
        <Button size="sm" variant="outline" onClick={exportData}><Download /> Export</Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void readImport(f)
            e.target.value = ""
          }}
        />
        {confirm ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-sm text-red-text">Delete everything?</span>
            <Button size="sm" variant="destructive" onClick={() => { clearAll(); setConfirm(false); toast.success("Workspace cleared") }}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" className="ml-auto text-red-text" onClick={() => setConfirm(true)}>Clear workspace</Button>
        )}
      </div>
    </Panel>
  )
}

function ResetPanel() {
  const reset = usePrefs((s) => s.reset)
  const [confirm, setConfirm] = useState(false)

  const clearCache = () => {
    clearFeedCache()
    try {
      sessionStorage.clear()
    } catch {
      /* storage blocked */
    }
    location.reload()
  }

  return (
    <Panel tool="blackwall" command="reset">
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-bold">Clear cache and reload</p>
          <p className="text-muted-foreground">Drops data fetched from your connections and reloads the page from the server. Tasks, notes and settings stay.</p>
        </div>
        <Button size="sm" variant="outline" onClick={clearCache}>
          <RefreshCw /> Clear cache
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t px-3 py-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-bold">Reset preferences</p>
          <p className="text-muted-foreground">Workspace name, appearance, card auto-hide, sample data and the Home layout go back to their defaults in this browser. Your data stays.</p>
        </div>
        {confirm ? (
          <span className="flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={() => { reset(); setConfirm(false); toast.success("Preferences reset") }}>Reset</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
    </Panel>
  )
}
