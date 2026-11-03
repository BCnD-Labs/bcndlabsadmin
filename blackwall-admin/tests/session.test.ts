import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { createServer, type IncomingMessage } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { mock, test } from "node:test"
import { createApi } from "../server/app.ts"
import { hashPassword, REMEMBER_S, SESSION_S, Sessions } from "../server/auth.ts"
import { FileConnectionStore } from "../server/store.ts"
import { FileWorkspaceStore } from "../server/workspace.ts"

const KEY = Buffer.alloc(32, 7)
const T0 = Date.UTC(2026, 10, 2, 12, 0, 0)

/** Splits a Set-Cookie header into its value and attributes. */
function parse(setCookie: string) {
  const [pair, ...attrs] = setCookie.split(/;\s*/)
  const map = new Map(attrs.map((a) => { const [k, v = ""] = a.split("="); return [k.toLowerCase(), v] as const }))
  const value = pair.slice(pair.indexOf("=") + 1)
  return { pair, value, exp: Number(value.split(".")[0]), attrs: map }
}

const reqWith = (cookie: string) => ({ headers: { cookie } }) as IncomingMessage

test("remember me: 30-day persistent cookie with a 30-day signed expiry", () => {
  mock.timers.enable({ apis: ["Date"], now: T0 })
  try {
    const c = parse(new Sessions(KEY).issue(true, true))
    assert.equal(c.attrs.get("max-age"), String(30 * 24 * 3600))
    assert.equal(c.exp, T0 / 1000 + REMEMBER_S)
    assert.ok(c.attrs.has("httponly"))
    assert.equal(c.attrs.get("samesite"), "Strict")
    assert.ok(c.attrs.has("secure"))
    assert.equal(c.attrs.get("path"), "/")
  } finally {
    mock.timers.reset()
  }
})

test("not remembered: browser-session cookie (no Max-Age/Expires) with a 12-hour signed expiry", () => {
  mock.timers.enable({ apis: ["Date"], now: T0 })
  try {
    for (const c of [parse(new Sessions(KEY).issue(true, false)), parse(new Sessions(KEY).issue(true))]) {
      assert.equal(c.attrs.has("max-age"), false)
      assert.equal(c.attrs.has("expires"), false)
      assert.equal(c.exp, T0 / 1000 + 12 * 3600)
      assert.equal(SESSION_S, 12 * 3600)
      assert.ok(c.attrs.has("httponly"))
      assert.equal(c.attrs.get("samesite"), "Strict")
      assert.ok(c.attrs.has("secure"))
    }
    assert.equal(parse(new Sessions(KEY).issue(false, false)).attrs.has("secure"), false)
  } finally {
    mock.timers.reset()
  }
})

test("server enforces each expiry: 12 hours unchecked, 30 days checked", () => {
  mock.timers.enable({ apis: ["Date"], now: T0 })
  try {
    const sessions = new Sessions(KEY)
    const short = reqWith(parse(sessions.issue(true, false)).pair)
    const long = reqWith(parse(sessions.issue(true, true)).pair)
    mock.timers.setTime(T0 + (12 * 3600 - 60) * 1000)
    assert.equal(sessions.valid(short), true, "unchecked session valid just before 12 h")
    mock.timers.setTime(T0 + (12 * 3600 + 60) * 1000)
    assert.equal(sessions.valid(short), false, "unchecked session rejected after 12 h")
    assert.equal(sessions.valid(long), true, "remembered session still valid after 12 h")
    mock.timers.setTime(T0 + (REMEMBER_S - 60) * 1000)
    assert.equal(sessions.valid(long), true, "remembered session valid just before 30 days")
    mock.timers.setTime(T0 + (REMEMBER_S + 60) * 1000)
    assert.equal(sessions.valid(long), false, "remembered session rejected after 30 days")
  } finally {
    mock.timers.reset()
  }
})

test("cookie format unchanged: a cookie signed the old way still validates; tampering fails", () => {
  // Re-creates the pre-change signing (`<exp>.<hmac>` with the derived session key) independently.
  const key = createHmac("sha256", KEY).update("blackwall-session-v1").digest()
  const exp = String(Math.floor(Date.now() / 1000) + 30 * 24 * 3600)
  const legacy = `bw_session=${exp}.${createHmac("sha256", key).update(exp).digest("base64url")}`
  const sessions = new Sessions(KEY)
  assert.equal(sessions.valid(reqWith(legacy)), true)
  const later = String(Number(exp) + 3600)
  assert.equal(sessions.valid(reqWith(legacy.replace(`=${exp}.`, `=${later}.`))), false)
  assert.equal(new Sessions(Buffer.alloc(32, 8)).valid(reqWith(legacy)), false)
})

test("login route: `remember` in the body picks the cookie; only an explicit true remembers", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bw-session-test-"))
  const sessions = new Sessions(KEY)
  const api = createApi({ store: new FileConnectionStore(root), workspace: new FileWorkspaceStore(root), auth: { sessions, passwordHash: hashPassword("test-password") } })
  const server = createServer((req, res) => { void api(req, res) })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  const login = (body: unknown) =>
    fetch(`${base}/login`, { method: "POST", headers: { "X-Blackwall": "1", "Content-Type": "application/json" }, body: JSON.stringify(body) })
  try {
    const remembered = await login({ password: "test-password", remember: true })
    assert.equal(remembered.status, 200)
    const r = parse(remembered.headers.get("set-cookie") ?? "")
    assert.equal(r.attrs.get("max-age"), String(REMEMBER_S))
    assert.equal(r.attrs.get("samesite"), "Strict")
    assert.ok(r.attrs.has("httponly"))

    for (const body of [{ password: "test-password" }, { password: "test-password", remember: false }, { password: "test-password", remember: "true" }]) {
      const res = await login(body)
      assert.equal(res.status, 200)
      const c = parse(res.headers.get("set-cookie") ?? "")
      assert.equal(c.attrs.has("max-age"), false, JSON.stringify(body))
      assert.ok(c.exp - Date.now() / 1000 <= SESSION_S + 1, JSON.stringify(body))
      const session = await (await fetch(`${base}/session`, { headers: { "X-Blackwall": "1", Cookie: c.pair } })).json()
      assert.deepEqual(session, { authRequired: true, authenticated: true })
    }

    const wrong = await login({ password: "nope", remember: true })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.headers.get("set-cookie"), null)
    // The X-Blackwall rule still applies to login.
    const noHeader = await fetch(`${base}/login`, { method: "POST", body: JSON.stringify({ password: "test-password", remember: true }) })
    assert.equal(noHeader.status, 403)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()))
    rmSync(root, { recursive: true, force: true })
  }
})
