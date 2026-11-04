import { createHash } from "node:crypto"
import { accessSync, constants, createWriteStream, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import { DMG_NAME, versionCode, type MacManifest } from "../shared/release.ts"

/**
 * The Mac app's own "check for updates": asks the configured Blackwall server for the newest Mac
 * build (published with desktop/scripts/publish.ts), downloads the disk image from the server,
 * checks its sha256, and hands over to a small shell script that waits for the app to quit, swaps
 * the new Blackwall.app in and reopens it.
 *
 * Electron's built-in autoUpdater is not an option: it needs a Developer ID signature and this app
 * is ad-hoc signed. So nothing is trusted beyond what the Android updates already trust: the
 * server you configured (reached over your tailnet) and the checksum its manifest carries.
 */

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "current"; checkedAt: number; nothingPublished?: boolean }
  | { state: "available"; latest: string; notes?: string; canInstall: boolean; cantInstallReason?: string }
  | { state: "downloading"; latest: string; received: number; total: number }
  | { state: "installing"; latest: string }
  | { state: "error"; message: string }

export type UpdateStatusWithVersion = UpdateStatus & { version: string }

export interface UpdaterHost {
  /** This app's version (app.getVersion()). */
  version: string
  /** process.arch: only a build for this architecture is offered. */
  arch: string
  /** This process's id, so the installer script knows what to wait for. */
  pid: number
  /** The configured server's address, or null before one is set. */
  server(): string | null
  fetch(url: string, init?: RequestInit): Promise<Response>
  /** The installed Blackwall.app folder, or null when running from source (nothing to replace). */
  bundlePath(): string | null
  /** Parent folder for the download (a fresh sub-folder is made inside it). */
  tempDir(): string
  /** Starts the installer script so it outlives this process. */
  launchInstaller(script: string, args: string[]): void
  quit(): void
}

const MAX_BYTES = 600 * 1024 * 1024
const CHECK_TIMEOUT_MS = 15_000
const QUIT_DELAY_MS = 600

/** The manifest as the server sends it, or null if anything about it is off (see release.ts for the naming). */
export function parseMacManifest(value: unknown, arch: string): MacManifest | null {
  if (!value || typeof value !== "object") return null
  const m = value as Record<string, unknown>
  if (typeof m.file !== "string" || typeof m.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(m.sha256)) return null
  const name = DMG_NAME.exec(m.file)
  if (!name || name[4] !== arch) return null
  const versionName = `${name[1]}.${name[2]}.${name[3]}`
  const code = versionCode(versionName)
  if (code === null || m.versionCode !== code) return null
  return { versionCode: code, versionName, file: m.file, sha256: m.sha256.toLowerCase(), ...(typeof m.notes === "string" ? { notes: m.notes.slice(0, 500) } : {}) }
}

export class MacUpdater {
  private status: UpdateStatus = { state: "idle" }
  private manifest: MacManifest | null = null
  private busy = false
  private readonly host: UpdaterHost

  constructor(host: UpdaterHost) {
    this.host = host
  }

  current(): UpdateStatusWithVersion {
    return { ...this.status, version: this.host.version }
  }

  private set(status: UpdateStatus) {
    this.status = status
  }

  /** Where this app can be replaced, or why it can't be. */
  private installTarget(): { ok: true; bundle: string } | { ok: false; reason: string } {
    const bundle = this.host.bundlePath()
    if (!bundle) return { ok: false, reason: "This is a development run. Updates install into the installed Blackwall app." }
    try {
      accessSync(path.dirname(bundle), constants.W_OK)
    } catch {
      return { ok: false, reason: `Blackwall can't replace itself in ${path.dirname(bundle)}. Move it to your Applications folder and open it from there.` }
    }
    return { ok: true, bundle }
  }

  /** Asks the server whether a newer build is published. Never throws; the answer is in the status. */
  async check(): Promise<UpdateStatusWithVersion> {
    if (this.busy) return this.current()
    this.busy = true
    this.set({ state: "checking" })
    try {
      const server = this.host.server()
      if (!server) throw new Error("Set your Blackwall server address in the Mac app menu first.")
      const res = await this.host.fetch(new URL("/api/app-updates/mac.json", server).href, {
        headers: { Accept: "application/json", "X-Blackwall": "1" },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      })
      if (res.status === 404) {
        this.manifest = null
        this.set({ state: "current", checkedAt: Date.now(), nothingPublished: true })
        return this.current()
      }
      if (!res.ok) throw new Error(`The server answered HTTP ${res.status}.`)
      const manifest = parseMacManifest(await res.json(), this.host.arch)
      if (!manifest) throw new Error("The server's Mac update info isn't valid, or has no build for this Mac's processor.")
      const have = versionCode(this.host.version)
      if (have === null) throw new Error(`This app's version "${this.host.version}" can't be compared.`)
      if (manifest.versionCode <= have) {
        this.manifest = null
        this.set({ state: "current", checkedAt: Date.now() })
      } else {
        this.manifest = manifest
        const target = this.installTarget()
        this.set({ state: "available", latest: manifest.versionName, notes: manifest.notes, canInstall: target.ok, cantInstallReason: target.ok ? undefined : target.reason })
      }
    } catch (e) {
      this.manifest = null
      this.set({ state: "error", message: e instanceof Error ? e.message : String(e) })
    } finally {
      this.busy = false
    }
    return this.current()
  }

