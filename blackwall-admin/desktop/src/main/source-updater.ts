import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, accessSync, constants } from "node:fs"
import path from "node:path"

/**
 * "Update from source": the no-release way to update the Mac app. One button in Settings runs a
 * shell script that pulls the latest code in your local checkout of the repo, installs
 * dependencies when the lock file changed, builds a fresh Blackwall.app, and swaps it in for the
 * installed one. No disk image, no release, no server involved.
 *
 * The build runs while the app stays open (the page shows each step). Only when the new app is
 * ready does the app quit; the script then swaps the apps and reopens Blackwall. If anything
 * fails before the quit, the app just says so. If it fails after, the old app is put back and
 * reopened, and the reason is shown in Settings the next time (source-update-result.txt).
 *
 * It builds the same bundle id and product name as the installed app, so settings, server address
 * and sign-in carry over. (Running from source instead would be a separate "Blackwall Dev" app.)
 */

export type SourceUpdateStatus =
  | { state: "idle"; canUpdate: boolean; cantUpdateReason?: string; repo: string | null; note?: string }
  | { state: "working"; step: string }
  | { state: "current"; commit: string }
  | { state: "restarting"; commit: string }
  | { state: "error"; message: string }

export interface SourceUpdaterHost {
  /** The local checkout of the repo, or null if none is configured. */
  repo(): string | null
  /** The installed Blackwall.app folder, or null when running from source (nothing to replace). */
  bundlePath(): string | null
  pid: number
  /** Parent folder for the work folder (a fresh sub-folder is made inside it). */
  tempDir(): string
  /** A folder that survives between runs (the app's userData): holds the last result and build stamps. */
  stateDir(): string
  /** Starts the script so it outlives this process. */
  launch(script: string, args: string[]): void
  quit(): void
}

const QUIT_DELAY_MS = 600
const RESULT_FILE = "source-update-result.txt"

export class SourceUpdater {
  private status: SourceUpdateStatus
  private work: string | null = null
  private quitting = false
  private readonly host: SourceUpdaterHost

  constructor(host: SourceUpdaterHost) {
    this.host = host
    this.status = this.idle(this.takeLastResult())
  }

  /** What the previous run left behind (a failure after the app had quit), shown once. */
  private takeLastResult(): { error?: string; note?: string } {
    const file = path.join(this.host.stateDir(), RESULT_FILE)
    try {
      const text = readFileSync(file, "utf8").trim()
      rmSync(file, { force: true })
      if (text.startsWith("FAILED")) return { error: text.replace(/^FAILED:?\s*/, "") }
      if (text.startsWith("OK")) return { note: `Updated to ${text.slice(2).trim() || "the latest code"}.` }
    } catch {
      // no earlier run
    }
    return {}
  }

  /** Whether an update can run here, and if not, why in plain words. */
  private target(): { ok: true; repo: string; bundle: string } | { ok: false; reason: string; repo: string | null } {
    const repo = this.host.repo()
    if (!repo) return { ok: false, reason: "No local checkout of the repo was found.", repo }
    if (!existsSync(path.join(repo, ".git")) || !existsSync(path.join(repo, "blackwall-admin", "desktop", "package.json"))) {
      return { ok: false, reason: `${repo} isn't a checkout of the Blackwall repo. Clone it there, or set BLACKWALL_REPO.`, repo }
    }
    const bundle = this.host.bundlePath()
    if (!bundle) return { ok: false, reason: "This is a development run. Updates replace the installed Blackwall app.", repo }
    try {
      accessSync(path.dirname(bundle), constants.W_OK)
    } catch {
      return { ok: false, reason: `Blackwall can't replace itself in ${path.dirname(bundle)}. Move it to your Applications folder and open it from there.`, repo }
    }
    return { ok: true, repo, bundle }
  }

  private idle(last: { error?: string; note?: string } = {}): SourceUpdateStatus {
    if (last.error) return { state: "error", message: last.error }
    const t = this.target()
    return { state: "idle", canUpdate: t.ok, cantUpdateReason: t.ok ? undefined : t.reason, repo: t.repo, note: last.note }
  }

  /** The current status; while a run is going it follows the script's progress file. */
  current(): SourceUpdateStatus {
    if (this.status.state === "working" && this.work) this.follow(this.work)
    return this.status
  }

  private follow(work: string) {
    let lines: string[] = []
    try {
      lines = readFileSync(path.join(work, "status"), "utf8").split("\n").filter(Boolean)
    } catch {
      return // the script hasn't written anything yet
    }
    const last = lines[lines.length - 1] ?? ""
    const [kind, ...rest] = last.split(" ")
    const text = rest.join(" ")
    if (kind === "STEP") this.status = { state: "working", step: text }
    else if (kind === "UPTODATE") this.finish({ state: "current", commit: text })
    else if (kind === "FAILED") this.finish({ state: "error", message: text })
    else if (kind === "READY" && !this.quitting) {
      this.quitting = true
      this.status = { state: "restarting", commit: text }
      writeFileSync(path.join(work, "go"), "")
      setTimeout(() => this.host.quit(), QUIT_DELAY_MS)
    }
  }

  private finish(status: SourceUpdateStatus) {
    this.status = status
    this.work = null
  }

