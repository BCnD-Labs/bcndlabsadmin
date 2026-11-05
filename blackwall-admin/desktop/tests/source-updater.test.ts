import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { SOURCE_UPDATE_SCRIPT, SourceUpdater, type SourceUpdaterHost } from "../src/main/source-updater.ts"

const tmp = (name: string) => mkdtempSync(path.join(tmpdir(), `bw-src-${name}-`))

/** A folder that looks like a checkout of the repo (enough for the updater's own checks). */
function fakeCheckout() {
  const repo = tmp("repo")
  mkdirSync(path.join(repo, ".git"))
  mkdirSync(path.join(repo, "blackwall-admin", "desktop"), { recursive: true })
  writeFileSync(path.join(repo, "blackwall-admin", "desktop", "package.json"), "{}")
  return repo
}

function setup(opts: { repo?: string | null; packaged?: boolean; state?: string } = {}) {
  const apps = tmp("apps")
  const temp = tmp("tmp")
  const state = opts.state ?? tmp("state")
  const launched: { script: string; args: string[] }[] = []
  let quits = 0
  const host: SourceUpdaterHost = {
    repo: () => (opts.repo === undefined ? fakeCheckout() : opts.repo),
    bundlePath: () => (opts.packaged === false ? null : path.join(apps, "Blackwall.app")),
    pid: 4242,
    tempDir: () => temp,
    stateDir: () => state,
    launch: (script, args) => void launched.push({ script, args }),
    quit: () => void quits++,
  }
  return { updater: new SourceUpdater(host), launched, state, quits: () => quits }
}

test("it says plainly when there is nothing to update from", () => {
  const none = setup({ repo: null }).updater.current()
  assert.ok(none.state === "idle" && !none.canUpdate && /No local checkout/.test(none.cantUpdateReason ?? ""))
  const notRepo = setup({ repo: tmp("empty") }).updater.current()
  assert.ok(notRepo.state === "idle" && !notRepo.canUpdate && /isn't a checkout/.test(notRepo.cantUpdateReason ?? ""))
  const dev = setup({ packaged: false }).updater.current()
  assert.ok(dev.state === "idle" && !dev.canUpdate && /development run/.test(dev.cantUpdateReason ?? ""))
  const ok = setup().updater.current()
  assert.ok(ok.state === "idle" && ok.canUpdate)
})

test("starting launches the script with the app, repo and folders, and refuses when it can't", () => {
  const t = setup()
  assert.equal(t.updater.start().state, "working")
  assert.equal(t.launched.length, 1)
  const [pid, repo, bundle, work, state] = t.launched[0].args
  assert.equal(pid, "4242")
  assert.ok(existsSync(path.join(repo, ".git")) && bundle.endsWith("Blackwall.app") && existsSync(work) && state === t.state)
  assert.equal(t.updater.start().state, "working", "a second press doesn't start a second run")
  assert.equal(t.launched.length, 1)

  const blocked = setup({ packaged: false })
  assert.equal(blocked.updater.start().state, "error")
  assert.deepEqual(blocked.launched, [])
})

test("progress follows the script's status file, and READY lets the app quit exactly once", async () => {
  const t = setup()
  t.updater.start()
  const work = t.launched[0].args[3]
  assert.deepEqual(t.updater.current(), { state: "working", step: "Starting" }, "before the script has written anything")
  writeFileSync(path.join(work, "status"), "STEP Getting the latest code\nSTEP Building the app\n")
  assert.deepEqual(t.updater.current(), { state: "working", step: "Building the app" })
  writeFileSync(path.join(work, "status"), "STEP Building the app\nREADY a1b2c3d\n")
  assert.deepEqual(t.updater.current(), { state: "restarting", commit: "a1b2c3d" })
  assert.ok(existsSync(path.join(work, "go")), "tells the script it may swap once the app has quit")
  t.updater.current()
  await new Promise((r) => setTimeout(r, 900))
  assert.equal(t.quits(), 1)
})

test("nothing new and failures end the run with a result the page can show and dismiss", () => {
  const same = setup()
  same.updater.start()
  writeFileSync(path.join(same.launched[0].args[3], "status"), "STEP Getting the latest code\nUPTODATE a1b2c3d\n")
  assert.deepEqual(same.updater.current(), { state: "current", commit: "a1b2c3d" })
  assert.ok(same.updater.dismiss().state === "idle")
  assert.equal(same.quits(), 0)

  const bad = setup()
  bad.updater.start()
  writeFileSync(path.join(bad.launched[0].args[3], "status"), "STEP Building the app\nFAILED the build failed: boom\n")
  assert.deepEqual(bad.updater.current(), { state: "error", message: "the build failed: boom" })
  assert.equal(bad.updater.start().state, "working", "Try again starts a new run")
})

test("a result left by a run that had already quit is shown once, next time the app opens", () => {
  const state = tmp("state")
  writeFileSync(path.join(state, "source-update-result.txt"), "FAILED: couldn't put the new app in place\n")
  assert.deepEqual(setup({ state }).updater.current(), { state: "error", message: "couldn't put the new app in place" })
  assert.equal(existsSync(path.join(state, "source-update-result.txt")), false)
  assert.ok(setup({ state }).updater.current().state === "idle", "gone after one look")

  writeFileSync(path.join(state, "source-update-result.txt"), "OK a1b2c3d\n")
  const done = setup({ state }).updater.current()
  assert.ok(done.state === "idle" && done.note === "Updated to a1b2c3d.")
})

// The real script, against a real git repo and app bundle; only npm and "open" are stubs.

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

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}

