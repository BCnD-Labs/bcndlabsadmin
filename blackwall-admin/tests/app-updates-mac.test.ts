import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer, request } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { DMG_NAME, MAC, parseUpdateManifest, readUpdateManifest, serveAppUpdates } from "../server/app-updates.ts"
import { GithubAppUpdates, releaseCandidate } from "../server/app-updates-github.ts"

const REPO = "example-org/example-repo"
const API = `https://api.github.com/repos/${REPO}`
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex")

type Rel = { tag: string; assets: { id: number; name: string; bytes: Buffer }[] }

/** A complete Mac release as desktop/scripts/publish.ts creates it. */
function macRelease(code: number, version: string, over: { dmg?: Buffer; manifest?: Record<string, unknown> } = {}): Rel {
  const dmg = Buffer.from(`DMG-${version}`)
  const file = `Blackwall-${version}-arm64.dmg`
  const manifest = { versionCode: code, versionName: version, file, sha256: sha(dmg), ...over.manifest }
  return {
    tag: `mac-build-${code}`,
    assets: [
      { id: code * 10 + 1, name: file, bytes: over.dmg ?? dmg },
      { id: code * 10 + 2, name: "mac.json", bytes: Buffer.from(JSON.stringify(manifest)) },
    ],
  }
}

/** A fake GitHub holding these releases; records the paths it is asked for. */
function fakeFetch(releases: Rel[], calls: string[] = []) {
  const files = new Map<number, Buffer>()
  const list = releases.map((r) => ({ tag_name: r.tag, assets: r.assets.map((a) => (files.set(a.id, a.bytes), { id: a.id, name: a.name, size: a.bytes.length })) }))
  return (async (url: string | URL | Request) => {
    const u = String(url)
    calls.push(u.replace(API, ""))
    if (u === `${API}/releases?per_page=30`) return new Response(JSON.stringify(list))
    const bytes = files.get(Number(/\/releases\/assets\/(\d+)$/.exec(u)?.[1]))
    return bytes ? new Response(new Uint8Array(bytes)) : new Response("{}", { status: 404 })
  }) as typeof fetch
}

const mirror = (cacheDir: string, releases: Rel[], calls: string[] = []) =>
  new GithubAppUpdates({ platform: "mac", repo: REPO, token: "t", cacheDir, minGapMs: 0, fetchImpl: fakeFetch(releases, calls), log: () => {} })

function setup(releases: Rel[]) {
  const calls: string[] = []
  const cacheDir = path.join(mkdtempSync(path.join(tmpdir(), "bw-mac-")), "mac")
  return { cacheDir, updates: mirror(cacheDir, releases, calls), calls }
}

test("Mac manifests need a build number and a Blackwall-<version>-<arch>.dmg name", () => {
  const ok = { versionCode: 301, versionName: "0.3.1", file: "Blackwall-0.3.1-arm64.dmg", sha256: "a".repeat(64) }
  assert.equal(parseUpdateManifest(ok, MAC)?.file, "Blackwall-0.3.1-arm64.dmg")
  for (const file of ["blackwall-android-3.apk", "Blackwall-0.3.1-arm64.dmg.apk", "../Blackwall-0.3.1-arm64.dmg", "Blackwall-0.3-arm64.dmg", "Blackwall-0.3.1-ppc.dmg", "Other-0.3.1-arm64.dmg"]) {
    assert.equal(parseUpdateManifest({ ...ok, file }, MAC), null, file)
  }
  // An Android manifest is not a Mac manifest and the other way round.
  assert.equal(parseUpdateManifest({ ...ok, file: "blackwall-android-3.apk" }, MAC), null)
  assert.equal(parseUpdateManifest(ok), null)
  assert.ok(DMG_NAME.test("Blackwall-10.20.30-x64.dmg"))
})

test("only a complete mac-build release counts for the Mac mirror", () => {
  const a = (name: string, id = 1) => ({ id, name, size: 1 })
  const ok = [a("Blackwall-0.3.1-arm64.dmg", 1), a("mac.json", 2)]
  assert.equal(releaseCandidate({ tag_name: "mac-build-301", assets: ok }, "mac")?.build, 301)
  for (const tag of ["apk-build-301", "apk-pr-1-build-301", "mac-301", "v0.3.1", "mac-build-301-x", "mac-build-"]) assert.equal(releaseCandidate({ tag_name: tag, assets: ok }, "mac"), null, tag)
  assert.equal(releaseCandidate({ tag_name: "mac-build-301", draft: true, assets: ok }, "mac"), null)
  assert.equal(releaseCandidate({ tag_name: "mac-build-301", assets: [a("Blackwall-0.3.1-arm64.dmg")] }, "mac"), null)
  assert.equal(releaseCandidate({ tag_name: "mac-build-301", assets: [a("mac.json"), a("blackwall-android-3.apk")] }, "mac"), null)
  // And the Android mirror never takes a Mac release.
  assert.equal(releaseCandidate({ tag_name: "mac-build-301", assets: ok }, "android"), null)
})

