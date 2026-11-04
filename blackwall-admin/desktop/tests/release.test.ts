import assert from "node:assert/strict"
import { test } from "node:test"
import { DMG_NAME, macManifest, releaseTag, versionCode } from "../src/shared/release.ts"

const SHA = "a".repeat(64)

test("version numbers order the way versions do", () => {
  assert.equal(versionCode("0.3.1"), 301)
  assert.equal(versionCode("0.3.10"), 310)
  assert.equal(versionCode("0.4.0"), 400)
  assert.equal(versionCode("1.0.0"), 10_000)
  assert.ok(versionCode("0.3.10")! > versionCode("0.3.9")!)
  assert.ok(versionCode("0.10.0")! > versionCode("0.9.99")!)
  for (const bad of ["", "1", "1.2", "1.2.3.4", "0.3.1-beta", "v0.3.1", "0.100.0", "0.0.100", "a.b.c"]) assert.equal(versionCode(bad), null, bad)
})

test("a manifest comes from the installer's own name", () => {
  const m = macManifest("Blackwall-0.3.1-arm64.dmg", SHA, "Fixes styling")
  assert.deepEqual(m, { versionCode: 301, versionName: "0.3.1", file: "Blackwall-0.3.1-arm64.dmg", sha256: SHA, notes: "Fixes styling" })
  assert.equal(releaseTag(301), "mac-build-301")
  assert.ok(!("notes" in (macManifest("Blackwall-0.3.1-x64.dmg", SHA) as object)))
})

test("a wrongly named installer or checksum is refused", () => {
  for (const file of ["Blackwall-0.3.1.dmg", "blackwall-0.3.1-arm64.dmg", "Blackwall-0.3.1-arm64.dmg.zip", "../Blackwall-0.3.1-arm64.dmg", "Blackwall-0.3.100-arm64.dmg"]) {
    assert.ok(macManifest(file, SHA) instanceof Error, file)
  }
  assert.ok(macManifest("Blackwall-0.3.1-arm64.dmg", "xyz") instanceof Error)
  assert.ok(DMG_NAME.test("Blackwall-0.3.1-arm64.dmg"))
})
