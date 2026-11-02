/**
 * Blackwall form receiver: a Cloudflare Worker that takes form posts, comments and
 * newsletter sign-ups from your static sites, so nothing on the site needs a server.
 *
 *   POST /submit            from a site (form fields, _kind, _form, _site, …)
 *   GET  /verify?t=…        the link in the confirmation email
 *   GET  /api/health        Blackwall: what's configured           (Bearer ADMIN_TOKEN)
 *   GET  /api/submissions   Blackwall: confirmed, not yet collected (Bearer ADMIN_TOKEN)
 *   POST /api/ack           Blackwall: {ids} it has saved, so they're deleted here
 *
 * Every submission needs a real-looking email (format + the domain accepts mail). On top:
 * Cloudflare Turnstile when TURNSTILE_SECRET is set, and a confirmation email when
 * RESEND_API_KEY is set (the submission only reaches Blackwall once the link is clicked).
 * Newsletter sign-ups go straight to MailerLite, which sends its own confirmation
 * (turn on double opt-in for API sign-ups in MailerLite).
 */

export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}

export interface Env {
  SUBMISSIONS: KV
  ADMIN_TOKEN: string
  /** This Worker's public address, for the link in confirmation emails. Defaults to the request's origin. */
  PUBLIC_URL?: string
  /** Comma-separated site origins allowed to post (https://bcndlabs.dev,…). Empty allows any. */
  ALLOWED_ORIGINS?: string
  TURNSTILE_SECRET?: string
  RESEND_API_KEY?: string
  /** "Blackwall Forms <forms@yourdomain>": a sender on a domain verified in Resend. */
  MAIL_FROM?: string
  MAILERLITE_API_KEY?: string
  /** Default MailerLite group ID for sign-ups. */
  MAILERLITE_GROUP?: string
  /** Other group IDs a newsletter block may choose, comma-separated. */
  MAILERLITE_GROUPS?: string
}

export type Kind = "form" | "comment" | "newsletter"

export interface Submission {
  id: string
  kind: Kind
  site: string
  form?: string
  post?: string
  page?: string
  email: string
  name?: string
  fields: Record<string, string>
  verified: boolean
  at: string
  ip?: string
}

type Fetch = typeof fetch

const PENDING_TTL = 48 * 3600
const RATE_MAX = 8
const RATE_WINDOW = 3600
const MAX_FIELD = 5000
const EMAIL_RE = /^[^\s@"<>]+@[^\s@"<>]+\.[a-z]{2,}$/i

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } })

const html = (title: string, message: string, back?: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#1a1c1e}a{color:#2f6fdb}</style></head><body><h1>${esc(title)}</h1><p>${esc(message)}</p>${back ? `<p><a href="${esc(back)}">Back to the site</a></p>` : ""}</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  )

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const rid = () => crypto.randomUUID().replace(/-/g, "")

function corsFor(req: Request, env: Env): Record<string, string> | null {
  const origin = req.headers.get("origin")
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean)
  if (!origin) return {}
  if (allowed.length && !allowed.includes(origin)) return null
  return { "access-control-allow-origin": origin, vary: "Origin" }
}

/** The domain must exist and accept mail (an MX record, or an A record as the fallback mail host). */
export async function emailDomainOk(email: string, fetchImpl: Fetch = fetch) {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false
  const ask = async (type: string) => {
    const r = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: "application/dns-json" } })
    if (!r.ok) throw new Error("dns")
    const j = (await r.json()) as { Status: number; Answer?: unknown[] }
    return j.Status === 0 && !!j.Answer?.length
  }
  try {
    return (await ask("MX")) || (await ask("A"))
  } catch {
    return true // DNS lookup itself failed: don't turn people away for our problem
  }
}

async function turnstileOk(env: Env, token: string, ip: string | null, fetchImpl: Fetch) {
  if (!env.TURNSTILE_SECRET) return true
  if (!token) return false
  const body = new FormData()
  body.set("secret", env.TURNSTILE_SECRET)
  body.set("response", token)
  if (ip) body.set("remoteip", ip)
  const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body })
  return r.ok && ((await r.json()) as { success?: boolean }).success === true
}

