import assert from "node:assert/strict"
import { test } from "node:test"
import { handle, type Env, type KV } from "../worker/forms/src/index.ts"

function memKV(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>()
  return {
    m,
    async get(k) { return m.get(k) ?? null },
    async put(k, v) { m.set(k, v) },
    async delete(k) { m.delete(k) },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true } },
  }
}

const calls: string[] = []
const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
  const u = String(url)
  calls.push(u)
  if (u.includes("dns-query")) return Response.json({ Status: 0, Answer: u.includes("nope.invalid") ? [] : [{ data: "mx" }] })
  if (u.includes("turnstile")) return Response.json({ success: (init!.body as FormData).get("response") === "good" })
  if (u.includes("resend")) return Response.json({ id: "e1" })
  if (u.includes("mailerlite")) return Response.json({ data: {} }, { status: 201 })
  return new Response("?", { status: 500 })
}) as typeof fetch

const post = (fields: Record<string, string>, origin = "https://bcndlabs.dev") => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return new Request("https://forms.example.workers.dev/submit", { method: "POST", body: fd, headers: { origin, "cf-connecting-ip": "1.2.3.4" } })
}
const api = (path: string, init: RequestInit = {}, token = "secret") => new Request(`https://forms.example.workers.dev${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })

test("form posts: email checks, turnstile, confirmation link, collect and ack", async () => {
  const env: Env = { SUBMISSIONS: memKV(), ADMIN_TOKEN: "secret", TURNSTILE_SECRET: "t", RESEND_API_KEY: "r", ALLOWED_ORIGINS: "https://bcndlabs.dev" }
  const kv = env.SUBMISSIONS as ReturnType<typeof memKV>
  assert.equal((await handle(post({ _site: "s1", email: "not-an-email" }), env, fakeFetch)).status, 400)
  assert.equal((await handle(post({ _site: "s1", email: "a@b.com" }, "https://evil.example"), env, fakeFetch)).status, 403)
  assert.equal((await handle(post({ _site: "s1", email: "a@b.com", "cf-turnstile-response": "bad" }), env, fakeFetch)).status, 400)
  const noMail = await handle(post({ _site: "s1", email: "a@nope.invalid", "cf-turnstile-response": "good" }), env, fakeFetch)
  assert.match((await noMail.json()).error, /can't receive mail/)

  const ok = await handle(post({ _site: "s1", _form: "frm1", email: "Blake@Example.com", message: "hi", "cf-turnstile-response": "good" }), env, fakeFetch)
  assert.deepEqual(await ok.json(), { ok: true, verify: true })
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://bcndlabs.dev")
  const token = [...kv.m.keys()].find((k) => k.startsWith("pending:"))!.slice(8)
  assert.equal((await (await handle(api("/api/submissions"), env, fakeFetch)).json()).items.length, 0, "not collected before it's confirmed")

  assert.match(await (await handle(new Request(`https://forms.example.workers.dev/verify?t=${token}`), env, fakeFetch)).text(), /Confirmed/)
  assert.match(await (await handle(new Request(`https://forms.example.workers.dev/verify?t=${token}`), env, fakeFetch)).text(), /expired/)
  const items = (await (await handle(api("/api/submissions"), env, fakeFetch)).json()).items
  assert.equal(items.length, 1)
  assert.equal(items[0].email, "blake@example.com")
  assert.equal(items[0].verified, true)
  assert.equal(items[0].fields.message, "hi")

  assert.equal((await handle(api("/api/submissions", {}, "wrong"), env, fakeFetch)).status, 401)
  await handle(api("/api/ack", { method: "POST", body: JSON.stringify({ ids: [items[0].id] }), headers: { "content-type": "application/json" } }), env, fakeFetch)
  assert.equal((await (await handle(api("/api/submissions"), env, fakeFetch)).json()).items.length, 0)
})

test("no confirmation email set up: stored straight away; newsletter goes to MailerLite; honeypot is ignored", async () => {
  const env: Env = { SUBMISSIONS: memKV(), ADMIN_TOKEN: "secret", MAILERLITE_API_KEY: "m", MAILERLITE_GROUP: "g1" }
  assert.deepEqual(await (await handle(post({ _site: "s1", _kind: "comment", _post: "week-1", email: "a@b.com", name: "A", comment: "Nice" }), env, fakeFetch)).json(), { ok: true, verify: false })
  calls.length = 0
  assert.deepEqual(await (await handle(post({ _site: "s1", _kind: "newsletter", email: "c@d.com" }), env, fakeFetch)).json(), { ok: true, verify: true })
  assert.ok(calls.some((u) => u.includes("connect.mailerlite.com/api/subscribers")))
  await handle(post({ _site: "s1", email: "bot@b.com", _hp: "x" }), env, fakeFetch)
  const items = (await (await handle(api("/api/submissions"), env, fakeFetch)).json()).items
  assert.deepEqual(items.map((i: { kind: string }) => i.kind).sort(), ["comment", "newsletter"])
  assert.equal(items.find((i: { kind: string }) => i.kind === "comment").post, "week-1")
})