/** A repo with an origin (so `git pull --ff-only` works), an installed OLD app, and a stub npm that "builds" a NEW one. */
function scriptWorld(opts: { newId?: string; buildFails?: boolean } = {}) {
  const root = tmp("world")
  const origin = path.join(root, "origin.git")
  git(root, "init", "--bare", "-b", "main", origin)
  const repo = path.join(root, "repo")
  git(root, "clone", origin, repo)
  mkdirSync(path.join(repo, "blackwall-admin", "desktop"), { recursive: true })
  writeFileSync(path.join(repo, ".gitignore"), "node_modules\nrelease/\n")
  writeFileSync(path.join(repo, "blackwall-admin", "package-lock.json"), "{}")
  writeFileSync(path.join(repo, "blackwall-admin", "desktop", "package.json"), "{}")
  git(repo, "add", ".")
  git(repo, "commit", "-m", "start")
  git(repo, "push", "-u", "origin", "HEAD:main")

  const installed = path.join(root, "Applications")
  mkdirSync(installed)
  const app = fakeApp(installed, "dev.bcndlabs.blackwall", "OLD")
  const fixtures = path.join(root, "fixtures")
  mkdirSync(fixtures)
  const built = fakeApp(fixtures, opts.newId ?? "dev.bcndlabs.blackwall", "NEW")

  const bin = path.join(root, "bin")
  mkdirSync(bin)
  writeFileSync(
    path.join(bin, "npm"),
    `#!/bin/sh
echo "npm $*" >> "${root}/npm.log"
case "$1" in
  install) mkdir -p node_modules ;;
  run) ${opts.buildFails ? 'echo "boom: the build exploded"; exit 1' : `mkdir -p release/mac-arm64 && /usr/bin/ditto "${built}" release/mac-arm64/Blackwall.app`} ;;
esac
`,
    { mode: 0o755 },
  )
  const opener = path.join(root, "open-stub.sh")
  writeFileSync(opener, `#!/bin/sh\necho "$1" >> "${root}/opened"\n`, { mode: 0o755 })
  const state = path.join(root, "state")
  mkdirSync(state)

  /** Runs the script once; "go" is pre-created so it doesn't wait for an app that isn't there. */
  const run = () => {
    const work = mkdtempSync(path.join(root, "work-"))
    writeFileSync(path.join(work, "go"), "")
    const script = path.join(work, "update.sh")
    writeFileSync(script, SOURCE_UPDATE_SCRIPT, { mode: 0o700 })
    const r = spawnSync("/bin/sh", [script, "2147483646", repo, app, work, state, opener], { timeout: 120_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
    const read = (f: string) => (existsSync(path.join(work, f)) ? readFileSync(path.join(work, f), "utf8") : "")
    return { exit: r.status, status: read("status").trim().split("\n"), log: read("update.log") }
  }
  const marker = () => readFileSync(path.join(app, "Contents", "Resources", "marker"), "utf8")
  const opened = () => (existsSync(path.join(root, "opened")) ? readFileSync(path.join(root, "opened"), "utf8").trim().split("\n") : [])
  const npmCalls = () => (existsSync(path.join(root, "npm.log")) ? readFileSync(path.join(root, "npm.log"), "utf8").trim().split("\n") : [])
  return { run, marker, opened, npmCalls, app, installed, state, repo, origin }
}

test("the script pulls, installs, builds, swaps the app in and reopens it", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld()
  const r = w.run()
  assert.equal(r.exit, 0, r.log)
  assert.deepEqual(r.status.map((l) => l.split(" ")[0]), ["STEP", "STEP", "STEP", "READY"])
  assert.equal(w.marker(), "NEW")
  assert.deepEqual(w.opened(), [w.app])
  assert.deepEqual(readdirSync(w.installed), ["Blackwall.app"], "no .update-old or .update-new left behind")
  assert.deepEqual(w.npmCalls(), ["npm install --no-save --no-audit --no-fund", "npm run desktop:build -- --dir"])
  assert.match(readFileSync(path.join(w.state, "source-update-result.txt"), "utf8"), /^OK [0-9a-f]+/)
})

test("pressing it again with nothing new does nothing", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld()
  assert.equal(w.run().exit, 0)
  const again = w.run()
  assert.equal(again.exit, 0, again.log)
  assert.match(again.status[again.status.length - 1], /^UPTODATE [0-9a-f]+$/)
  assert.equal(w.npmCalls().length, 2, "no second install or build")
  assert.equal(w.opened().length, 1)
})

