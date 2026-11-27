import { MAIL_ACTIONS, type MailFolder, type MailMessage, type MailPageResult, type MailSummary, type OutgoingMail } from "./shared.ts"

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

type Reader<T> = (response: Response) => Promise<T | null>
type Options = { body?: unknown; /** What a 409 means for this call; the default is "Bridge isn't connected". */ conflict?: string; limit?: number }

async function call<T>(url: string, read: Reader<T>, fetchImpl: typeof fetch, { body, conflict, limit }: Options = {}): Promise<MailResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let response: Response
    try {
      response = await fetchImpl(url, { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
        credentials: "include", headers: { Accept: "application/json", "X-Blackwall": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) } })
    } catch { return { ok: false, kind: "error", message: "Couldn't reach Blackwall. Check the connection and try again." } }
    if (response.status === 401) return { ok: false, kind: "signed-out", message: "Sign in under Settings to see mail." }
    if (response.status === 409) return conflict ? { ok: false, kind: "error", message: conflict } : { ok: false, kind: "not-connected", message: "Connect and test Proton Mail Bridge in Blackwall Settings → Connections." }
    if (response.status === 413) return { ok: false, kind: "too-large", message: "This is too large for Blackwall to handle here." }
    if (!response.ok) return { ok: false, kind: "error", message: `Blackwall answered ${response.status}. Try again.` }
    if (limit !== undefined && Number(response.headers.get("Content-Length") ?? 0) > limit) return { ok: false, kind: "too-large", message: "This attachment is too large to open on the phone." }
    try {
      const value = await read(response)
      return value === null ? { ok: false, kind: "error", message: "Blackwall returned an unexpected mail response." } : { ok: true, value }
    } catch { return { ok: false, kind: "error", message: "Blackwall returned an unreadable mail response." } }
  } finally { clearTimeout(timer) }
}

export const mailRequest = <T>(url: string, parse: (v: unknown) => T | null, fetchImpl: typeof fetch = fetch, options?: Options) =>
  call(url, async (response) => parse(await response.json()), fetchImpl, options)

export const fetchMailFolders = (address: string, fetchImpl?: typeof fetch) => mailRequest(mailUrl(address, "folders"), parseFolders, fetchImpl)
export const fetchMailPage = (address: string, folder: string, page: number, query: string, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, "messages", folder, { page, q: query }), parsePage, fetchImpl)
export const fetchMailMessage = (address: string, folder: string, uid: number, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, `messages/${uid}`, folder), parseMessage, fetchImpl)

export type MailActionBody = { uids: number[]; action: (typeof MAIL_ACTIONS)[number]; target?: string }
/** Read, star, archive, spam, Trash, inbox, move and label. Nothing here deletes mail for good. */
export const runMailAction = (address: string, folder: string, body: MailActionBody, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, "actions", folder), () => true, fetchImpl, { body, conflict: "That folder isn't available, or the message is already there. Nothing was moved." })

export const sendMail = (address: string, mail: OutgoingMail, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, "send"), (v) => (record(v) && v.sent === true ? true : null), fetchImpl, { body: mail })

export const trashMail = (address: string, folder: string, uid: number, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, `messages/${uid}/trash`, folder), () => true, fetchImpl, { body: {}, conflict: "Proton's Trash folder wasn't found. Nothing was moved." })

/** Raw attachment bytes, refused up front when the server says they are bigger than `limit`. */
export const fetchAttachment = (address: string, folder: string, uid: number, index: number, limit: number, fetchImpl: typeof fetch = fetch) =>
  call(mailUrl(address, `messages/${uid}/attachments/${index}`, folder), async (r) => { const bytes = new Uint8Array(await r.arrayBuffer()); return bytes.length > limit ? null : bytes }, fetchImpl, { limit })

export const saveAttachment = (address: string, folder: string, uid: number, index: number, to: string, fetchImpl?: typeof fetch) =>
  mailRequest(mailUrl(address, `messages/${uid}/attachments/${index}/save`, folder), (v) => (record(v) && typeof v.path === "string" ? v.path : null), fetchImpl,
    { body: { folder: to }, conflict: "A file with that name is already in that folder, or Nextcloud isn't connected. Choose another folder." })

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
/** Base64 for a data: address, since Hermes has no Buffer. */
export function toBase64(bytes: Uint8Array) {
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=")
  }
  return out
}

/** What the phone can show inline: pictures and plain text under a size cap. Everything else opens in Web view. */
export const PREVIEW_LIMIT = 5 * 1024 * 1024
export function previewKind(a: { mime: string; name: string; size: number }): "image" | "text" | null {
  if (a.size > PREVIEW_LIMIT) return null
  if (/^image\/(png|jpe?g|gif|webp)$/i.test(a.mime)) return "image"
  if (a.size <= 200_000 && (/^text\/(plain|csv|markdown)$/i.test(a.mime) || /\.(txt|md|csv|log)$/i.test(a.name))) return "text"
  return null
}
