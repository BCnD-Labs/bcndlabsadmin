import { createHash } from "node:crypto"
import { createWriteStream, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import { pipeline } from "node:stream/promises"
import { ANDROID, DMG_NAME, MAC, type UpdateKind, type UpdateManifest, parseUpdateManifest, readUpdateManifest } from "./app-updates.ts"

/**
 * Fetches the newest Android build from GitHub into a local cache folder, in the same shape as the
 * manual drop folder (`android.json` plus the .apk it names), so the existing routes serve it as is.
 *
 * One platform per instance, by construction. A release counts only when ALL of these hold:
 *  - its tag is what that platform's publisher uses and it isn't a draft. Android: `apk-build-<n>` or
 *    `apk-pr-<number>-build-<n>` (.github/workflows/android-apk.yml). Mac: `mac-build-<n>`
 *    (desktop/scripts/publish.ts);
 *  - it has an asset named exactly `android.json` / `mac.json`, and the installer: exactly
 *    `blackwall-android-<n>.apk`, or a `Blackwall-<version>-<arch>.dmg`;
 *  - the manifest's build number and file name match those, and its sha256 matches the download.
 * Anything else on the releases page (the other platform's build, a source archive, a differently
 * named file) is never read, downloaded or served.
 *
 * Uses the read-only token the panel's update check already has (BLACKWALL_UPDATE_GITHUB_TOKEN).
 */
const PLATFORMS = {
  android: {
    kind: ANDROID,
    tag: /^apk-(?:pr-\d+-)?build-(\d+)$/,
    file: (assets: Asset[], build: number) => assets.find((a) => a?.name === `blackwall-android-${build}.apk`),
    maxBytes: 300 * 1024 * 1024,
  },
  mac: {
    kind: MAC,
    tag: /^mac-build-(\d+)$/,
    file: (assets: Asset[]) => assets.find((a) => typeof a?.name === "string" && DMG_NAME.test(a.name)),
    maxBytes: 600 * 1024 * 1024,
  },
} satisfies Record<string, { kind: UpdateKind; tag: RegExp; file: (assets: Asset[], build: number) => Asset | undefined; maxBytes: number }>
export type UpdatePlatform = keyof typeof PLATFORMS
const LOOK_AT = 3 // newest candidates to try before giving up

type Asset = { id: number; name: string; size: number }
type Release = { tag_name: string; draft?: boolean; published_at?: string | null; assets?: Asset[] }
type Candidate = { build: number; at: number; manifest: Asset; apk: Asset }

export interface GithubUpdatesOptions {
  /** Which app's builds to fetch (default: android). */
  platform?: UpdatePlatform
  repo: string
  token: string
  /** Where the newest build is kept (created if missing). Must not be the manual drop folder. */
  cacheDir: string
  /** Least time between two GitHub checks, so the phone's taps can't hammer the API. */
  minGapMs?: number
  fetchImpl?: typeof fetch
  log?: (line: string) => void
}

/** The release's files for one platform, or null when it isn't a complete build release for it. */
export function releaseCandidate(r: Release, platform: UpdatePlatform): Candidate | null {
  const spec = PLATFORMS[platform]
  const build = spec.tag.exec(r.tag_name ?? "")?.[1]
  if (!build || r.draft) return null
  const assets = Array.isArray(r.assets) ? r.assets : []
  const manifest = assets.find((a) => a?.name === spec.kind.manifest)
  const apk = spec.file(assets, Number(build))
  if (!manifest || !apk || !Number.isInteger(manifest.id) || !Number.isInteger(apk.id)) return null
  return { build: Number(build), at: r.published_at ? Date.parse(r.published_at) || 0 : 0, manifest, apk }
}

export const androidCandidate = (r: Release) => releaseCandidate(r, "android")

export class GithubAppUpdates {
  readonly cacheDir: string
  private readonly spec: (typeof PLATFORMS)[UpdatePlatform]
  private readonly o: GithubUpdatesOptions
  private readonly fetch: typeof fetch
  private inflight?: Promise<void>
  private lastStart = 0

  constructor(options: GithubUpdatesOptions) {
    this.o = options
    this.cacheDir = options.cacheDir
    this.spec = PLATFORMS[options.platform ?? "android"]
    this.fetch = options.fetchImpl ?? fetch
  }

  /** Check GitHub now (at most once per gap; calls during a check share it). Never throws. */
  refresh(): Promise<void> {
    if (this.inflight) return this.inflight
    if (Date.now() - this.lastStart < (this.o.minGapMs ?? 60_000)) return Promise.resolve()
    this.lastStart = Date.now()
    const log = this.o.log ?? console.log
    this.inflight = this.sync()
      .catch((e: Error) => log(`[blackwall] app update check on GitHub failed: ${e.message}`))
      .finally(() => {
        this.inflight = undefined
      })
    return this.inflight
  }

  /** Like refresh, but stops waiting after `ms` (the download carries on in the background). */
  async refreshWithin(ms: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms)
    })
    try {
      await Promise.race([this.refresh(), deadline])
    } finally {
      clearTimeout(timer)
    }
  }

  private headers(accept: string) {
    return { Authorization: `Bearer ${this.o.token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "blackwall" }
  }

  private async get(url: string, accept: string, timeoutMs: number): Promise<Response> {
    const res = await this.fetch(url, { headers: this.headers(accept), signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status} for ${new URL(url).pathname.split("/").slice(-2).join("/")}`)
    return res
  }

  private async sync(): Promise<void> {
    const api = `https://api.github.com/repos/${this.o.repo}`
    const list = (await (await this.get(`${api}/releases?per_page=30`, "application/vnd.github+json", 15_000)).json()) as Release[]
    if (!Array.isArray(list)) throw new Error("the releases list wasn't a list")
    const candidates = list
      .map((r) => releaseCandidate(r, this.o.platform ?? "android"))
      .filter((c): c is Candidate => !!c)
      .sort((a, b) => b.build - a.build || b.at - a.at)
      .slice(0, LOOK_AT)

    const have = readUpdateManifest(this.cacheDir, this.spec.kind)
    for (const c of candidates) {
      if (have && have.versionCode >= c.build && this.hasApk(have)) return // already holding this build or a newer one
      const manifest = parseUpdateManifest(JSON.parse(await (await this.get(`${api}/releases/assets/${c.manifest.id}`, "application/octet-stream", 15_000)).text()), this.spec.kind)
      if (!manifest || manifest.versionCode !== c.build || manifest.file !== c.apk.name || !manifest.sha256) {
        ;(this.o.log ?? console.log)(`[blackwall] skipped ${this.o.platform ?? "android"} build ${c.build}: its ${this.spec.kind.manifest} doesn't match its release`)
        continue
      }
      if (c.apk.size > this.spec.maxBytes) continue
      await this.download(api, c.apk, manifest)
      ;(this.o.log ?? console.log)(`[blackwall] ${this.o.platform ?? "android"} app update: build ${manifest.versionCode} (${manifest.versionName}) is ready from GitHub`)
      return
    }
  }

  private hasApk(m: UpdateManifest): boolean {
    try {
      return statSync(path.join(this.cacheDir, m.file)).isFile()
    } catch {
      return false
    }
  }

  private async download(api: string, apk: Asset, manifest: UpdateManifest): Promise<void> {
    mkdirSync(this.cacheDir, { recursive: true })
    const tmp = path.join(this.cacheDir, `.download-${process.pid}.tmp`)
    const hash = createHash("sha256")
    const maxBytes = this.spec.maxBytes
    let size = 0
    try {
      const res = await this.get(`${api}/releases/assets/${apk.id}`, "application/octet-stream", 180_000)
      if (!res.body) throw new Error("the download had no body")
      await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          size += chunk.length
          if (size > maxBytes) throw new Error("the download is larger than expected")
          hash.update(chunk)
          yield chunk
        }
      }, createWriteStream(tmp))
      if (size !== apk.size) throw new Error(`the download is ${size} bytes, GitHub lists ${apk.size}`)
      if (hash.digest("hex") !== manifest.sha256) throw new Error("the download doesn't match the checksum in ${this.spec.kind.manifest}")
      renameSync(tmp, path.join(this.cacheDir, manifest.file))
      // The manifest goes last, so a half-copied build is never offered.
      const manifestTmp = path.join(this.cacheDir, `.manifest-${process.pid}.tmp`)
      writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2) + "\n")
      renameSync(manifestTmp, path.join(this.cacheDir, this.spec.kind.manifest))
    } finally {
      rmSync(tmp, { force: true })
    }
    for (const name of readdirSync(this.cacheDir)) {
      if (name.endsWith(this.spec.kind === MAC ? ".dmg" : ".apk") && name !== manifest.file) rmSync(path.join(this.cacheDir, name), { force: true })
    }
  }
}