async function rateLimited(env: Env, ip: string | null) {
  if (!ip) return false
  const key = `rate:${ip}`
  const n = Number((await env.SUBMISSIONS.get(key)) ?? 0)
  if (n >= RATE_MAX) return true
  await env.SUBMISSIONS.put(key, String(n + 1), { expirationTtl: RATE_WINDOW })
  return false
}

async function sendConfirmation(env: Env, s: Submission, link: string, fetchImpl: Fetch) {
  const what = s.kind === "comment" ? "your comment" : "your message"
  const r = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Forms <onboarding@resend.dev>",
      to: [s.email],
      subject: s.kind === "comment" ? "Confirm your comment" : "Confirm your message",
      text: `Hi${s.name ? ` ${s.name}` : ""},\n\nPlease confirm ${what} by opening this link:\n${link}\n\nIf you didn't send anything, ignore this email and nothing will be sent.\n`,
      html: `<p>Hi${s.name ? ` ${esc(s.name)}` : ""},</p><p>Please confirm ${what}:</p><p><a href="${esc(link)}">Confirm</a></p><p style="color:#666">If you didn't send anything, ignore this email and nothing will be sent.</p>`,
    }),
  })
  if (!r.ok) throw new Error(`Couldn't send the confirmation email (HTTP ${r.status})`)
}

async function subscribe(env: Env, email: string, name: string | undefined, group: string | undefined, fetchImpl: Fetch) {
  if (!env.MAILERLITE_API_KEY) throw new Error("The newsletter isn't set up yet")
  const allowed = [env.MAILERLITE_GROUP, ...(env.MAILERLITE_GROUPS ?? "").split(",")].map((g) => g?.trim()).filter(Boolean) as string[]
  const groups = group && allowed.includes(group) ? [group] : env.MAILERLITE_GROUP ? [env.MAILERLITE_GROUP] : []
  const r = await fetchImpl("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { authorization: `Bearer ${env.MAILERLITE_API_KEY}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, groups, ...(name ? { fields: { name } } : {}) }),
  })
  if (!r.ok) throw new Error(r.status === 422 ? "That email address wasn't accepted" : `Couldn't sign you up (HTTP ${r.status})`)
}

async function submit(req: Request, env: Env, fetchImpl: Fetch, cors: Record<string, string>) {
  const err = (error: string, status = 400) => json({ error }, status, cors)
  let data: FormData
  try {
    data = await req.formData()
  } catch {
    return err("Send the form as form data")
  }
  const get = (k: string) => String(data.get(k) ?? "").trim().slice(0, MAX_FIELD)
  if (get("_hp")) return json({ ok: true }, 200, cors) // the hidden honeypot was filled in: a bot
  const ip = req.headers.get("cf-connecting-ip")
  const kind = (["form", "comment", "newsletter"].includes(get("_kind")) ? get("_kind") : "form") as Kind
  const email = get("email").toLowerCase()
  const name = get("name") || undefined
  if (!EMAIL_RE.test(email)) return err("Enter a valid email address")
  if (!get("_site")) return err("Missing _site")
  if (await rateLimited(env, ip)) return err("Too many submissions. Try again in an hour.", 429)
  if (!(await turnstileOk(env, get("cf-turnstile-response"), ip, fetchImpl))) return err("Please complete the human check")
  if (!(await emailDomainOk(email, fetchImpl))) return err("That email address can't receive mail")

  const fields: Record<string, string> = {}
  for (const [k, v] of data.entries()) if (!k.startsWith("_") && k !== "cf-turnstile-response" && typeof v === "string") fields[k.slice(0, 100)] = v.slice(0, MAX_FIELD)
  if (kind === "comment" && !fields.comment?.trim()) return err("Write a comment first")

  const s: Submission = {
    id: rid(), kind, site: get("_site"), form: get("_form") || undefined, post: get("_post") || undefined, page: get("_page") || req.headers.get("referer") || undefined,
    email, name, fields, verified: false, at: new Date().toISOString(), ip: ip ?? undefined,
  }

  if (kind === "newsletter") {
    try {
      await subscribe(env, email, name, get("_group") || undefined, fetchImpl)
    } catch (e) {
      return err((e as Error).message, 502)
    }
    await env.SUBMISSIONS.put(`sub:${s.at}:${s.id}`, JSON.stringify(s))
    return json({ ok: true, verify: true }, 200, cors)
  }
  if (env.RESEND_API_KEY) {
    const token = rid() + rid()
    const base = (env.PUBLIC_URL || new URL(req.url).origin).replace(/\/+$/, "")
    await env.SUBMISSIONS.put(`pending:${token}`, JSON.stringify(s), { expirationTtl: PENDING_TTL })
    try {
      await sendConfirmation(env, s, `${base}/verify?t=${token}`, fetchImpl)
    } catch (e) {
      await env.SUBMISSIONS.delete(`pending:${token}`)
      return err((e as Error).message, 502)
    }
    return json({ ok: true, verify: true }, 200, cors)
  }
  await env.SUBMISSIONS.put(`sub:${s.at}:${s.id}`, JSON.stringify(s))
  return json({ ok: true, verify: false }, 200, cors)
}

