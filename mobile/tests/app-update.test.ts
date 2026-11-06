import assert from "node:assert/strict"
import { test } from "node:test"
import { apkUrl, checkForUpdate, manifestUrl, parseManifest, percent } from "../src/lib/app-update.ts"

const sent: Record<string, string>[] = []
const reply = (status: number, body?: unknown) =>
  (async (_url: unknown, init?: RequestInit) => {
    sent.push(init?.headers as Record<string, string>)
    return new Response(body === undefined ? "" : JSON.stringify(body), { status })
  }) as unknown as typeof fetch

test("addresses ignore trailing slashes and encode the file name", () => {
  assert.equal(manifestUrl("https://blackwall.example.ts.net/"), "https://blackwall.example.ts.net/api/app-updates/android.json")
  assert.equal(apkUrl("https://blackwall.example.ts.net", "blackwall-0.2.0.apk"), "https://blackwall.example.ts.net/app-updates/blackwall-0.2.0.apk")
})

test("manifests must name a plain .apk and a whole build number", () => {
  assert.deepEqual(parseManifest({ versionCode: 3, versionName: "0.3.0", file: "blackwall.apk" }), { versionCode: 3, versionName: "0.3.0", file: "blackwall.apk", md5: undefined, notes: undefined })
  assert.equal(parseManifest({ versionCode: 3, file: "a.apk", md5: "ABCDEF0123456789ABCDEF0123456789" })?.md5, "abcdef0123456789abcdef0123456789")
  assert.equal(parseManifest({ versionCode: 3, file: "a.apk", md5: "nothex" })?.md5, undefined)
  for (const bad of [null, {}, { versionCode: 0, file: "a.apk" }, { versionCode: 1.5, file: "a.apk" }, { versionCode: 2, file: "../a.apk" }, { versionCode: 2, file: "a/b.apk" }, { versionCode: 2, file: "a.exe" }, { versionCode: "2", file: "a.apk" }]) {
    assert.equal(parseManifest(bad), null, JSON.stringify(bad))
  }
})

test("update check: newer is available, same or older is current, problems say why", async () => {
  const manifest = { versionCode: 3, versionName: "0.3.0", file: "blackwall.apk" }
  const newer = await checkForUpdate("https://x.example.ts.net", 2, reply(200, manifest))
  assert.equal(newer.status, "available")
  assert.equal(newer.status === "available" && newer.url, "https://x.example.ts.net/app-updates/blackwall.apk")
  assert.equal(sent[0]["X-Blackwall"], "1") // the API rejects requests without it
  assert.equal((await checkForUpdate("https://x.example.ts.net", 3, reply(200, manifest))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 9, reply(200, manifest))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, reply(404))).status, "unavailable")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, reply(200, { nope: true }))).status, "unavailable")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 1, (async () => { throw new Error("offline") }) as unknown as typeof fetch)).status, "unavailable")
})

test("download progress is a whole percent and never leaves 0 to 100", () => {
  assert.equal(percent(0, 1000), 0)
  assert.equal(percent(500, 1000), 50)
  assert.equal(percent(999, 1000), 99)
  assert.equal(percent(2000, 1000), 100)
  assert.equal(percent(50, 0), 0)
  assert.equal(percent(-5, 100), 0)
  assert.equal(percent(Number.NaN, 100), 0)
})


test("the latest published identity can update the same Android version without looping or downgrading", async () => {
  const manifest = { versionCode: 26, versionName: "0.26.0", file: "blackwall-android-26.apk", updateId: "b".repeat(64) }
  assert.equal((await checkForUpdate("https://x.example.ts.net", 26, reply(200, manifest), "a".repeat(64))).status, "available")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 26, reply(200, manifest), "b".repeat(64))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 27, reply(200, manifest), "a".repeat(64))).status, "current")
  assert.equal((await checkForUpdate("https://x.example.ts.net", 25, reply(200, manifest))).status, "available")
})

test("Expo and the APK publisher share a stable stamped update identity", async () => {
  const { createRequire } = await import("node:module")
  const require = createRequire(import.meta.url)
  const configure = require("../app.config.js")
  const config = require("../app.json").expo
  const old = process.env.BLACKWALL_ANDROID_UPDATE_ID
  try {
    delete process.env.BLACKWALL_ANDROID_UPDATE_ID
    const first = configure({ config }).extra.updateId
    assert.match(first, /^[a-f0-9]{64}$/)
    assert.equal(configure({ config: { ...config, _internal: {} } }).extra.updateId, first)
    process.env.BLACKWALL_ANDROID_UPDATE_ID = "c".repeat(64)
    assert.equal(configure({ config }).extra.updateId, "c".repeat(64))
  } finally {
    if (old === undefined) delete process.env.BLACKWALL_ANDROID_UPDATE_ID
    else process.env.BLACKWALL_ANDROID_UPDATE_ID = old
  }
})
