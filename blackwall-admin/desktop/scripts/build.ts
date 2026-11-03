// `npm run desktop:build`: packages the app with electron-builder, then copies
// the .app and .dmg into release/.
//
// The build itself runs in a temporary folder: when the repo is in an
// iCloud-synced folder (like ~/Desktop), macOS's File Provider tags every new
// file with Finder/fileprovider attributes that codesign rejects ("resource
// fork, Finder information, or similar detritus not allowed"), and clearing
// them doesn't stick. Signing outside the synced folder avoids that.
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const root = path.join(import.meta.dirname, "..", "..")
const release = path.join(root, "release")
const staging = mkdtempSync(path.join(tmpdir(), "blackwall-desktop-build-"))

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

try {
  run(path.join(root, "node_modules", ".bin", "electron-builder"), [
    "--config", "desktop/electron-builder.yml", "--mac", "--publish", "never",
    `-c.directories.output=${staging}`, ...process.argv.slice(2),
  ])
  mkdirSync(release, { recursive: true })
  for (const name of readdirSync(staging)) {
    if (!/^mac(-\w+)?$/.test(name) && !name.endsWith(".dmg")) continue
    rmSync(path.join(release, name), { recursive: true, force: true })
    run("ditto", [path.join(staging, name), path.join(release, name)]) // ditto keeps bundle metadata intact
    console.log(`[desktop] release/${name}`)
  }
} finally {
  rmSync(staging, { recursive: true, force: true })
}
