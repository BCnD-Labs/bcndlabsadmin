import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { INSTALL_SCRIPT, MacUpdater, parseMacManifest, type UpdaterHost } from "../src/main/updater.ts"

const SERVER = "https://blackwall.example.ts.net"
const DMG_BYTES = Buffer.from("PRETEND-DISK-IMAGE-0.3.2")
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex")
const manifest = (over: Record<string, unknown> = {}) => ({ versionCode: 302, versionName: "0.3.2", file: "Blackwall-0.3.2-arm64.dmg", sha256: sha(DMG_BYTES), ...over })

/** An updater wired to a fake server, a temp "Applications" folder and recorders for what it launches. */
function setup(opts: { manifest?: unknown; status?: number; dmg?: Buffer; version?: string; arch?: string; packaged?: boolean; writable?: boolean; noServer?: boolean } = {}) {
  const apps = mkdtempSync(path.join(tmpdir(), "bw-upd-apps-"))
  if (opts.writable === false) chmodSync(apps, 0o500)
  const temp = mkdtempSync(path.join(tmpdir(), "bw-upd-tmp-"))
  const requests: string[] = []
  const launched: { script: string; args: string[] }[] = []
  let quits = 0
  const host: UpdaterHost = {
    version: opts.version ?? "0.3.1",
    arch: opts.arch ?? "arm64",
    pid: 4242,
    server: () => (opts.noServer ? null : SERVER),
    fetch: async (url, init) => {
      requests.push(url.replace(SERVER, ""))
      const headers = init?.headers as Record<string, string> | undefined
      if (url.endsWith("/api/app-updates/mac.json")) {
        assert.equal(headers?.["X-Blackwall"], "1")
        return opts.status && opts.status !== 200 ? new Response("{}", { status: opts.status }) : Response.json(opts.manifest ?? manifest())
      }
      if (url.includes("/app-updates/Blackwall-")) {
        const body = opts.dmg ?? DMG_BYTES
        return new Response(new Uint8Array(body), { headers: { "content-length": String(body.length) } })
      }
      return new Response("nope", { status: 404 })
    },
    bundlePath: () => (opts.packaged === false ? null : path.join(apps, "Blackwall.app")),
    tempDir: () => temp,
    launchInstaller: (script, args) => void launched.push({ script, args }),
    quit: () => void quits++,
  }
  return { updater: new MacUpdater(host), requests, launched, temp, apps, quits: () => quits }
}

test("a manifest is only accepted when its name, version, checksum and processor all agree", () => {
  assert.equal(parseMacManifest(manifest(), "arm64")?.versionName, "0.3.2")
  assert.equal(parseMacManifest(manifest(), "x64"), null, "a build for another processor")
  assert.equal(parseMacManifest(manifest({ versionCode: 999 }), "arm64"), null, "number disagrees with the name")
  assert.equal(parseMacManifest(manifest({ sha256: "abc" }), "arm64"), null)
  assert.equal(parseMacManifest(manifest({ sha256: undefined }), "arm64"), null, "no checksum, no install")
  assert.equal(parseMacManifest(manifest({ file: "../Blackwall-0.3.2-arm64.dmg" }), "arm64"), null)
  assert.equal(parseMacManifest(manifest({ file: "evil.dmg" }), "arm64"), null)
  assert.equal(parseMacManifest(null, "arm64"), null)
  assert.equal(parseMacManifest(manifest({ sha256: sha(DMG_BYTES).toUpperCase() }), "arm64")?.sha256, sha(DMG_BYTES))
})

test("a newer published build is offered; the same or an older one isn't", async () => {
  const { updater } = setup()
  const s = await updater.check()
  assert.equal(s.state, "available")
  assert.equal(s.version, "0.3.1")
  assert.ok(s.state === "available" && s.latest === "0.3.2" && s.canInstall)

  for (const version of ["0.3.2", "0.4.0"]) assert.equal((await setup({ version }).updater.check()).state, "current", version)
  // 0.3.10 is newer than 0.3.9, not older (a text comparison would get this wrong).
  const ten = setup({ version: "0.3.9", manifest: manifest({ versionCode: 310, versionName: "0.3.10", file: "Blackwall-0.3.10-arm64.dmg" }) })
  assert.equal((await ten.updater.check()).state, "available")
})

test("nothing published, a broken manifest, a server error and a missing address are each said plainly", async () => {
  const none = await setup({ status: 404 }).updater.check()
  assert.ok(none.state === "current" && none.nothingPublished)
  for (const o of [{ manifest: { versionCode: "x" } }, { status: 500 }, { noServer: true }, { arch: "x64" }]) {
    const s = await setup(o).updater.check()
    assert.equal(s.state, "error", JSON.stringify(o))
    assert.ok(s.state === "error" && s.message.length > 10)
  }
})

test("installing downloads, verifies, then starts the installer and quits", async () => {
  const t = setup()
  await t.updater.check()
  const s = await t.updater.install()
  assert.equal(s.state, "installing")
  assert.deepEqual(t.requests, ["/api/app-updates/mac.json", "/app-updates/Blackwall-0.3.2-arm64.dmg"])
  assert.equal(t.launched.length, 1)
  const [pid, dmg, app, work] = t.launched[0].args
  assert.equal(pid, "4242")
  assert.equal(app, path.join(t.apps, "Blackwall.app"))
  assert.deepEqual(readFileSync(dmg), DMG_BYTES)
  assert.equal(path.dirname(dmg), work)
  assert.ok(existsSync(t.launched[0].script))
  await new Promise((r) => setTimeout(r, 900))
  assert.equal(t.quits(), 1)
})

