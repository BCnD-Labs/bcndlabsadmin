import assert from "node:assert/strict"
import { test } from "node:test"
import { clearIconCache, customLogoSource, iconUrl, loadIcon } from "../src/lib/service-logo.ts"

const A = "https://blackwall.example.ts.net/"
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'

test("uploaded logos: raster data URLs are images, SVG data URLs are decoded, anything else is ignored", () => {
  assert.deepEqual(customLogoSource("data:image/png;base64,iVBORw0KGgo="), { kind: "image", uri: "data:image/png;base64,iVBORw0KGgo=" })
  assert.deepEqual(customLogoSource(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`), { kind: "svg", xml: SVG })
  assert.deepEqual(customLogoSource(`data:image/svg+xml;base64,${btoa(SVG)}`), { kind: "svg", xml: SVG })
  assert.equal(customLogoSource(undefined), null)
  assert.equal(customLogoSource("https://example.com/logo.png"), null)
  assert.equal(customLogoSource("data:image/svg+xml,%E0%A4%A"), null)
  assert.equal(customLogoSource(`data:image/svg+xml,${encodeURIComponent("<p>not svg</p>")}`), null)
})

test("named logos come from the server once per session; bad names and failures are no logo", async () => {
  clearIconCache()
  assert.equal(iconUrl(A, "uptime-kuma"), "https://blackwall.example.ts.net/api/icons/uptime-kuma")
  let calls = 0
  const ok = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++
    assert.equal((init?.headers as Record<string, string>)["X-Blackwall"], "1")
    assert.equal(String(url), "https://blackwall.example.ts.net/api/icons/nextcloud")
    return new Response(JSON.stringify({ svg: SVG }))
  }
  assert.equal(await loadIcon(A, "nextcloud", ok), SVG)
  assert.equal(await loadIcon(A, "nextcloud", ok), SVG)
  assert.equal(calls, 1)
  assert.equal(await loadIcon(A, "../etc", ok), null)
  assert.equal(await loadIcon(A, undefined, ok), null)
  assert.equal(await loadIcon(A, "missing", async () => new Response("{}", { status: 404 })), null)
  assert.equal(await loadIcon(A, "odd", async () => new Response(JSON.stringify({ svg: "<p>" }))), null)
  assert.equal(await loadIcon(A, "down", async () => { throw new Error("offline") }), null)
})
