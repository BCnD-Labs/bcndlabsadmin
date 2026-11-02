import nodemailer from "nodemailer"
import type { StoredConnection } from "../store.ts"
import { ProviderError, need } from "../http.ts"
import type { TestResult } from "./index.ts"

/** One message, already worded; channels only deliver it. */
export interface Outgoing {
  title: string
  body: string
  /** Opens when the push or email is tapped. */
  url?: string
  /** 1 (min) to 5 (urgent), ntfy's scale. */
  priority?: 1 | 2 | 3 | 4 | 5
  tags?: string[]
}

/**
 * ntfy push (https://docs.ntfy.sh/publish/): POST the body to <server>/<topic> with
 * Title, Priority, Tags and Click headers; an access token goes in Authorization.
 */
export async function sendNtfy(c: StoredConnection, m: Outgoing, fetchImpl: typeof fetch = fetch) {
  const server = need(c.config.url, "ntfy server").replace(/\/+$/, "")
  const topic = need(c.config.topic, "Topic")
  const headers: Record<string, string> = { Title: encodeHeader(m.title), Priority: String(m.priority ?? 3) }
  if (m.tags?.length) headers.Tags = m.tags.join(",")
  if (m.url) headers.Click = m.url
  if (c.secrets.token) headers.Authorization = `Bearer ${c.secrets.token}`
  let res: Response
  try {
    res = await fetchImpl(`${server}/${encodeURIComponent(topic)}`, { method: "POST", body: m.body, headers, signal: AbortSignal.timeout(10_000) })
  } catch (e) {
    throw new ProviderError(`ntfy isn't reachable: ${(e as Error).message}`)
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError("ntfy refused the message. Check the access token and that it may publish to this topic.", res.status)
  if (!res.ok) throw new ProviderError(`ntfy answered HTTP ${res.status}`)
}

/** Header values must be ASCII; ntfy accepts RFC 2047 encoded words for anything else. */
const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`)

export async function testNtfy(c: StoredConnection): Promise<TestResult> {
  await sendNtfy(c, { title: "Blackwall is connected", body: "Notifications will arrive here.", tags: ["white_check_mark"] })
  return { status: "ok", account: `${c.config.topic} on ${c.config.url.replace(/^https?:\/\//, "")}`, summary: [{ label: "Test", value: "Sent a test push" }] }
}

/** Email over SMTP (nodemailer): your mail provider's SMTP host, port and an app password. */
function transport(c: StoredConnection) {
  const security = c.config.security ?? "starttls"
  return nodemailer.createTransport({
    host: need(c.config.host, "SMTP host"),
    port: Number(c.config.port || (security === "ssl" ? 465 : 587)),
    secure: security === "ssl",
    requireTLS: security === "starttls",
    auth: c.config.username ? { user: c.config.username, pass: need(c.secrets.password, "SMTP password") } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
}

export async function sendEmail(c: StoredConnection, m: Outgoing) {
  const to = need(c.config.to, "Send to")
  const from = c.config.from || c.config.username || to
  try {
    await transport(c).sendMail({
      from: `Blackwall <${from}>`,
      to,
      subject: m.title,
      text: m.url ? `${m.body}\n\n${m.url}` : m.body,
    })
  } catch (e) {
    const msg = (e as Error).message
    if (/auth|535|534/i.test(msg)) throw new ProviderError(`The mail server rejected the login. Use an app password if your provider needs one. (${msg})`, 401)
    throw new ProviderError(`Couldn't send email: ${msg}`)
  }
}

export async function testEmail(c: StoredConnection): Promise<TestResult> {
  await sendEmail(c, { title: "Blackwall is connected", body: "Email notifications will arrive at this address." })
  return { status: "ok", account: c.config.to, summary: [{ label: "Test", value: `Sent a test email to ${c.config.to}` }] }
}