test("a download that doesn't match its checksum is thrown away and nothing is launched", async () => {
  const t = setup({ dmg: Buffer.from("TAMPERED-WITH") })
  await t.updater.check()
  const s = await t.updater.install()
  assert.ok(s.state === "error" && /checksum/.test(s.message))
  assert.equal(t.launched.length, 0)
  assert.deepEqual(readdirSync(t.temp), [], "the partial download is removed")
  await new Promise((r) => setTimeout(r, 900))
  assert.equal(t.quits(), 0)
})

test("a development run or a read-only folder can check but not install", async () => {
  const dev = setup({ packaged: false })
  const a = await dev.updater.check()
  assert.ok(a.state === "available" && !a.canInstall && /development/.test(a.cantInstallReason ?? ""))
  const refused = await dev.updater.install()
  assert.equal(refused.state, "error")
  assert.deepEqual(dev.requests, ["/api/app-updates/mac.json"], "no download was attempted")

  if (process.getuid?.() !== 0) {
    const ro = setup({ writable: false })
    const b = await ro.updater.check()
    assert.ok(b.state === "available" && !b.canInstall && /Applications/.test(b.cantInstallReason ?? ""))
    chmodSync(ro.apps, 0o700)
  }
})

test("install does nothing unless a check found an update", async () => {
  const t = setup()
  assert.equal((await t.updater.install()).state, "idle")
  assert.deepEqual(t.requests, [])
  mkdirSync(path.join(t.temp, "x"))
})

/** A tiny signed app with the given id, holding `marker` so old and new can be told apart. */
function fakeApp(dir: string, id: string, marker: string) {
  const app = path.join(dir, "Blackwall.app")
  mkdirSync(path.join(app, "Contents", "MacOS"), { recursive: true })
  writeFileSync(path.join(app, "Contents", "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleExecutable</key><string>Blackwall</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`)
  writeFileSync(path.join(app, "Contents", "MacOS", "Blackwall"), "#!/bin/sh\n", { mode: 0o755 })
  mkdirSync(path.join(app, "Contents", "Resources"))
  writeFileSync(path.join(app, "Contents", "Resources", "marker"), marker)
  assert.equal(spawnSync("/usr/bin/codesign", ["--force", "--sign", "-", app]).status, 0)
  return app
}

/** Runs the real installer script against a real disk image; the "open" command is a stub that records its argument. */
function runInstaller(newId: string) {
  const root = mkdtempSync(path.join(tmpdir(), "bw-install-"))
  const installed = path.join(root, "Applications")
  mkdirSync(installed)
  const old = fakeApp(installed, "dev.bcndlabs.blackwall", "OLD")
  const staging = path.join(root, "staging")
  mkdirSync(staging)
  fakeApp(staging, newId, "NEW")
  const dmg = path.join(root, "Blackwall-9.9.9-arm64.dmg")
  assert.equal(spawnSync("/usr/bin/hdiutil", ["create", "-srcfolder", staging, "-volname", "Blackwall", "-format", "UDZO", "-quiet", dmg]).status, 0)
  const work = path.join(root, "work")
  mkdirSync(work)
  const opener = path.join(root, "open-stub.sh")
  writeFileSync(opener, `#!/bin/sh\necho "$1" > "${root}/opened"\n`, { mode: 0o755 })
  const script = path.join(work, "install.sh")
  writeFileSync(script, INSTALL_SCRIPT, { mode: 0o700 })
  const result = spawnSync("/bin/sh", [script, "2147483646", dmg, old, work, opener], { timeout: 60_000 })
  return {
    status: result.status,
    log: readFileSync(path.join(work, "install.log"), "utf8"),
    marker: readFileSync(path.join(old, "Contents", "Resources", "marker"), "utf8"),
    opened: existsSync(path.join(root, "opened")) ? readFileSync(path.join(root, "opened"), "utf8").trim() : null,
    app: old,
    leftovers: readdirSync(installed),
    dmgKept: existsSync(dmg),
  }
}

test("the installer script swaps the app in and reopens it", { skip: process.platform !== "darwin" }, () => {
  const r = runInstaller("dev.bcndlabs.blackwall")
  assert.equal(r.status, 0, r.log)
  assert.equal(r.marker, "NEW")
  assert.equal(r.opened, r.app)
  assert.deepEqual(r.leftovers, ["Blackwall.app"], "no .update-old or .update-new left behind")
  assert.equal(r.dmgKept, false)
})

test("the installer script keeps the old app and reopens it when the new one isn't Blackwall", { skip: process.platform !== "darwin" }, () => {
  const r = runInstaller("com.example.other")
  assert.equal(r.status, 1)
  assert.match(r.log, /FAILED: the new app has a different id/)
  assert.equal(r.marker, "OLD")
  assert.equal(r.opened, r.app)
  assert.deepEqual(r.leftovers, ["Blackwall.app"])
})
