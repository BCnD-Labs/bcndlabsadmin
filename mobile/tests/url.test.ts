import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyLink, normalizeAddress, originOf } from "../src/lib/url.ts"
import { PULL_GUARD_SCRIPT, PULL_MESSAGE, readPullMessage } from "../src/lib/bridge.ts"
import { sanitizeViewMode } from "../src/lib/view-mode.ts"

const ORIGIN = "https://blackwall.example.ts.net"

const ok = (input: string) => {
  const r = normalizeAddress(input)
  assert.ok(r.ok, `${input} → ${!r.ok ? r.error : ""}`)
  return r
}
const bad = (input: string) => {
  const r = normalizeAddress(input)
  assert.equal(r.ok, false, `${input} should be rejected`)
  return r.ok ? "" : r.error
}

test("address: bare hosts get https://, everything normalizes to the origin root", () => {
  assert.deepEqual(ok("blackwall.example.ts.net"), { ok: true, url: `${ORIGIN}/`, origin: ORIGIN })
  assert.equal(ok("https://blackwall.example.ts.net").url, `${ORIGIN}/`)
  assert.equal(ok("  HTTPS://BlackWall.Example.TS.net/  ").url, `${ORIGIN}/`)
  assert.equal(ok("https://blackwall.example.ts.net/productivity/planner?x=1#top").url, `${ORIGIN}/`)
  assert.equal(ok("blackwall.example.ts.net.").url, `${ORIGIN}/`)
  assert.equal(ok("https://blackwall.example.ts.net:443/").url, `${ORIGIN}/`)
  assert.equal(ok("blackwall.example.ts.net:8443").url, `${ORIGIN}:8443/`)
  assert.equal(ok("https://100.64.0.1/").url, "https://100.64.0.1/")
  assert.equal(ok("https://[fd7a:115c:a1e0::1]:8443").url, "https://[fd7a:115c:a1e0::1]:8443/")
  assert.equal(ok("mikoshi").url, "https://mikoshi/")
})

test("address: https only; dangerous schemes, credentials and malformed input are refused", () => {
  assert.match(bad("http://blackwall.example.ts.net"), /https/)
  for (const input of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "file:///etc/hosts", "data:text/html,<b>x</b>",
    "content://com.android.contacts", "intent://scan/#Intent;scheme=zxing;end", "ftp://blackwall.example.ts.net",
    "blob:https://blackwall.example.ts.net/1", "about:blank", "ws://x", "obsidian://open",
  ]) bad(input)
  assert.match(bad("https://me:pw@blackwall.example.ts.net"), /username or password/)
  assert.match(bad("https://evil.example@blackwall.example.ts.net"), /username or password/)
  for (const input of [
    "", "   ", "https://", "https:///path", "https://bad host.ts.net", "https://-bad.ts.net", "https://bad-.ts.net",
    "https://a..b", "https://blackwall.example.ts.net:0", "https://blackwall.example.ts.net:70000",
    "https://blackwall.example.ts.net:abc", "https://bläckwall.example", "https://exa\tmple.com",
    "https://blackwall.example.ts.net\\@evil.com", "https://999.1.1.1", "https://1.2.3", "//blackwall.example.ts.net",
    `https://${"a".repeat(64)}.com`, `https://${"a.".repeat(130)}com`, "x".repeat(3000),
  ]) bad(input)
})

test("originOf: lowercases, strips default ports, rejects userinfo and junk", () => {
  assert.equal(originOf("https://BlackWall.Example.ts.net:443/a?b#c"), ORIGIN)
  assert.equal(originOf("http://example.com:80"), "http://example.com")
  assert.equal(originOf("https://example.com:8443/"), "https://example.com:8443")
  assert.equal(originOf("https://user@example.com/"), null)
  assert.equal(originOf("https://exa mple.com/"), null)
  assert.equal(originOf("javascript:alert(1)"), null)
  assert.equal(originOf("https://example.com\\@evil.com/"), null)
})

test("links: your origin loads in the app, other web sites go to the browser", () => {
  assert.equal(classifyLink(`${ORIGIN}/productivity/planner`, ORIGIN), "load")
  assert.equal(classifyLink(`${ORIGIN.toUpperCase()}:443/x`, ORIGIN), "load")
  assert.equal(classifyLink("about:blank", ORIGIN), "load")
  assert.equal(classifyLink("https://github.com/BCnD-Labs", ORIGIN), "browser")
  assert.equal(classifyLink("https://blackwall.example.ts.net.evil.com/", ORIGIN), "browser")
  assert.equal(classifyLink("https://evil.com/?u=https://blackwall.example.ts.net", ORIGIN), "browser")
  assert.equal(classifyLink("https://blackwall.example.ts.net:8443/", ORIGIN), "browser")
  // A downgrade to http on the same host is a different origin, not an in-app load.
  assert.equal(classifyLink("http://blackwall.example.ts.net/", ORIGIN), "browser")
})

test("links: app schemes ask first; script, file, intent and malformed URLs are blocked", () => {
  for (const u of ["mailto:me@example.com", "tel:+15551234", "obsidian://open?vault=x", "sms:123"]) assert.equal(classifyLink(u, ORIGIN), "app", u)
  for (const u of [
    "javascript:alert(1)", " JAVASCRIPT:alert(1)", "vbscript:x", "file:///sdcard/x", "data:text/html,hi",
    "blob:https://blackwall.example.ts.net/abc", "content://media/external", "intent://x#Intent;end",
    "android-app://com.example", "about:config", "chrome://settings", "view-source:https://x.com",
    "https://user:pw@blackwall.example.ts.net/", "https://exa mple.com", "/relative/path", "", "https://",
    "https://example.com\u0000.blackwall", "ws://blackwall.example.ts.net",
  ]) assert.equal(classifyLink(u, ORIGIN), "block", JSON.stringify(u))
})

test("pull-to-refresh bridge: only the exact message, only from your origin", () => {
  assert.equal(readPullMessage(PULL_MESSAGE.allow, `${ORIGIN}/planner`, ORIGIN), true)
  assert.equal(readPullMessage(PULL_MESSAGE.deny, `${ORIGIN}/`, ORIGIN), false)
  assert.equal(readPullMessage(PULL_MESSAGE.allow, "https://evil.com/", ORIGIN), null)
  assert.equal(readPullMessage("bw:pull:1 ", `${ORIGIN}/`, ORIGIN), null)
  assert.equal(readPullMessage({ allow: true }, `${ORIGIN}/`, ORIGIN), null)
  assert.match(PULL_GUARD_SCRIPT, /passive: true/)
  assert.doesNotThrow(() => new Function(PULL_GUARD_SCRIPT))
})

test("view mode: web by default; native only once it exists", () => {
  assert.equal(sanitizeViewMode(null, false), "web")
  assert.equal(sanitizeViewMode("native", false), "web")
  assert.equal(sanitizeViewMode("native", true), "native")
  assert.equal(sanitizeViewMode("garbage", true), "web")
})
