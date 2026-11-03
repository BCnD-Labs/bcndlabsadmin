import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { createServer, request } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { parseUpdateManifest, readUpdateManifest, serveAppUpdates } from "../server/app-updates.ts"

test("manifests need a whole build number and a plain .apk name", () => {
  const sha = "a".repeat(64)
  assert.deepEqual(parseUpdateManifest({ versionCode: 3, versionName: "0.3.0", file: "blackwall.apk", sha256: sha.toUpperCase(), md5: "B".repeat(32) }), { versionCode: 3, versionName: "0.3.0", file: "blackwall.apk", sha256: sha, md5: "b".repeat(32), notes: undefined })
  assert.equal(parseUpdateManifest({ versionCode: 3, file: "x.apk" })?.versionName, "3")
  for (const bad of [null, [], {}, { versionCode: 0, file: "a.apk" }, { versionCode: 1.5, file: "a.apk" }, { versionCode: 1, file: "../a.apk" }, { versionCode: 1, file: "a/b.apk" }, { versionCode: 1, file: ".hidden.apk" }, { versionCode: 1, file: "a.exe" }]) {
    assert.equal(parseUpdateManifest(bad), null, JSON.stringify(bad))
  }
})

test("a missing folder, missing file or broken JSON reads as no update", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bw-upd-"))
  assert.equal(readUpdateManifest(undefined), null)
  assert.equal(readUpdateManifest(dir), null)
  writeFileSync(path.join(dir, "android.json"), "{nope")
  assert.equal(readUpdateManifest(dir), null)
  writeFileSync(path.join(dir, "android.json"), JSON.stringify({ versionCode: 2, versionName: "0.2.0", file: "b.apk" }))
  assert.equal(readUpdateManifest(dir)?.versionCode, 2)
})

function get(port: number, urlPath: string, host: string, method = "GET"): Promise<{ status: number; type?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ port, path: urlPath, method, headers: { host } }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => resolve({ status: res.statusCode ?? 0, type: res.headers["content-type"], body }))
    })
    req.on("error", reject)
    req.end()
  })
}

test("only the manifest's apk is served, to allowed hosts", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bw-upd-"))
  writeFileSync(path.join(dir, "android.json"), JSON.stringify({ versionCode: 2, versionName: "0.2.0", file: "blackwall-android-2.apk" }))
  writeFileSync(path.join(dir, "blackwall-android-2.apk"), "APKBYTES")
  writeFileSync(path.join(dir, "secret.txt"), "nope")
  const server = createServer(serveAppUpdates(dir, (h) => h === "blackwall.example.ts.net"))
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const port = (server.address() as AddressInfo).port
  try {
    const ok = await get(port, "/app-updates/blackwall-android-2.apk", "blackwall.example.ts.net")
    assert.equal(ok.status, 200)
    assert.equal(ok.type, "application/vnd.android.package-archive")
    assert.equal(ok.body, "APKBYTES")
    assert.equal((await get(port, "/app-updates/blackwall-android-2.apk", "blackwall.example.ts.net", "HEAD")).status, 200)
    assert.equal((await get(port, "/app-updates/blackwall-android-2.apk", "evil.example.com")).status, 403)
    assert.equal((await get(port, "/app-updates/secret.txt", "blackwall.example.ts.net")).status, 404)
    assert.equal((await get(port, "/app-updates/android.json", "blackwall.example.ts.net")).status, 404)
    assert.equal((await get(port, "/app-updates/..%2Fandroid.json", "blackwall.example.ts.net")).status, 404)
    assert.equal((await get(port, "/app-updates/blackwall-android-2.apk", "blackwall.example.ts.net", "POST")).status, 405)
  } finally {
    server.close()
  }
})
