/**
 * In-app update check. The Blackwall server serves a small drop folder: `android.json`
 * (the newest build) plus the .apk it names. The app compares the published build identity (with a legacy build-number fallback) and, when the
 * server has a newer one, opens the .apk address so Android downloads it and offers to
 * install. The manifest is fetched with the X-Blackwall header every API call needs. Pure functions plus an injectable fetch, so they run under `node --test`.
 */

export type UpdateManifest = { versionCode: number; versionName: string; file: string; md5?: string; notes?: string; updateId?: string }

export type UpdateResult =
  | { status: "current"; versionCode: number }
  | { status: "available"; manifest: UpdateManifest; url: string }
  | { status: "unavailable"; reason: string }

const APK_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.apk$/

function base(address: string): string {
  return address.replace(/\/+$/, "")
}

export function manifestUrl(address: string): string {
  return `${base(address)}/api/app-updates/android.json`
}

/** The .apk is served outside /api (a phone's browser can't send the X-Blackwall header the API requires). */
export function apkUrl(address: string, file: string): string {
  return `${base(address)}/app-updates/${encodeURIComponent(file)}`
}

/** A valid manifest, or null. The file must be a plain .apk name (no paths). */
export function parseManifest(value: unknown): UpdateManifest | null {
  if (!value || typeof value !== "object") return null
  const m = value as Record<string, unknown>
  if (typeof m.versionCode !== "number" || !Number.isInteger(m.versionCode) || m.versionCode < 1) return null
  if (typeof m.file !== "string" || !APK_NAME.test(m.file)) return null
  const versionName = typeof m.versionName === "string" && m.versionName.length <= 40 ? m.versionName : String(m.versionCode)
  const md5 = typeof m.md5 === "string" && /^[0-9a-f]{32}$/i.test(m.md5) ? m.md5.toLowerCase() : undefined
  const notes = typeof m.notes === "string" ? m.notes.slice(0, 500) : undefined
  return { versionCode: m.versionCode, versionName, file: m.file, md5, notes, ...(typeof m.updateId === "string" && /^[a-f0-9]{64}$/.test(m.updateId) && { updateId: m.updateId }) }
}

export async function checkForUpdate(address: string, currentVersionCode: number, fetchImpl: typeof fetch = fetch, installedUpdateId?: string): Promise<UpdateResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetchImpl(manifestUrl(address), { signal: controller.signal, headers: { Accept: "application/json", "X-Blackwall": "1" } })
    if (res.status === 404) return { status: "unavailable", reason: "The server has no app updates set up yet." }
    if (!res.ok) return { status: "unavailable", reason: `The server answered ${res.status}.` }
    const manifest = parseManifest(await res.json())
    if (!manifest) return { status: "unavailable", reason: "The server's update file isn't valid." }
    const sameBuild = manifest.updateId && installedUpdateId ? manifest.updateId === installedUpdateId : manifest.versionCode === currentVersionCode
    if (manifest.versionCode < currentVersionCode || sameBuild) return { status: "current", versionCode: currentVersionCode }
    return { status: "available", manifest, url: apkUrl(address, manifest.file) }
  } catch {
    return { status: "unavailable", reason: "Couldn't reach the server. Check the connection and try again." }
  } finally {
    clearTimeout(timer)
  }
}

/** Download progress as a whole percent, 0 to 100 (0 while the total size is unknown). */
export function percent(received: number, total: number): number {
  if (!(total > 0) || !(received > 0)) return 0
  return Math.max(0, Math.min(100, Math.floor((received / total) * 100)))
}

