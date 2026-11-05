import { Download, Hammer, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"
import { cn } from "@/lib/utils"
import { SettingRow } from "./settings-pages"

/** Where the installed Mac app's own updater answers (see desktop/src/main/native-workspace.ts). */
export const inMacApp = () => typeof location !== "undefined" && location.protocol === "bw-native:"

export type MacUpdateStatus = { version: string } & (
  | { state: "idle" }
  | { state: "checking" }
  | { state: "current"; checkedAt: number; nothingPublished?: boolean }
  | { state: "available"; latest: string; notes?: string; canInstall: boolean; cantInstallReason?: string }
  | { state: "downloading"; latest: string; received: number; total: number }
  | { state: "installing"; latest: string }
  | { state: "error"; message: string }
)

async function call(action: "status" | "check" | "install"): Promise<MacUpdateStatus> {
  const res = await fetch(`/__mac/update/${action}`, { method: action === "status" ? "GET" : "POST", headers: { "X-Blackwall": "1" } })
  if (!res.ok) throw new Error("The Mac app's updater didn't answer.")
  return res.json()
}

export type SourceUpdateStatus =
  | { state: "idle"; canUpdate: boolean; cantUpdateReason?: string; repo: string | null; note?: string }
  | { state: "working"; step: string }
  | { state: "current"; commit: string }
  | { state: "restarting"; commit: string }
  | { state: "error"; message: string }

async function callSource(action: "" | "/start" | "/dismiss"): Promise<SourceUpdateStatus> {
  const res = await fetch(`/__mac/update/source${action}`, { method: action === "" ? "GET" : "POST", headers: { "X-Blackwall": "1" } })
  if (!res.ok) throw new Error("The Mac app's updater didn't answer.")
  return res.json()
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`

/** Settings → About, Mac app only: rebuild the app from the local repo checkout and swap it in (no release needed). */
function SourceUpdateRow() {
  const [status, setStatus] = useState<SourceUpdateStatus | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const run = useCallback((action: "" | "/start" | "/dismiss") => {
    callSource(action)
      .then((s) => (setStatus(s), setFailed(null)))
      .catch((e: Error) => setFailed(e.message))
  }, [])

  useEffect(() => run(""), [run])
  const active = status?.state === "working" || status?.state === "restarting"
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => run(""), 500)
    return () => clearInterval(timer)
  }, [active, run])

  let title: ReactNode = "Update from source"
  let description: ReactNode = "Pulls the latest code from your repo, builds it and replaces this app. Takes a minute or two; Blackwall closes and reopens."
  let actions: ReactNode = null
  let tone: "plain" | "ok" | "error" = "plain"
  const startButton = (label = "Update now") => (
    <Button variant="outline" onClick={() => run("/start")}>
      <Hammer /> {label}
    </Button>
  )

  if (failed) {
    tone = "error"
    description = failed
  } else if (status) {
    switch (status.state) {
      case "idle":
        if (status.note) {
          tone = "ok"
          description = status.note
        }
        actions = status.canUpdate ? startButton() : null
        if (!status.canUpdate) description = status.cantUpdateReason
        break
      case "working":
        title = (
          <span className="flex items-center gap-2">
            <RefreshCw className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
            {status.step}…
          </span>
        )
        description = "Blackwall stays open and usable until the new app is ready."
        break
      case "restarting":
        title = `Installing ${status.commit}…`
        description = "Blackwall will close and reopen in a few seconds."
        break
      case "current":
        tone = "ok"
        title = "Already up to date"
        description = `Built from ${status.commit}, the latest code in your repo.`
        actions = (
          <Button variant="outline" onClick={() => run("/dismiss")}>
            OK
          </Button>
        )
        break
      case "error":
        tone = "error"
        title = "Update didn't finish"
        description = status.message
        actions = startButton("Try again")
        break
    }
  }

  return (
    <div role="status" aria-live="polite">
      <SettingRow
        keywords="mac app update from source build local repo pull rebuild"
        title={
          <span className="flex items-center gap-2">
            {tone !== "plain" && <span className={cn("size-2 shrink-0", tone === "ok" && "bg-green", tone === "error" && "bg-[var(--bw-red)]")} aria-hidden />}
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

/** Settings → About, inside the Mac app only: check, download and install a newer Blackwall for Mac. */
export function MacUpdatePanel() {
  const [status, setStatus] = useState<MacUpdateStatus | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const run = useCallback((action: "status" | "check" | "install") => {
    call(action)
      .then((s) => (setStatus(s), setFailed(null)))
      .catch((e: Error) => setFailed(e.message))
  }, [])

  useEffect(() => run("status"), [run])
  // While something is happening, follow it; nothing else polls.
  const active = status?.state === "checking" || status?.state === "downloading" || status?.state === "installing"
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => run("status"), 500)
    return () => clearInterval(timer)
  }, [active, run])

  const checkButton = (label = "Check for updates") => (
    <Button variant="outline" disabled={status?.state === "checking"} onClick={() => run("check")}>
      <RefreshCw className={cn(status?.state === "checking" && "animate-spin motion-reduce:animate-none")} /> {status?.state === "checking" ? "Checking…" : label}
    </Button>
  )

  let title: ReactNode = "Blackwall for Mac"
  let description: ReactNode = "See whether a newer Mac build is published on your server."
  let actions: ReactNode = checkButton()
  let tone: "plain" | "ok" | "warn" | "error" = "plain"

  if (failed) {
    tone = "error"
    title = "Couldn't reach the updater"
    description = failed
  } else if (status) {
    const version = status.version
    switch (status.state) {
      case "current":
        tone = "ok"
        title = "You're up to date"
        description = status.nothingPublished ? `Version ${version}. No newer Mac build has been published yet.` : `Version ${version}. Checked just now.`
        actions = checkButton("Check again")
        break
      case "available":
        tone = "warn"
        title = `Version ${status.latest} is available`
        description = status.canInstall ? (
          <>You have {version}. Blackwall will close and reopen when it's installed.{status.notes ? <> {status.notes}</> : null}</>
        ) : (
          <span className="text-red-text">{status.cantInstallReason}</span>
        )
        actions = status.canInstall ? (
          <Button onClick={() => run("install")}>
            <Download /> Download and install
          </Button>
        ) : (
          checkButton("Check again")
        )
        break
      case "downloading":
        title = (
          <span className="flex items-center gap-2">
            <RefreshCw className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
            Downloading {status.latest}…
          </span>
        )
        description = status.total ? `${mb(status.received)} of ${mb(status.total)} (${Math.floor((status.received / status.total) * 100)}%)` : mb(status.received)
        actions = null
        break
      case "installing":
        title = `Installing ${status.latest}…`
        description = "Blackwall will close and reopen in a few seconds."
        actions = null
        break
      case "error":
        tone = "error"
        title = "Update didn't finish"
        description = status.message
        actions = checkButton("Try again")
        break
      case "checking":
        title = "Checking…"
        description = `Asking your server about a newer build than ${version}.`
        break
      case "idle":
        description = `You have version ${version}. See whether a newer Mac build is published on your server.`
        break
    }
  }

  return (
    <Panel title="Blackwall for Mac" tool="blackwall" command="mac-update" bodyClassName="divide-y divide-line">
      <div role="status" aria-live="polite">
        <SettingRow
          keywords="mac app update version check upgrade install download dmg"
          title={
            <span className="flex items-center gap-2">
              {tone !== "plain" && <span className={cn("size-2 shrink-0", tone === "ok" && "bg-green", tone === "warn" && "bg-amber", tone === "error" && "bg-[var(--bw-red)]")} aria-hidden />}
              {title}
            </span>
          }
          description={<span className={cn(tone === "error" && "text-red-text")}>{description}</span>}
        >
          {actions}
        </SettingRow>
      </div>
      <SourceUpdateRow />
    </Panel>
  )
}
