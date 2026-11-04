import { Download, RefreshCw } from "lucide-react"
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

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`

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
    </Panel>
  )
}
