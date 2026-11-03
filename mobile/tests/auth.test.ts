import assert from "node:assert/strict"
import { mock, test } from "node:test"
import { REQUEST_TIMEOUT_MS, apiUrl, sessionStatus, signIn, signOut, statusLabel } from "../src/lib/auth.ts"

const ADDRESS = "https://blackwall.example.ts.net/"
const SECRET = "hunter2-correct-horse"

type Call = { url: string; init: RequestInit }
function fake(status: number, body?: unknown, raw?: string) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(raw ?? (body === undefined ? "" : JSON.stringify(body)), { status })
  }) as unknown as typeof fetch
  return { calls, impl }
}
const down = (() => Promise.reject(new TypeError("Network request failed"))) as unknown as typeof fetch

test("urls ignore trailing slashes", () => {
  assert.equal(apiUrl(ADDRESS, "login"), "https://blackwall.example.ts.net/api/login")
  assert.equal(apiUrl("https://x.example.ts.net", "session"), "https://x.example.ts.net/api/session")
})

test("session status maps the server's answer", async () => {
  assert.equal(await sessionStatus(ADDRESS, fake(200, { authRequired: true, authenticated: true }).impl), "signed-in")
  assert.equal(await sessionStatus(ADDRESS, fake(200, { authRequired: true, authenticated: false }).impl), "signed-out")
  assert.equal(await sessionStatus(ADDRESS, fake(200, { authRequired: false, authenticated: true }).impl), "no-login-needed")
})

test("session status is unreachable for network errors, bad statuses and unexpected bodies", async () => {
  assert.equal(await sessionStatus(ADDRESS, down), "unreachable")
  assert.equal(await sessionStatus(ADDRESS, fake(403, { error: "Forbidden" }).impl), "unreachable")
  assert.equal(await sessionStatus(ADDRESS, fake(502).impl), "unreachable")
  assert.equal(await sessionStatus(ADDRESS, fake(200, undefined, "<html>proxy</html>").impl), "unreachable")
  assert.equal(await sessionStatus(ADDRESS, fake(200, { authenticated: true }).impl), "unreachable")
})

test("requests carry the server's header, send the cookie store along and use the right route", async () => {
  const s = fake(200, { authRequired: true, authenticated: false })
  await sessionStatus(ADDRESS, s.impl)
  const l = fake(200, { authenticated: true })
  await signIn(ADDRESS, SECRET, true, l.impl)
  const o = fake(200, { authenticated: false })
  await signOut(ADDRESS, o.impl)
  const expected = [
    [s, "GET", "session"],
    [l, "POST", "login"],
    [o, "POST", "logout"],
  ] as const
  for (const [f, method, path] of expected) {
    const { url, init } = f.calls[0]
    assert.equal(url, `https://blackwall.example.ts.net/api/${path}`)
    assert.equal(init.method, method)
    assert.equal(init.credentials, "include")
    assert.ok(init.signal instanceof AbortSignal)
    const h = init.headers as Record<string, string>
    assert.equal(h["X-Blackwall"], "1")
    assert.equal(h["Content-Type"], "application/json")
  }
})

test("sign in posts the password and remember flag in the body only", async () => {
  const f = fake(200, { authenticated: true })
  assert.deepEqual(await signIn(ADDRESS, SECRET, true, f.impl), { ok: true })
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { password: SECRET, remember: true })
  assert.ok(!f.calls[0].url.includes(SECRET))
  const g = fake(200, { authenticated: true })
  await signIn(ADDRESS, SECRET, false, g.impl)
  assert.equal(JSON.parse(String(g.calls[0].init.body)).remember, false)
})

test("sign in failures are friendly and name the real cause", async () => {
  const wrong = await signIn(ADDRESS, SECRET, false, fake(401, { error: "Wrong password" }).impl)
  assert.deepEqual(wrong, { ok: false, kind: "wrong-password", reason: "Wrong password." })
  const limited = await signIn(ADDRESS, SECRET, false, fake(429, { error: "Too many attempts. Try again in a few minutes." }).impl)
  assert.equal(limited.ok === false && limited.kind, "too-many-attempts")
  assert.match(limited.ok === false ? limited.reason : "", /try again in a few minutes/i)
  const forbidden = await signIn(ADDRESS, SECRET, false, fake(403, { error: "Forbidden" }).impl)
  assert.equal(forbidden.ok === false && forbidden.kind, "other")
  const offline = await signIn(ADDRESS, SECRET, false, down)
  assert.equal(offline.ok === false && offline.kind, "unreachable")
  const bad = await signIn(ADDRESS, SECRET, false, fake(502).impl)
  assert.equal(bad.ok === false && bad.kind, "unreachable")
  const odd = await signIn(ADDRESS, SECRET, false, fake(418).impl)
  assert.equal(odd.ok === false && odd.kind, "other")
  assert.match(odd.ok === false ? odd.reason : "", /418/)
})

test("a 200 that isn't the server's sign-in answer is not a success", async () => {
  for (const f of [fake(200, undefined, "<html>login page</html>"), fake(200, { authenticated: false }), fake(200, {})]) {
    const r = await signIn(ADDRESS, SECRET, false, f.impl)
    assert.equal(r.ok, false)
  }
})

test("the password never appears in any result, even when the server echoes it", async () => {
  const echoes = [fake(401, { error: SECRET }), fake(429, { error: SECRET }), fake(403, { error: SECRET }), fake(500, { error: SECRET }), fake(200, { authenticated: SECRET })]
  for (const f of echoes) assert.ok(!JSON.stringify(await signIn(ADDRESS, SECRET, true, f.impl)).includes(SECRET))
  assert.ok(!JSON.stringify(await signIn(ADDRESS, SECRET, true, down)).includes(SECRET))
  const throwing = (() => Promise.reject(new Error(`boom ${SECRET}`))) as unknown as typeof fetch
  assert.ok(!JSON.stringify(await signIn(ADDRESS, SECRET, true, throwing)).includes(SECRET))
})

test("sign out succeeds on 200 and says why otherwise", async () => {
  assert.deepEqual(await signOut(ADDRESS, fake(200, { authenticated: false }).impl), { ok: true })
  assert.equal((await signOut(ADDRESS, down)).ok, false)
  const r = await signOut(ADDRESS, fake(500).impl)
  assert.equal(r.ok === false && r.reason, "The server answered 500.")
})

test("a request that gets no answer is aborted after the timeout and reported as unreachable", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch
    const pending = signIn(ADDRESS, SECRET, false, hang)
    mock.timers.tick(REQUEST_TIMEOUT_MS)
    const r = await pending
    assert.equal(r.ok === false && r.kind, "unreachable")
  } finally {
    mock.timers.reset()
  }
})

test("each status has a label and hint", () => {
  for (const s of ["signed-in", "signed-out", "no-login-needed", "unreachable"] as const) {
    const l = statusLabel(s)
    assert.ok(l.title && l.hint)
  }
  assert.equal(statusLabel("unreachable").title, "Can't reach the server")
})
