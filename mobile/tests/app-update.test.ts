import assert from "node:assert/strict"
import { test } from "node:test"
import { apkUrl, checkForUpdate, manifestUrl, parseManifest } from "../src/lib/app-update.ts"

const reply = (status: number, body?: unknown) => (async () => new Response(body === undefined ? "" : JSON.stringify(body), { status })) as unknown as typeof fetch

test("addresses ignore trailing slashes and encode the file name", () => {
  assert.equal(manifestUrl("https://blackwall.example.ts.net/"), "https://blackwall.example.ts.net/api/app-updates/android.json")
  assert.equal(apkUrl("https://blackwall.example.ts.net", "blackwall-0.2.0.apk"), "https://blackwall.example.ts.net/api/app-updates/files/blackwall-0.2.0.apk")
})

test("manifests must name a plain .apk and a whole build number", () => {
  assert.deepEqual(parseManifest({ versionCode: 3, versionName: "0.3.0", file: "blackwall.apk" }), { versionCode: 3, versionName: "0.3.0", file: "blackwall.apk", notes: undefined })
  for (const bad of [null, {}, { versionCode: 0, file: "a.apk" }, { versionCode: 1.5, file: "a.apk" }, { versionCode: 2, file: "../a.apk" }, { versionCode: 2, file: "a/b.apk" }, { versionCode: 2, file: "a.exe" }, { versionCode: "2", file: "a.apk" }]) {
    assert.equal(parseManifest(bad), null, JSON.stringify(bad))
  }
})

test("update check: newer is available, same or older is current, problems say why", async () => {
  const manifest = { versionCode: 3, versionName: "0.3.0", file: "blackwall.apk" }
  const newer = await checkForUpdate("https://x.example.ts.net", 2, reply(200, manifest))
  assert.equal(newer.status, "available")
  assert.equal(newer.status === "available" && newer.url, "https://x.example.ts.net/api/app-updates/files/blackwall.apk")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 3, reply(200, manifest))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 9, reply(200, manifest))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, reply(404))).status, "unavailable")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, reply(200, { nope: true }))).status, "unavailable")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, (async () => { throw new Error("offline") }) as unknown as typeof fetch)).status, "unavailable")
})
