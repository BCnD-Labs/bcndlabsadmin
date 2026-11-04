/**
 * How a Mac build is named and numbered. Shared by `desktop/scripts/publish.ts` (which uploads a build)
 * and the app's updater (which compares against it), so the two can't drift apart.
 */

/** `Blackwall-<version>-<arch>.dmg`, the name electron-builder gives the installer. */
export const DMG_NAME = /^Blackwall-(\d{1,4})\.(\d{1,4})\.(\d{1,4})-(arm64|x64)\.dmg$/

/**
 * A comparable whole number for a plain `major.minor.patch` version: 0.3.1 → 301, 1.12.4 → 11204.
 * Null for anything else (a prerelease tag, a minor or patch of 100 or more) so a bad version is
 * refused rather than mis-ordered.
 */
export function versionCode(version: string): number | null {
  const m = /^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/.exec(version)
  return m ? Number(m[1]) * 10_000 + Number(m[2]) * 100 + Number(m[3]) : null
}

/** What publish.ts writes to `mac.json` and the server hands to the app; the same fields as android.json. */
export interface MacManifest {
  versionCode: number
  versionName: string
  file: string
  sha256: string
  notes?: string
}

/** The manifest for a built installer, or an Error saying what is wrong with the name or version. */
export function macManifest(file: string, sha256: string, notes?: string): MacManifest | Error {
  const name = DMG_NAME.exec(file)
  if (!name) return new Error(`"${file}" isn't named Blackwall-<version>-<arch>.dmg`)
  const versionName = `${name[1]}.${name[2]}.${name[3]}`
  const code = versionCode(versionName)
  if (code === null) return new Error(`"${versionName}" isn't a plain major.minor.patch version (minor and patch stay under 100)`)
  if (!/^[0-9a-f]{64}$/.test(sha256)) return new Error("sha256 must be 64 hex characters")
  return { versionCode: code, versionName, file, sha256, ...(notes ? { notes: notes.slice(0, 500) } : {}) }
}

/** The release tag the server's GitHub mirror looks for. */
export const releaseTag = (code: number) => `mac-build-${code}`
