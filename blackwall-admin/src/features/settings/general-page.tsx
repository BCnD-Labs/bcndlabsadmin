import { format, formatDistanceToNowStrict } from "date-fns"
import { Download, ExternalLink, RefreshCw, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { api } from "@/services/connector"
import { clearFeedCache } from "@/services/data"
import { usePrefs } from "@/stores/prefs"
import { WORKSPACE_STORAGE_KEY, useWorkspace } from "@/stores/workspace"
import { ConfirmButton, SettingRow, SettingsPage } from "./settings-pages"

type UpdateState =
  | { state: "idle" }
  | { state: "running" | "accepted"; at: string }
  | { state: "failed"; at: string; message: string }

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
  | { phase: "unchanged" }
  | { phase: "failed"; message: string }

const PAGE_BUILD = __BLACKWALL_BUILD__
const short = (tree?: string) => (tree ? tree.slice(0, 7) : "—")
const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
const POLL_MS = 3000
/** After this long without a restart, start asking GitHub whether there was anything to install. */
const FIRST_CHECK_MS = 45_000
const CHECK_EVERY_MS = 30_000
const GIVE_UP_MS = 10 * 60_000

export function GeneralSettings() {
  return (
    <SettingsPage>
      <AboutPanel />
      <DataPanel />
      <ResetPanel />
    </SettingsPage>
  )
}

function AboutPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let live = true
    api<SystemInfo>("system")
      .then((i) => live && (setInfo(i), setInfoError(null)))
      .catch((e: Error) => live && setInfoError(e.message))
    return () => {
      live = false
    }
  }, [nonce])

  const dev = info?.mode === "development"
  return (
    <Panel tool="blackwall" command="about" bodyClassName="divide-y divide-line">
      {infoError ? (
        <p className="px-3.5 py-3 text-sm text-red-text">Can't reach Blackwall's server: {infoError}</p>
      ) : (
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2 px-3.5 py-3 text-sm">
          <dt className="text-muted-foreground">Version</dt>
          <dd>{dev ? "Development" : info?.build ? <code className="font-mono">{short(info.build.tree)}</code> : info ? "Unknown" : "…"}</dd>
          {info?.build && (
            <>
              <dt className="text-muted-foreground">Built</dt>
              <dd>
                {format(new Date(info.build.builtAt), "MMM d, yyyy 'at' h:mm a")} <span className="text-muted-foreground">· {ago(info.build.builtAt)}</span>
              </dd>
            </>
          )}
          {info?.startedAt && (
            <>
              <dt className="text-muted-foreground">Last restart</dt>
              <dd>{ago(info.startedAt)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Running on</dt>
          <dd>{dev ? "This computer (npm run dev)" : info ? "Home server" : "…"}</dd>
        </dl>
      )}
      {info && <UpdateRow info={info} onRestarted={reload} />}
    </Panel>
  )
}

/** The update line under About: check → (if newer) update → refresh. */
function UpdateRow({ info, onRestarted }: { info: SystemInfo; onRestarted: () => void }) {
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<Progress>({ phase: "idle" })
  const cfg = info.updates

  const runCheck = () => {
    setChecking(true)
    api<UpdateCheck>("system/check?force")
      .then((c) => (setCheck(c), setCheckError(null)))
      .catch((e: Error) => setCheckError(e.message))
      .finally(() => setChecking(false))
  }

  // Pick up an update that's already running (e.g. started from another device).
  if ((info.update?.state === "running" || info.update?.state === "accepted") && info.bootId && progress.phase === "idle") {
    setProgress({ phase: "building", bootId: info.bootId, since: new Date(info.update.at).getTime() })
  }

  // While an update runs: Portainer accepts the webhook at once and builds in the background, so wait
  // for a new server process (bootId). If none comes, ask GitHub whether the running code is already
  // the latest (e.g. the change was outside the app); otherwise give up after GIVE_UP_MS.
  const lastCheckAt = useRef(0)
  useEffect(() => {
    if (progress.phase !== "building" && progress.phase !== "restarting") return
    const { bootId, since } = progress
    const timer = setInterval(async () => {
      const waited = Date.now() - since
      if (waited > GIVE_UP_MS) {
        setProgress({
          phase: "failed",
          message: "Portainer accepted the update but Blackwall hasn't restarted after 10 minutes. Open the blackwall stack in Portainer to see whether the deploy failed.",
        })
        return
      }
      try {
        const now = await api<SystemInfo>("system")
        if (now.bootId && now.bootId !== bootId) {
          setProgress({ phase: "done", tree: now.build?.tree })
          onRestarted()
          return
        }
        if (now.update?.state === "failed") {
          setProgress({ phase: "failed", message: now.update.message })
          return
        }
        if (cfg?.canCheck && waited > FIRST_CHECK_MS && Date.now() - lastCheckAt.current > CHECK_EVERY_MS) {
          lastCheckAt.current = Date.now()
          const c = await api<UpdateCheck>("system/check?force").catch(() => null)
          if (c?.upToDate) {
            setCheck(c)
            setProgress({ phase: "unchanged" })
          }
        }
      } catch {
        // Unreachable while Portainer swaps the container.
        setProgress((p) => (p.phase === "building" ? { ...p, phase: "restarting" } : p))
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [progress, onRestarted, cfg?.canCheck])

  const startUpdate = () => {
    api<{ bootId: string }>("system/update", { method: "POST" })
      .then((r) => setProgress({ phase: "building", bootId: r.bootId, since: Date.now() }))
      .catch((e: Error) => setProgress({ phase: "failed", message: e.message }))
  }

  const refresh = (
    <Button onClick={() => location.reload()}>
      <RefreshCw /> Refresh
    </Button>
  )
  const checkButton = (
    <Button variant="outline" disabled={checking} onClick={runCheck}>
      <RefreshCw className={cn(checking && "animate-spin motion-reduce:animate-none")} /> {checking ? "Checking…" : "Check for updates"}
    </Button>
  )
  const updateButton = cfg?.canUpdate && (
    <Button onClick={startUpdate}>
      <Download /> Update now
    </Button>
  )

  let title: ReactNode = "Updates"
  let description: ReactNode = null
  let actions: ReactNode = null
  let tone: "plain" | "ok" | "warn" | "error" = "plain"

  if (info.mode === "development") {
    description = "Updates run on the home server. Here, pull with git and restart npm run dev."
  } else if (progress.phase === "building" || progress.phase === "restarting") {
    title = (
      <span className="flex items-center gap-2">
        <RefreshCw className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
        {progress.phase === "building" ? "Installing the update…" : "Restarting…"}
      </span>
    )
    description =
      progress.phase === "building"
        ? "Portainer is downloading and building the new version. This usually takes one to three minutes; you can keep using the panel."
        : "Blackwall will be back in a few seconds."
  } else if (progress.phase === "done") {
    tone = "ok"
    title = <>Updated to <code className="font-mono">{short(progress.tree)}</code></>
    description = "Refresh to start using the new version."
    actions = refresh
  } else if (info.build && PAGE_BUILD && info.build.tree !== PAGE_BUILD) {
    tone = "warn"
    title = "A newer version is running"
    description = "This page is from an older version. Refresh to load the new one."
    actions = refresh
  } else if (!cfg?.canCheck && !cfg?.canUpdate) {
    description = info.build ? (
      <>Not set up on this server. Add the <code className="font-mono">BLACKWALL_UPDATE_*</code> settings to the stack (see deploy/README.md).</>
    ) : (
      "This build has no version stamp, so it can't be compared with GitHub."
    )
  } else if (!cfg.canCheck) {
    description = "Pull the latest version from GitHub and restart."
    actions = updateButton
  } else if (progress.phase === "failed") {
    tone = "error"
    title = "Update failed"
    description = progress.message
    actions = <>{checkButton}{updateButton}</>
  } else if (checkError) {
    tone = "error"
    title = "Couldn't check for updates"
    description = checkError
    actions = checkButton
  } else if (check && !check.upToDate) {
    tone = "warn"
    title = "Update available"
    description = (
      <a href={check.latest.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
        {check.latest.message} · {ago(check.latest.date)}
        <ExternalLink className="ml-1 inline size-3" aria-hidden />
      </a>
    )
    actions = updateButton
  } else if (check || progress.phase === "unchanged") {
    tone = "ok"
    title = "You're up to date"
    description = progress.phase === "unchanged" ? "Portainer found nothing in the app to rebuild." : check ? `Checked ${ago(check.checkedAt)}.` : "Nothing new to install."
    actions = checkButton
  } else {
    description = "See whether a newer version is on GitHub."
    actions = checkButton
  }

  return (
    <div role="status" aria-live="polite">
      <SettingRow
        keywords="updates version check upgrade install"
        title={
          <span className="flex items-center gap-2">
            {tone !== "plain" && (
              <span
                className={cn("size-2 shrink-0", tone === "ok" && "bg-green", tone === "warn" && "bg-amber", tone === "error" && "bg-[var(--bw-red)]")}
                aria-hidden
              />
            )}
            {title}
          </span>
        }
        description={<span className={cn(tone === "error" && "text-red-text")}>{description}</span>}
      >
        {actions}
      </SettingRow>
    </div>
  )
}

function DataPanel() {
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
    `${s.tasks?.length ?? 0} tasks, ${s.journal?.length ?? 0} logs, ${s.notes?.length ?? 0} notes, ${s.courses?.length ?? 0} courses`

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
    <Panel tool="workspace" command="data" meta="this browser" bodyClassName="divide-y divide-line">
      <SettingRow title="Export" description="Download your tasks, notes, daily logs and courses as a file. They're saved in this browser only, so keep a copy.">
        <Button variant="outline" onClick={exportData}>
          <Download /> Export
        </Button>
      </SettingRow>
      <SettingRow
        title="Import"
        description={
          pending
            ? `Replace what's here (${describe(useWorkspace.getState() as unknown as Record<string, unknown[]>)}) with the file (${pending.summary})?`
            : "Load an export, for example to move your workspace to another device."
        }
      >
        {pending ? (
          <>
            <Button variant="destructive" onClick={() => void applyImport()}>Replace</Button>
            <Button variant="quiet" onClick={() => setPending(null)}>Cancel</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
        )}
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
      </SettingRow>
    </Panel>
  )
}

function ResetPanel() {
  const resetPrefs = usePrefs((s) => s.reset)
  const clearAll = useWorkspace((s) => s.clearAll)

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
    <Panel tool="blackwall" command="reset" bodyClassName="divide-y divide-line">
      <SettingRow title="Clear cache" description="Reload the page and fetch fresh data from your connections. Nothing you've saved is affected.">
        <Button variant="outline" onClick={clearCache}>Clear cache</Button>
      </SettingRow>
      <SettingRow title="Reset preferences" description="Put appearance, card timing, the sidebar and the Home layout back to their defaults in this browser.">
        <ConfirmButton confirmLabel="Reset" onConfirm={() => (resetPrefs(), toast.success("Preferences reset"))}>Reset</ConfirmButton>
      </SettingRow>
      <SettingRow title="Clear workspace" description="Delete every task, note and daily log in this browser. Export first if you want to keep them.">
        <ConfirmButton danger confirmLabel="Delete everything" onConfirm={() => (clearAll(), toast.success("Workspace cleared"))}>Clear workspace</ConfirmButton>
      </SettingRow>
    </Panel>
  )
}