test("a new commit on the remote is pulled and rebuilt; packages are only installed when the lock file changes", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld()
  assert.equal(w.run().exit, 0)
  const other = path.join(path.dirname(w.origin), "other")
  git(path.dirname(w.origin), "clone", w.origin, other)
  writeFileSync(path.join(other, "NEWS.md"), "hello")
  git(other, "add", ".")
  git(other, "commit", "-m", "news")
  git(other, "push", "origin", "HEAD:main")
  const r = w.run()
  assert.equal(r.exit, 0, r.log)
  assert.ok(existsSync(path.join(w.repo, "NEWS.md")), "the new commit arrived")
  assert.deepEqual(w.npmCalls().filter((c) => c.startsWith("npm install")).length, 1, "lock file unchanged, so no second install")
  assert.equal(w.npmCalls().filter((c) => c.startsWith("npm run")).length, 2, "but it did rebuild")
})

test("a failed build stops before the app closes and leaves the installed app alone", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld({ buildFails: true })
  const r = w.run()
  assert.equal(r.exit, 1)
  assert.match(r.status[r.status.length - 1], /^FAILED the build failed: boom: the build exploded/)
  assert.equal(w.marker(), "OLD")
  assert.deepEqual(w.opened(), [], "it never closed the app, so there is nothing to reopen")
  assert.equal(existsSync(path.join(w.state, "source-update-result.txt")), false)
})

test("a build with the wrong app id is refused before anything is replaced", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld({ newId: "com.example.other" })
  const r = w.run()
  assert.equal(r.exit, 1)
  assert.match(r.status[r.status.length - 1], /^FAILED the new app has a different id/)
  assert.equal(w.marker(), "OLD")
  assert.deepEqual(readdirSync(w.installed), ["Blackwall.app"])
})

test("a repo that can't fast-forward is reported with git's own words", { skip: process.platform !== "darwin" }, () => {
  const w = scriptWorld()
  writeFileSync(path.join(w.repo, "local.txt"), "mine")
  git(w.repo, "add", ".")
  git(w.repo, "commit", "-m", "local only")
  const other = path.join(path.dirname(w.origin), "other")
  git(path.dirname(w.origin), "clone", w.origin, other)
  writeFileSync(path.join(other, "remote.txt"), "theirs")
  git(other, "add", ".")
  git(other, "commit", "-m", "remote only")
  git(other, "push", "origin", "HEAD:main")
  const r = w.run()
  assert.equal(r.exit, 1)
  assert.match(r.status[r.status.length - 1], /^FAILED git pull didn't work/)
  assert.equal(w.marker(), "OLD")
})