  /** Downloads the build found by check(), verifies it, then starts the installer and quits. Never throws. */
  async install(): Promise<UpdateStatusWithVersion> {
    const manifest = this.manifest
    if (this.busy || this.status.state !== "available" || !manifest) return this.current()
    const target = this.installTarget()
    if (!target.ok) {
      this.set({ state: "error", message: target.reason })
      return this.current()
    }
    this.busy = true
    const latest = manifest.versionName
    let work: string | null = null
    try {
      const server = this.host.server()
      if (!server) throw new Error("The server address is no longer set.")
      work = mkdtempSync(path.join(this.host.tempDir(), "blackwall-update-"))
      const dmg = path.join(work, manifest.file)
      this.set({ state: "downloading", latest, received: 0, total: 0 })
      const res = await this.host.fetch(new URL(`/app-updates/${encodeURIComponent(manifest.file)}`, server).href, { signal: AbortSignal.timeout(30 * 60_000) })
      if (!res.ok || !res.body) throw new Error(`The server couldn't send the update (HTTP ${res.status}).`)
      const total = Number(res.headers.get("content-length")) || 0
      if (total > MAX_BYTES) throw new Error("The update is larger than expected, so it was not downloaded.")
      const hash = createHash("sha256")
      let received = 0
      await pipeline(
        Readable.fromWeb(res.body as unknown as WebReadableStream),
        async (source: AsyncIterable<Buffer>) => {
          const out = createWriteStream(dmg)
          try {
            for await (const chunk of source) {
              received += chunk.length
              if (received > MAX_BYTES) throw new Error("The update is larger than expected, so it was stopped.")
              hash.update(chunk)
              this.set({ state: "downloading", latest, received, total })
              if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()))
            }
          } finally {
            await new Promise<void>((r) => out.end(() => r()))
          }
        },
      )
      if (total && received !== total) throw new Error("The download was cut short. Try again.")
      if (hash.digest("hex") !== manifest.sha256) throw new Error("The download doesn't match its checksum, so it was discarded.")

      const script = path.join(work, "install.sh")
      writeFileSync(script, INSTALL_SCRIPT, { mode: 0o700 })
      this.set({ state: "installing", latest })
      this.host.launchInstaller(script, [String(this.host.pid), dmg, target.bundle, work])
      setTimeout(() => this.host.quit(), QUIT_DELAY_MS)
    } catch (e) {
      if (work) rmSync(work, { recursive: true, force: true })
      this.set({ state: "error", message: e instanceof Error ? e.message : String(e) })
    } finally {
      this.busy = false
    }
    return this.current()
  }
}

/**
 * Runs after the app has quit: waits for it, opens the disk image, copies the new app next to the
 * old one, checks its signature and id, swaps the two and reopens. On any failure the old app is
 * put back and reopened; a log is left in the work folder. Arguments: pid, dmg, app, work folder,
 * and optionally the command that opens an app (a test swaps in a stub).
 */
export const INSTALL_SCRIPT = `#!/bin/sh
PID="$1"; DMG="$2"; APP="$3"; WORK="$4"; OPEN="\${5:-/usr/bin/open}"
exec >"$WORK/install.log" 2>&1
MNT="$WORK/mnt"
NEW="$APP.update-new"
OLD="$APP.update-old"
cleanup() { /usr/bin/hdiutil detach "$MNT" -quiet -force 2>/dev/null; }
fail() { echo "FAILED: $1"; cleanup; rm -rf "$NEW"; [ -d "$OLD" ] && [ ! -d "$APP" ] && mv "$OLD" "$APP"; [ -d "$APP" ] && "$OPEN" "$APP"; exit 1; }
i=0; while kill -0 "$PID" 2>/dev/null; do i=$((i+1)); [ "$i" -gt 120 ] && fail "the app didn't quit"; sleep 0.5; done
mkdir -p "$MNT" || fail "no work folder"
/usr/bin/hdiutil attach "$DMG" -nobrowse -readonly -noverify -mountpoint "$MNT" -quiet || fail "couldn't open the disk image"
SRC="$MNT/Blackwall.app"
[ -d "$SRC" ] || fail "no Blackwall.app in the disk image"
rm -rf "$NEW" "$OLD"
/usr/bin/ditto "$SRC" "$NEW" || fail "couldn't copy the new app"
/usr/bin/codesign --verify --deep --strict "$NEW" || fail "the new app's signature is not valid"
ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$NEW/Contents/Info.plist")
[ "$ID" = "dev.bcndlabs.blackwall" ] || fail "the new app has a different id ($ID)"
mv "$APP" "$OLD" || fail "couldn't move the old app aside"
mv "$NEW" "$APP" || fail "couldn't put the new app in place"
rm -rf "$OLD"
cleanup
rm -f "$DMG"
echo "OK"
"$OPEN" "$APP"
`
