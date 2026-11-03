import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { ConfigStore, sanitizeConfig } from "../src/main/config.ts"

test("sanitizeConfig keeps valid fields and drops the rest", () => {
  const c = sanitizeConfig({
    webAddress: "blackwall.example.ts.net",
    pinnedUrl: "javascript:alert(1)",
    window: { x: 10, y: 20, width: 50, height: 900, maximized: "yes" },
    tabs: [{ url: "https://a.test/", title: "A" }, { url: "file:///etc/hosts", title: "x" }, { url: "https://b.test/" }, null],
    activeIndex: 7,
  })
  assert.equal(c.webAddress, "https://blackwall.example.ts.net/")
  assert.equal(c.pinnedUrl, null)
  assert.deepEqual(c.window, { x: 10, y: 20, width: 1280, height: 900, maximized: false })
  assert.deepEqual(c.tabs, [{ url: "https://a.test/", title: "A" }, { url: "https://b.test/", title: "" }])
  assert.equal(c.activeIndex, 0)
  assert.equal(sanitizeConfig("garbage").webAddress, null)
})

test("ConfigStore round-trips through disk and survives a corrupt file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bw-desktop-"))
  try {
    const a = new ConfigStore(dir)
    assert.equal(a.get().webAddress, null)
    a.update({ webAddress: "https://a.test/", tabs: [{ url: "https://b.test/", title: "B" }], activeIndex: 1 })
    a.flush()
    const file = path.join(dir, "desktop-config.json")
    assert.equal(statSync(file).mode & 0o777, 0o600)
    const b = new ConfigStore(dir)
    assert.equal(b.get().webAddress, "https://a.test/")
    assert.equal(b.get().activeIndex, 1)
    writeFileSync(file, "{not json")
    assert.equal(new ConfigStore(dir).get().webAddress, null)
    assert.ok(readFileSync(file, "utf8").startsWith("{not"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
