import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { newestUpdatesDir, readUpdateManifest } from "../server/app-updates.ts"
import { GithubAppUpdates, androidCandidate } from "../server/app-updates-github.ts"

const REPO = "example-org/example-repo"
const API = `https://api.github.com/repos/${REPO}`
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex")

/** A fake GitHub: releases by tag, assets by id (name, bytes). Counts requests. */
function fakeGithub(releases: { tag: string; draft?: boolean; assets: { id: number; name: string; bytes: Buffer }[] }[]) {
  const calls: string[] = []
  const auth: (string | undefined)[] = []
  const files = new Map<number, Buffer>()
  const list = releases.map((r, i) => ({
    tag_name: r.tag,
    draft: r.draft ?? false,
    published_at: new Date(2026, 10, 1 + i).toISOString(),
    assets: r.assets.map((a) => {
      files.set(a.id, a.bytes)
      return { id: a.id, name: a.name, size: a.bytes.length }
    }),
  }))
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    calls.push(u)
    auth.push((init?.headers as Record<string, string> | undefined)?.Authorization)
    if (u === `${API}/releases?per_page=30`) return new Response(JSON.stringify(list), { status: 200 })
    const asset = /\/releases\/assets\/(\d+)$/.exec(u)
    const bytes = asset ? files.get(Number(asset[1])) : undefined
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response("{}", { status: 404 })
  }) as typeof fetch
  return { fetchImpl, calls, auth }
}

/** A complete Android build release as the workflow publishes it. */
function androidRelease(build: number, over: { tag?: string; apkBytes?: Buffer; manifest?: Record<string, unknown>; extra?: { id: number; name: string; bytes: Buffer }[] } = {}) {
  const apk = Buffer.from(`APK-${build}`)
  const file = `blackwall-android-${build}.apk`
  const manifest = { versionCode: build, versionName: `0.${build}.0`, file, sha256: sha(apk), md5: createHash("md5").update(apk).digest("hex"), ...over.manifest }
  return {
    tag: over.tag ?? `apk-pr-${build}-build-${build}`,
    assets: [
      { id: build * 10 + 1, name: file, bytes: over.apkBytes ?? apk },
      { id: build * 10 + 2, name: "android.json", bytes: Buffer.from(JSON.stringify(manifest)) },
      ...(over.extra ?? []),
    ],
  }
}

function setup(releases: Parameters<typeof fakeGithub>[0], minGapMs = 0) {
  const gh = fakeGithub(releases)
  const cacheDir = path.join(mkdtempSync(path.join(tmpdir(), "bw-gh-")), "cache")
  const logs: string[] = []
  const updates = new GithubAppUpdates({ repo: REPO, token: "test-token", cacheDir, minGapMs, fetchImpl: gh.fetchImpl, log: (l) => logs.push(l) })
  return { gh, cacheDir, updates, logs }
}

test("only complete Android build releases count", () => {
  const asset = (name: string, id = 1) => ({ id, name, size: 1 })
  const ok = [asset("blackwall-android-4.apk", 1), asset("android.json", 2)]
  assert.equal(androidCandidate({ tag_name: "apk-pr-9-build-4", assets: ok })?.build, 4)
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: ok })?.build, 4)
  // Wrong tag: a Mac release, a version tag, a lookalike.
  for (const tag of ["mac-build-4", "v4", "mac-apk-build-4", "apk-build-4-mac", "apk-pr-x-build-4", "apk-build-"]) {
    assert.equal(androidCandidate({ tag_name: tag, assets: ok }), null, tag)
  }
  assert.equal(androidCandidate({ tag_name: "apk-build-4", draft: true, assets: ok }), null)
  // Wrong or missing files: a Mac installer, a different build number, no manifest, no apk.
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: [asset("Blackwall-4.dmg"), asset("android.json")] }), null)
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: [asset("blackwall-android-5.apk"), asset("android.json")] }), null)
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: [asset("blackwall-android-4.apk")] }), null)
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: [asset("android.json")] }), null)
  assert.equal(androidCandidate({ tag_name: "apk-build-4", assets: [asset("blackwall-android-4.apk.dmg"), asset("android.json")] }), null)
})

test("downloads the newest Android build and ignores Mac releases", async () => {
  const mac = Buffer.from("MAC-INSTALLER")
  const { gh, cacheDir, updates } = setup([
    androidRelease(2),
    androidRelease(3),
    // A Mac release, even one that carries an android.json and an .apk-looking file, is never touched.
    { tag: "mac-build-9", assets: [{ id: 901, name: "Blackwall-9.dmg", bytes: mac }, { id: 902, name: "blackwall-android-9.apk", bytes: mac }, { id: 903, name: "android.json", bytes: Buffer.from(JSON.stringify({ versionCode: 9, file: "blackwall-android-9.apk", sha256: sha(mac) })) }] },
    // A build whose tag is right but whose files are a Mac installer.
    { tag: "apk-build-8", assets: [{ id: 801, name: "Blackwall-8.dmg", bytes: mac }, { id: 802, name: "android.json", bytes: Buffer.from("{}") }] },
    { ...androidRelease(7), draft: true },
  ])
  await updates.refresh()
  const manifest = readUpdateManifest(cacheDir)
  assert.equal(manifest?.versionCode, 3)
  assert.equal(manifest?.file, "blackwall-android-3.apk")
  assert.equal(readFileSync(path.join(cacheDir, "blackwall-android-3.apk"), "utf8"), "APK-3")
  assert.deepEqual(readdirSync(cacheDir).sort(), ["android.json", "blackwall-android-3.apk"])
  // Only build 3's two files were fetched (the list, then its manifest and apk), and always with the token.
  assert.deepEqual(gh.calls.map((c) => c.replace(API, "")), ["/releases?per_page=30", "/releases/assets/32", "/releases/assets/31"])
  assert.ok(gh.auth.every((a) => a === "Bearer test-token"))
})

