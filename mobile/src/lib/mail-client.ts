import type { MailFolder, MailMessage, MailPageResult, MailSummary } from "./shared.ts"

/** Native Mail only talks to Blackwall's authenticated server API. */
export type MailResult<T> = { ok: true; value: T } | { ok: false; kind: "signed-out" | "not-connected" | "too-large" | "error"; message: string }
export type MailFolders = { folders: MailFolder[]; addresses: string[] }
const TIMEOUT_MS = 30_000
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0

export function mailUrl(address: string, route: string, folder?: string, extras: Record<string, string | number> = {}) {
  const params = [...(folder === undefined ? [] : [["folder", folder]]), ...Object.entries(extras)]
  return `${address.replace(/\/+$/, "")}/api/mail/${route}${params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}` : ""}`
}

export function parseFolders(v: unknown): MailFolders | null {
  if (!record(v) || !Array.isArray(v.folders) || !Array.isArray(v.addresses)) return null
  const folders: MailFolder[] = []
  for (const f of v.folders) {
    if (!record(f) || typeof f.path !== "string" || typeof f.name !== "string" || !(f.specialUse === null || typeof f.specialUse === "string")) return null
    folders.push({ path: f.path, name: f.name, specialUse: f.specialUse,
      total: integer(f.total) ? f.total : undefined, unread: integer(f.unread) ? f.unread : undefined })
  }
  if (!v.addresses.every((a) => typeof a === "string")) return null
  return { folders, addresses: v.addresses }
}

export function parseSummary(v: unknown): MailSummary | null {
  if (!record(v) || !integer(v.uid) || v.uid === 0 || typeof v.subject !== "string" || typeof v.from !== "string" || typeof v.to !== "string" || typeof v.date !== "string" || typeof v.unread !== "boolean" || !integer(v.size)) return null
  return { uid: v.uid, subject: v.subject, from: v.from, to: v.to, date: v.date, unread: v.unread,
    starred: v.starred === true, answered: v.answered === true, size: v.size,
    snippet: typeof v.snippet === "string" ? v.snippet : undefined, hasAttachments: v.hasAttachments === true }
}

export function parsePage(v: unknown): MailPageResult | null {
  if (!record(v) || !Array.isArray(v.messages) || !integer(v.total) || !integer(v.page) || !integer(v.pageSize) || !v.pageSize) return null
  const messages = v.messages.map(parseSummary)
  return messages.some((m) => !m) ? null : { messages: messages as MailSummary[], total: v.total, page: v.page, pageSize: v.pageSize }
}

export function parseMessage(v: unknown): MailMessage | null {
  const summary = parseSummary(v)
  if (!summary || !record(v) || typeof v.cc !== "string" || typeof v.replyTo !== "string" || typeof v.text !== "string" || typeof v.html !== "string" || !Array.isArray(v.attachments)) return null
  const attachments = v.attachments.map((a) => record(a) && integer(a.index) && typeof a.name === "string" && typeof a.mime === "string" && integer(a.size)
    ? { index: a.index, name: a.name, mime: a.mime, size: a.size, inline: a.inline === true } : null)
  return attachments.some((a) => !a) ? null : { ...summary, cc: v.cc, replyTo: v.replyTo, text: v.text, html: v.html, attachments: attachments as MailMessage["attachments"] }
}

export async function mailRequest<T>(url: string, parse: (v: unknown) => T | null, fetchImpl: typeof fetch = fetch, body?: unknown): Promise<MailResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let response: Response
    try {
      response = await fetchImpl(url, { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
        credentials: "include", headers: { Accept: "application/json", "X-Blackwall": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) } })
    } catch { return { ok: false, kind: "error", message: "Couldn't reach Blackwall. Check the connection and try again." } }
    if (response.status === 401) return { ok: false, kind: "signed-out", message: "Sign in under Settings to see mail." }
    if (response.status === 409) return { ok: false, kind: "not-connected", message: "Connect and test Proton Mail Bridge in Blackwall Settings → Connections." }
    if (response.status === 413) return { ok: false, kind: "too-large", message: "This message is too large to open in Blackwall." }
    if (!response.ok) return { ok: false, kind: "error", message: `Blackwall answered ${response.status}. Try again.` }
    try {
      const value = parse(await response.json())
      return value === null ? { ok: false, kind: "error", message: "Blackwall returned an unexpected mail response." } : { ok: true, value }
    } catch { return { ok: false, kind: "error", message: "Blackwall returned an unreadable mail response." } }
  } finally { clearTimeout(timer) }
}

export const fetchMailFolders = (address: string, fetchImpl?: typeof fetch) => mailRequest(mailUrl(address, "folders"), parseFolders, fetchImpl)
export const fetchMailPage = (address: string, folder: string, page: number, query: string, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, "messages", folder, { page, q: query }), parsePage, fetchImpl)
export const fetchMailMessage = (address: string, folder: string, uid: number, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, `messages/${uid}`, folder), parseMessage, fetchImpl)