  /** Starts an update. Never throws; progress and errors are in the status. */
  start(): SourceUpdateStatus {
    if (this.status.state === "working" || this.status.state === "restarting") return this.current()
    const t = this.target()
    if (!t.ok) {
      this.status = { state: "error", message: t.reason }
      return this.status
    }
    try {
      this.work = mkdtempSync(path.join(this.host.tempDir(), "blackwall-source-update-"))
      this.quitting = false
      const script = path.join(this.work, "update.sh")
      writeFileSync(script, SOURCE_UPDATE_SCRIPT, { mode: 0o700 })
      this.status = { state: "working", step: "Starting" }
      this.host.launch(script, [String(this.host.pid), t.repo, t.bundle, this.work, this.host.stateDir()])
    } catch (e) {
      if (this.work) rmSync(this.work, { recursive: true, force: true })
      this.work = null
      this.status = { state: "error", message: e instanceof Error ? e.message : String(e) }
    }
    return this.status
  }

  /** Back to the resting state (after the page has shown a result). */
  dismiss(): SourceUpdateStatus {
    if (this.status.state === "current" || this.status.state === "error") this.status = this.idle()
    return this.current()
  }
}

/**
 * Arguments: pid, repo, installed app, work folder, state folder, and optionally the command that
 * opens an app (a test swaps in a stub). Progress goes to <work>/status, the full log to
 * <work>/update.log. PATH gets the usual Homebrew/npm folders appended because an app opened from
 * the Dock doesn't have your shell's PATH.
 */
export const SOURCE_UPDATE_SCRIPT = `#!/bin/sh
PID="$1"; REPO="$2"; APP="$3"; WORK="$4"; STATE="$5"; OPEN="\${6:-/usr/bin/open}"
exec >"$WORK/update.log" 2>&1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin"
STATUS="$WORK/status"
NEW="$APP.update-new"
OLD="$APP.update-old"
QUIT=0
say() { echo "$*" >>"$STATUS"; }
fail() {
  echo "FAILED: $1"
  rm -rf "$NEW"
  if [ "$QUIT" = 1 ]; then
    [ -d "$OLD" ] && [ ! -d "$APP" ] && mv "$OLD" "$APP"
    echo "FAILED: $1" >"$STATE/source-update-result.txt"
    [ -d "$APP" ] && "$OPEN" "$APP"
  else
    say "FAILED $1"
  fi
  exit 1
}
# Runs a command; on failure stops with its last two lines of output in the message.
must() { LABEL="$1"; shift; OUT=$("$@" 2>&1); CODE=$?; echo "$OUT"; [ "$CODE" = 0 ] || fail "$LABEL: $(echo "$OUT" | tail -n 2 | tr '\\n' ' ')"; }
# A fingerprint of what the installed app was built from (the app's own file is part of it, so
# reinstalling from a disk image later doesn't look up to date).
stamp() { echo "$(git rev-parse --short HEAD) $(git status --porcelain | shasum | cut -c1-8) $(stat -f %m "$APP/Contents/Resources/app.asar" 2>/dev/null)"; }

cd "$REPO" || fail "couldn't open $REPO"
command -v git >/dev/null || fail "git isn't installed"
command -v npm >/dev/null || fail "npm isn't installed (looked in /opt/homebrew/bin, /usr/local/bin and ~/.npm-global/bin)"

say "STEP Getting the latest code"
must "git pull didn't work (uncommitted changes, or this branch has no upstream?)" git pull --ff-only
COMMIT=$(git rev-parse --short HEAD)

if [ -f "$STATE/source-build-stamp" ] && [ "$(stamp)" = "$(cat "$STATE/source-build-stamp")" ]; then
  say "UPTODATE $COMMIT"
  exit 0
fi

cd "$REPO/blackwall-admin" || fail "couldn't open the blackwall-admin folder"
LOCK=$(shasum package-lock.json | cut -c1-16)
if [ ! -d node_modules ] || [ "$LOCK" != "$(cat "$STATE/source-lock-stamp" 2>/dev/null)" ]; then
  say "STEP Installing packages"
  must "npm install failed" npm install --no-save --no-audit --no-fund
  echo "$LOCK" >"$STATE/source-lock-stamp"
fi

say "STEP Building the app"
rm -rf release/mac release/mac-arm64
must "the build failed" npm run desktop:build -- --dir
BUILT="$REPO/blackwall-admin/release/mac-arm64/Blackwall.app"
[ -d "$BUILT" ] || BUILT="$REPO/blackwall-admin/release/mac/Blackwall.app"
[ -d "$BUILT" ] || fail "the build didn't produce Blackwall.app"
/usr/bin/codesign --verify --deep --strict "$BUILT" || fail "the new app's signature is not valid"
ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$BUILT/Contents/Info.plist")
[ "$ID" = "dev.bcndlabs.blackwall" ] || fail "the new app has a different id ($ID)"

say "READY $COMMIT"
i=0; while [ ! -f "$WORK/go" ]; do i=$((i+1)); [ "$i" -gt 600 ] && fail "the app never closed, so nothing was replaced"; sleep 0.5; done
QUIT=1
i=0; while kill -0 "$PID" 2>/dev/null; do i=$((i+1)); [ "$i" -gt 120 ] && fail "the app didn't quit"; sleep 0.5; done
rm -rf "$NEW" "$OLD"
/usr/bin/ditto "$BUILT" "$NEW" || fail "couldn't copy the new app"
mv "$APP" "$OLD" || fail "couldn't move the old app aside"
mv "$NEW" "$APP" || fail "couldn't put the new app in place"
rm -rf "$OLD"
cd "$REPO" && stamp >"$STATE/source-build-stamp"
echo "OK $COMMIT" >"$STATE/source-update-result.txt"
echo "OK"
"$OPEN" "$APP"
`