test("asks GitHub at most once per gap and doesn't download a build twice", async () => {
  const { gh, updates } = setup([androidRelease(3)], 60_000)
  await updates.refresh()
  const after = gh.calls.length
  await updates.refresh()
  assert.equal(gh.calls.length, after)

  const again = setup([androidRelease(3)], 0)
  await again.updates.refresh()
  const first = again.gh.calls.length
  await again.updates.refresh() // gap is zero: it asks GitHub again, but already holds build 3
  assert.equal(again.gh.calls.length, first + 1)
  assert.equal(again.gh.calls.filter((c) => c.endsWith("/releases/assets/31")).length, 1)
})

test("a bad download never replaces the build already held", async () => {
  const { cacheDir, updates } = setup([androidRelease(2)])
  await updates.refresh()
  assert.equal(readUpdateManifest(cacheDir)?.versionCode, 2)

  const bad = androidRelease(3, { apkBytes: Buffer.from("TAMPERED-BYTES") }) // sha256 in android.json is for other bytes
  const next = new GithubAppUpdates({ repo: REPO, token: "t", cacheDir, minGapMs: 0, fetchImpl: fakeGithub([androidRelease(2), bad]).fetchImpl, log: () => {} })
  await next.refresh()
  assert.equal(readUpdateManifest(cacheDir)?.versionCode, 2)
  assert.deepEqual(readdirSync(cacheDir).sort(), ["android.json", "blackwall-android-2.apk"])
})

test("a manifest that disagrees with its release is skipped", async () => {
  const wrongCode = setup([androidRelease(4, { manifest: { versionCode: 5 } })])
  await wrongCode.updates.refresh()
  assert.equal(readUpdateManifest(wrongCode.cacheDir), null)

  const wrongFile = setup([androidRelease(4, { manifest: { file: "other.apk" } })])
  await wrongFile.updates.refresh()
  assert.equal(readUpdateManifest(wrongFile.cacheDir), null)

  const noSum = setup([androidRelease(4, { manifest: { sha256: undefined } })])
  await noSum.updates.refresh()
  assert.equal(readUpdateManifest(noSum.cacheDir), null)

  // The next-newest valid build is used instead of nothing.
  const fallback = setup([androidRelease(3), androidRelease(4, { manifest: { versionCode: 5 } })])
  await fallback.updates.refresh()
  assert.equal(readUpdateManifest(fallback.cacheDir)?.versionCode, 3)
})

test("GitHub being down is logged, not thrown, and leaves the cache alone", async () => {
  const logs: string[] = []
  const cacheDir = path.join(mkdtempSync(path.join(tmpdir(), "bw-gh-")), "cache")
  const updates = new GithubAppUpdates({ repo: REPO, token: "t", cacheDir, minGapMs: 0, fetchImpl: (async () => new Response("no", { status: 502 })) as typeof fetch, log: (l) => logs.push(l) })
  await updates.refresh()
  assert.equal(readUpdateManifest(cacheDir), null)
  assert.match(logs.join("\n"), /failed: GitHub answered HTTP 502/)
})

test("a slow GitHub doesn't hold a phone check past its deadline", async () => {
  const cacheDir = path.join(mkdtempSync(path.join(tmpdir(), "bw-gh-")), "cache")
  const never = (() => new Promise<Response>(() => {})) as unknown as typeof fetch
  const updates = new GithubAppUpdates({ repo: REPO, token: "t", cacheDir, fetchImpl: never, log: () => {} })
  const started = Date.now()
  await updates.refreshWithin(50)
  assert.ok(Date.now() - started < 1000)
})

test("the higher build number wins between GitHub and the drop folder", () => {
  const folder = (code?: number) => {
    const dir = mkdtempSync(path.join(tmpdir(), "bw-dir-"))
    if (code) writeFileSync(path.join(dir, "android.json"), JSON.stringify({ versionCode: code, file: `blackwall-android-${code}.apk` }))
    return dir
  }
  const cache = folder(3)
  const manual = folder(5)
  assert.equal(newestUpdatesDir([cache, manual]), manual)
  assert.equal(newestUpdatesDir([manual, cache]), manual)
  assert.equal(newestUpdatesDir([cache, undefined]), cache)
  assert.equal(newestUpdatesDir([folder(), undefined]), undefined)
  assert.equal(newestUpdatesDir([path.join(tmpdir(), "bw-does-not-exist")]), undefined)
})

test("a newer publication with the same Android version replaces an older cached APK exactly once", async () => {
  const old = androidRelease(25)
  const newer = androidRelease(25, { tag: "apk-pr-63-build-25", apkBytes: Buffer.from("APK-new-25"), manifest: { sha256: sha(Buffer.from("APK-new-25")), updateId: "b".repeat(64) } })
  newer.assets = newer.assets.map(asset => ({ ...asset, id: asset.id + 1000 }))
  const { gh, cacheDir, updates } = setup([old, newer])
  await updates.refresh()
  assert.equal(readFileSync(path.join(cacheDir, "blackwall-android-25.apk"), "utf8"), "APK-new-25")
  assert.equal(readUpdateManifest(cacheDir)?.updateId, "b".repeat(64))
  const downloaded = gh.calls.filter(call => call.endsWith("/releases/assets/1251")).length
  await updates.refresh()
  assert.equal(gh.calls.filter(call => call.endsWith("/releases/assets/1251")).length, downloaded)
  assert.equal(gh.calls.filter(call => call.endsWith("/releases/assets/251")).length, 0)
})
