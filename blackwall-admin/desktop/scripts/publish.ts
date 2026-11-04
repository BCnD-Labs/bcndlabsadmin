// `node desktop/scripts/publish.ts [--notes "what changed"]`: puts the Mac build you just made
// (`npm run desktop:build`) on GitHub so every installed Blackwall can update itself from Settings.
//
// It uploads release/Blackwall-<version>-<arch>.dmg and a mac.json manifest (build number and sha256)
// to a prerelease tagged mac-build-<number>. Your Blackwall server mirrors that release (same GitHub
// token as the Android updates) and the Mac app downloads it from the server, never from GitHub.
//
// Needs the GitHub CLI signed in with access to the repo (`gh auth status`). Bump `version` in
// desktop/package.json first: an app only updates to a higher version.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { macManifest, releaseTag } from "../src/shared/release.ts"

const root = path.join(import.meta.dirname, "..", "..")
const fail = (message: string): never => {
  console.error(`[publish] ${message}`)
  process.exit(1)
}
const gh = (...args: string[]) => spawnSync("gh", args, { cwd: root, encoding: "utf8" })

const notesAt = process.argv.indexOf("--notes")
const notes = notesAt > 0 ? process.argv[notesAt + 1] : undefined

const { version } = JSON.parse(readFileSync(path.join(root, "desktop", "package.json"), "utf8")) as { version: string }
const arch = process.arch === "arm64" ? "arm64" : "x64"
const file = `Blackwall-${version}-${arch}.dmg`
const dmg = path.join(root, "release", file)
if (!existsSync(dmg)) fail(`${path.join("release", file)} doesn't exist. Run \`npm --prefix blackwall-admin run desktop:build\` first.`)

const manifest = macManifest(file, createHash("sha256").update(readFileSync(dmg)).digest("hex"), notes)
if (manifest instanceof Error) fail(manifest.message)
else {
  const repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner")
  if (repo.status !== 0) fail(`GitHub CLI isn't ready: ${repo.stderr.trim() || "run `gh auth login`"}`)
  const slug = repo.stdout.trim()
  const tag = releaseTag(manifest.versionCode)
  if (gh("release", "view", tag, "--repo", slug).status === 0) fail(`${tag} is already published. Bump the version in desktop/package.json and build again.`)

  const dir = mkdtempSync(path.join(tmpdir(), "blackwall-publish-"))
  try {
    const manifestFile = path.join(dir, "mac.json")
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n")
    const created = spawnSync(
      "gh",
      ["release", "create", tag, dmg, manifestFile, "--repo", slug, "--prerelease", "--title", `Mac build ${manifest.versionName}`, "--notes", notes ?? `Blackwall for Mac ${manifest.versionName}. The app installs this from Settings; mac.json is the update manifest.`],
      { cwd: root, stdio: "inherit" },
    )
    if (created.status !== 0) fail("gh couldn't create the release.")
    console.log(`[publish] ${tag}: Blackwall ${manifest.versionName} is published. Open Settings → About in the Mac app and press Check for updates.`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