async function verify(url: URL, env: Env) {
  const token = url.searchParams.get("t") ?? ""
  const raw = token ? await env.SUBMISSIONS.get(`pending:${token}`) : null
  if (!raw) return html("Link expired", "This confirmation link was already used or has expired. If you still want to send it, fill in the form again.")
  const s = JSON.parse(raw) as Submission
  s.verified = true
  await env.SUBMISSIONS.put(`sub:${s.at}:${s.id}`, JSON.stringify(s))
  await env.SUBMISSIONS.delete(`pending:${token}`)
  return html("Confirmed", s.kind === "comment" ? "Thanks! Your comment will appear once it's approved." : "Thanks! Your message was sent.", s.page)
}

async function listSubmissions(env: Env) {
  const out: Submission[] = []
  let cursor: string | undefined
  do {
    const page = await env.SUBMISSIONS.list({ prefix: "sub:", limit: 200, cursor })
    for (const k of page.keys) {
      const v = await env.SUBMISSIONS.get(k.name)
      if (v) out.push(JSON.parse(v))
      if (out.length >= 200) return out
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

/** Constant-time comparison, so the token can't be guessed a character at a time. */
function sameToken(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function handle(req: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, "") || "/"

  if (path.startsWith("/api/")) {
    if (!sameToken((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""), env.ADMIN_TOKEN ?? "")) return json({ error: "Unauthorized" }, 401)
    if (path === "/api/health" && req.method === "GET") {
      const pending = (await env.SUBMISSIONS.list({ prefix: "sub:", limit: 1000 })).keys.length
      return json({ ok: true, waiting: pending, turnstile: !!env.TURNSTILE_SECRET, confirmEmail: !!env.RESEND_API_KEY, newsletter: !!env.MAILERLITE_API_KEY, origins: env.ALLOWED_ORIGINS ?? "" })
    }
    if (path === "/api/submissions" && req.method === "GET") return json({ items: await listSubmissions(env) })
    if (path === "/api/ack" && req.method === "POST") {
      const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] }
      if (!Array.isArray(ids)) return json({ error: "Send {ids: [...]}" }, 400)
      const want = new Set(ids)
      let cursor: string | undefined, removed = 0
      do {
        const page = await env.SUBMISSIONS.list({ prefix: "sub:", limit: 1000, cursor })
        for (const k of page.keys) if (want.has(k.name.slice(k.name.lastIndexOf(":") + 1))) { await env.SUBMISSIONS.delete(k.name); removed++ }
        cursor = page.list_complete ? undefined : page.cursor
      } while (cursor)
      return json({ ok: true, removed })
    }
    return json({ error: "Not found" }, 404)
  }

  const cors = corsFor(req, env)
  if (path === "/submit") {
    if (cors === null) return json({ error: "This site isn't allowed to post here" }, 403)
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" } })
    if (req.method === "POST") return submit(req, env, fetchImpl, cors)
  }
  if (path === "/verify" && req.method === "GET") return verify(url, env)
  if (path === "/") return html("Blackwall forms", "This address receives form posts from your sites.")
  return json({ error: "Not found" }, 404)
}

export default { fetch: (req: Request, env: Env) => handle(req, env) }
