/** Mail records and the rules both the server and the apps use. Message content is never stored in the workspace. */

export interface MailFolder { path: string; name: string; specialUse: string | null; total?: number; unread?: number }

export interface MailSummary {
  uid: number
  subject: string
  from: string
  to: string
  date: string
  unread: boolean
  starred: boolean
  answered: boolean
  size: number
  snippet?: string
  hasAttachments?: boolean
}

export interface MailAttachment { index: number; name: string; mime: string; size: number; /** A picture already shown inside the message body. */ inline?: boolean }

export interface MailMessage extends MailSummary {
  cc: string
  replyTo: string
  text: string
  html: string
  attachments: MailAttachment[]
}

export interface MailPageResult { messages: MailSummary[]; total: number; page: number; pageSize: number }

export const MAIL_PAGE_SIZE = 50
/** Attachments on one outgoing message, before encoding. */
export const MAIL_MAX_ATTACHMENTS = 15 * 1024 * 1024
export const MAIL_MAX_RECIPIENTS = 50

/** None of these delete mail: the strongest is a move to Trash. */
export const MAIL_ACTIONS = ["read", "unread", "star", "unstar", "archive", "spam", "trash", "inbox", "move", "label"] as const
export type MailActionName = (typeof MAIL_ACTIONS)[number]

export type ReplyMode = "reply" | "replyAll" | "forward"

export interface OutgoingMail {
  from?: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  attachments?: { name: string; mime: string; data: string }[]
  /** The message being answered or forwarded; `include` lists the original attachments to send along. */
  reply?: { folder: string; uid: number; mode: ReplyMode; include?: number[] }
}

export interface Address { name: string; address: string }

const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/

/** Splits "Ann <a@x.com>, b@y.com" without breaking on commas inside quotes or angle brackets. */
export function splitAddresses(list: string): Address[] {
  const parts: string[] = []
  let current = "", quoted = false, angled = false
  for (const char of list) {
    if (char === '"') quoted = !quoted
    else if (char === "<" && !quoted) angled = true
    else if (char === ">" && !quoted) angled = false
    if ((char === "," || char === ";") && !quoted && !angled) { parts.push(current); current = "" } else current += char
  }
  parts.push(current)
  // A sender's display name may hold an unquoted comma ("Lee, Jordan <j@x.com>"): keep its pieces together.
  const joined: string[] = []
  let pending: string[] = []
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    if (!part.includes("@")) { pending.push(part); continue }
    if (part.includes("<")) joined.push([...pending, part].join(", "))
    else joined.push(...pending, part)
    pending = []
  }
  joined.push(...pending)
  return joined.map((part) => {
    const match = /^(.*)<([^<>]*)>$/.exec(part)
    return match ? { name: match[1].trim().replace(/^"|"$/g, ""), address: match[2].trim() } : { name: "", address: part }
  })
}

export const validAddress = (address: string) => address.length <= 254 && ADDRESS.test(address)

export const formatAddress = (a: Address) => (a.name ? `${/[,;<>]/.test(a.name) ? `"${a.name}"` : a.name} <${a.address}>` : a.address)

/** What to call a person in a list. */
export function displayName(list: string) {
  const first = splitAddresses(list)[0]
  return first ? first.name || first.address : ""
}

export function initials(name: string) {
  const words = name.replace(/@.*/, "").split(/[\s._-]+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return ((words[0]?.match(/[\p{L}\p{N}]/u)?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1].match(/[\p{L}\p{N}]/u)?.[0] ?? "" : "")).toUpperCase()
}

export function subjectFor(mode: ReplyMode, subject: string) {
  const clean = subject === "(no subject)" ? "" : subject
  const prefix = mode === "forward" ? "Fwd:" : "Re:"
  return (mode === "forward" ? /^fwd?:/i : /^re:/i).test(clean) ? clean : `${prefix} ${clean}`.trim()
}

/** Who a reply goes to: never yourself, unless you are the only person on the message. */
export function replyRecipients(message: Pick<MailMessage, "from" | "to" | "cc" | "replyTo">, mode: ReplyMode, mine: string[]) {
  if (mode === "forward") return { to: "", cc: "" }
  const own = new Set(mine.map((a) => a.toLowerCase()))
  const isMine = (a: Address) => own.has(a.address.toLowerCase())
  const sender = splitAddresses(message.replyTo || message.from)
  // Answering mail you sent goes to the people you sent it to.
  const sentByMe = splitAddresses(message.from).some(isMine)
  const to = sentByMe ? splitAddresses(message.to) : sender
  const seen = new Set(to.map((a) => a.address.toLowerCase()))
  const others = mode === "replyAll" ? [...(sentByMe ? [] : splitAddresses(message.to)), ...splitAddresses(message.cc)] : []
  const cc = others.filter((a) => {
    const key = a.address.toLowerCase()
    if (isMine(a) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { to: to.map(formatAddress).join(", "), cc: cc.map(formatAddress).join(", ") }
}

export function quoteText(mode: ReplyMode, message: Pick<MailMessage, "from" | "to" | "date" | "subject" | "text">, when: string) {
  if (mode === "forward") return `\n\n---------- Forwarded message ----------\nFrom: ${message.from}\nDate: ${when}\nSubject: ${message.subject}\nTo: ${message.to}\n\n${message.text}`
  return `\n\nOn ${when}, ${message.from} wrote:\n${message.text.split("\n").map((line) => `> ${line}`).join("\n")}`
}

const SYSTEM_ORDER = ["\\Inbox", "\\Flagged", "\\Sent", "\\Drafts", "\\Archive", "\\Junk", "\\Trash", "\\All"]
const SYSTEM_NAMES: Record<string, string> = { inbox: "\\Inbox", starred: "\\Flagged", sent: "\\Sent", drafts: "\\Drafts", archive: "\\Archive", spam: "\\Junk", trash: "\\Trash", "all mail": "\\All" }

/** The role of a folder, from the server's flag or, for Proton's system folders, its name. */
export const folderRole = (f: MailFolder) => (f.path.toUpperCase() === "INBOX" ? "\\Inbox" : f.specialUse ?? SYSTEM_NAMES[f.path.toLowerCase()] ?? null)

/** Mailboxes in Gmail's order, then your own folders and labels (Bridge nests them under "Folders/" and "Labels/"). */
export function groupFolders(folders: MailFolder[]) {
  const system: MailFolder[] = [], own: MailFolder[] = [], labels: MailFolder[] = []
  for (const f of folders) {
    const role = folderRole(f)
    if (role && SYSTEM_ORDER.includes(role)) system.push(f)
    else if (f.path.startsWith("Labels/")) labels.push({ ...f, name: f.path.slice("Labels/".length) })
    else own.push({ ...f, name: f.path.replace(/^Folders\//, "") })
  }
  system.sort((a, b) => SYSTEM_ORDER.indexOf(folderRole(a)!) - SYSTEM_ORDER.indexOf(folderRole(b)!))
  const byName = (a: MailFolder, b: MailFolder) => a.name.localeCompare(b.name)
  return { system, folders: own.sort(byName), labels: labels.sort(byName) }
}