test("downloads the newest Mac build, verifies it, and ignores Android releases", async () => {
  const apk = Buffer.from("APK")
  const { cacheDir, updates, calls } = setup([
    macRelease(300, "0.3.0"),
    macRelease(301, "0.3.1"),
    { tag: "apk-build-999", assets: [{ id: 1, name: "blackwall-android-999.apk", bytes: apk }, { id: 2, name: "android.json", bytes: Buffer.from("{}") }] },
  ])
  await updates.refresh()
  const manifest = readUpdateManifest(cacheDir, MAC)
  assert.equal(manifest?.versionName, "0.3.1")
  assert.equal(readFileSync(path.join(cacheDir, "Blackwall-0.3.1-arm64.dmg"), "utf8"), "DMG-0.3.1")
  assert.deepEqual(readdirSync(cacheDir).sort(), ["Blackwall-0.3.1-arm64.dmg", "mac.json"])
  assert.deepEqual(calls, ["/releases?per_page=30", "/releases/assets/3012", "/releases/assets/3011"])
})

test("a Mac download that fails its checksum never replaces the build already held", async () => {
  const { cacheDir, updates } = setup([macRelease(300, "0.3.0")])
  await updates.refresh()
  await mirror(cacheDir, [macRelease(301, "0.3.1", { dmg: Buffer.from("TAMPERED!") })]).refresh()
  assert.equal(readUpdateManifest(cacheDir, MAC)?.versionName, "0.3.0")
  assert.deepEqual(readdirSync(cacheDir).sort(), ["Blackwall-0.3.0-arm64.dmg", "mac.json"])
})

test("a Mac manifest that names a different file or build is skipped", async () => {
  const { cacheDir, updates } = setup([macRelease(301, "0.3.1", { manifest: { file: "Blackwall-9.9.9-arm64.dmg" } }), macRelease(302, "0.3.2", { manifest: { versionCode: 5 } }), macRelease(303, "0.3.3", { manifest: { sha256: undefined } })])
  await updates.refresh()
  assert.equal(readUpdateManifest(cacheDir, MAC), null)
})

test("the Mac server serves only the manifest's dmg, as a disk image", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bw-mac-serve-"))
  writeFileSync(path.join(dir, "mac.json"), JSON.stringify({ versionCode: 301, versionName: "0.3.1", file: "Blackwall-0.3.1-arm64.dmg" }))
  writeFileSync(path.join(dir, "Blackwall-0.3.1-arm64.dmg"), "DMGBYTES")
  writeFileSync(path.join(dir, "Blackwall-0.2.0-arm64.dmg"), "OLD")
  const server = createServer(serveAppUpdates(dir, (h) => h === "blackwall.example.ts.net", MAC))
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const port = (server.address() as AddressInfo).port
  const get = (p: string, host: string) =>
    new Promise<{ status: number; type?: string; body: string }>((resolve, reject) => {
      const req = request({ port, path: p, headers: { host } }, (res) => {
        let body = ""
        res.on("data", (c) => (body += c))
        res.on("end", () => resolve({ status: res.statusCode ?? 0, type: res.headers["content-type"], body }))
      })
      req.on("error", reject).end()
    })
  try {
    const ok = await get("/app-updates/Blackwall-0.3.1-arm64.dmg", "blackwall.example.ts.net")
    assert.deepEqual([ok.status, ok.type, ok.body], [200, "application/x-apple-diskimage", "DMGBYTES"])
    assert.equal((await get("/app-updates/Blackwall-0.2.0-arm64.dmg", "blackwall.example.ts.net")).status, 404)
    assert.equal((await get("/app-updates/mac.json", "blackwall.example.ts.net")).status, 404)
    assert.equal((await get("/app-updates/Blackwall-0.3.1-arm64.dmg", "evil.example.com")).status, 403)
  } finally {
    server.close()
  }
})
