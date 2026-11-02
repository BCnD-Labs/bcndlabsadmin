import type { Collections } from "../shared/workspace.ts"
import type { InboxItem, InboxStatus } from "../shared/site-inbox.ts"
import { ProviderError, need } from "./http.ts"
import type { Outgoing } from "./providers/channels.ts"
import type { TestResult } from "./providers/index.ts"
import type { ConnectionStore, StoredConnection } from "./store.ts"

const KEY = "site.inbox"
const MAX_ITEMS = 2000
const STATUSES: InboxStatus[] = ["new", "read", "approved", "hidden"]

type Fetch = typeof fetch
type Emit = (event: string, m: Outgoing) => Promise<unknown>

async function call<T>(c: StoredConnection, path: string, init: RequestInit = {}, fetchImpl: Fetch = fetch): Promise<T> {
  const base = need(c.config.url, "Worker address").replace(/\/+$/, "")
  let res: Response
  try {
    res = await fetchImpl(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${need(c.secrets.token, "Admin token")}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw new ProviderError(`The form receiver isn't reachable: ${(e as Error).message}`)
  }
  if (res.status === 401) throw new ProviderError("The form receiver rejected the admin token. It must match the Worker's ADMIN_TOKEN secret.", 401)
  if (!res.ok) throw new ProviderError(`The form receiver answered HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function testForms(c: StoredConnection, fetchImpl: Fetch = fetch): Promise<TestResult> {
  const h = await call<{ waiting: number; turnstile: boolean; confirmEmail: boolean; newsletter: boolean; origins: string }>(c, "/api/health", {}, fetchImpl)
  const onOff = (b: boolean) => (b ? "On" : "Off")
  return {
    status: "ok",
    account: c.config.url.replace(/^https?:\/\//, ""),
    summary: [
      { label: "Waiting to collect", value: String(h.waiting) },
      { label: "Human check (Turnstile)", value: onOff(h.turnstile) },
      { label: "Confirmation emails", value: onOff(h.confirmEmail) },
      { label: "Newsletter (MailerLite)", value: onOff(h.newsletter) },
      { label: "Allowed sites", value: h.origins || "Any" },
    ],
  }
}

export async function readInbox(store: ConnectionStore): Promise<InboxItem[]> {
  return (await store.getState<InboxItem[]>(KEY)) ?? []
}

/**
 * Pulls confirmed submissions from every form receiver, saves them, then tells the Worker
 * to delete them (so it only ever holds what Blackwall hasn't collected). Saving comes
 * first: if the ack fails, the next pull brings the same ids again and they're skipped.
 */
export async function collectInbox(store: ConnectionStore, ws: Collections | undefined, emit: Emit | undefined, fetchImpl: Fetch = fetch) {
  const receivers = (await store.list()).filter((c) => c.provider === "forms" && c.config.url && c.secrets.token)
  if (!receivers.length) return { added: 0 }
  const items = await readInbox(store)
  const known = new Set(items.map((i) => i.id))
  const fresh: InboxItem[] = []
  for (const c of receivers) {
    let got: Omit<InboxItem, "status" | "receivedAt">[]
    try {
      got = (await call<{ items: Omit<InboxItem, "status" | "receivedAt">[] }>(c, "/api/submissions", {}, fetchImpl)).items ?? []
    } catch {
      continue
    }
    if (!got.length) continue
    const now = new Date().toISOString()
    for (const g of got) if (!known.has(g.id)) { known.add(g.id); fresh.push({ ...g, fields: g.fields ?? {}, receivedAt: now, status: g.kind === "newsletter" ? "read" : "new" }) }
    await store.putState(KEY, [...fresh, ...items].slice(0, MAX_ITEMS))
    await call(c, "/api/ack", { method: "POST", body: JSON.stringify({ ids: got.map((g) => g.id) }) }, fetchImpl).catch(() => {})
  }
  if (emit && fresh.length) await announce(fresh, ws, emit)
  return { added: fresh.length }
}

async function announce(fresh: InboxItem[], ws: Collections | undefined, emit: Emit) {
  const siteName = (id: string) => ws?.sites.find((s) => s.id === id)?.name ?? "your site"
  const formName = (id?: string) => ws?.forms.find((f) => f.id === id)?.name ?? "A form"
  const who = (i: InboxItem) => i.name || i.email
  const url = "/cms/forms"
  const by = (k: InboxItem["kind"]) => fresh.filter((i) => i.kind === k)
  const forms = by("form"), comments = by("comment"), subs = by("newsletter")
  if (forms.length === 1) {
    const i = forms[0]
    const text = i.fields.message ?? Object.entries(i.fields).filter(([k]) => k !== "email" && k !== "name").map(([, v]) => v).join(" · ")
    await emit("site.submission", { title: `${formName(i.form)} on ${siteName(i.site)}`, body: `${who(i)}: ${text.slice(0, 280)}`, url, tags: ["envelope"] })
  } else if (forms.length) await emit("site.submission", { title: `${forms.length} form messages`, body: [...new Set(forms.map(who))].slice(0, 4).join(", "), url, tags: ["envelope"] })
  if (comments.length) await emit("site.comment", { title: comments.length === 1 ? `Comment to approve on ${siteName(comments[0].site)}` : `${comments.length} comments to approve`, body: comments.slice(0, 3).map((c) => `${who(c)}: ${(c.fields.comment ?? "").slice(0, 120)}`).join("\n"), url, tags: ["speech_balloon"] })
  if (subs.length) await emit("site.subscriber", { title: subs.length === 1 ? "New newsletter sign-up" : `${subs.length} newsletter sign-ups`, body: subs.slice(0, 4).map((s) => s.email).join(", "), url, tags: ["mailbox"] })
}

export async function setInboxStatus(store: ConnectionStore, ids: string[], status: InboxStatus) {
  if (!STATUSES.includes(status)) throw new ProviderError("Unknown status", 400)
  const want = new Set(ids)
  const items = (await readInbox(store)).map((i) => (want.has(i.id) ? { ...i, status } : i))
  await store.putState(KEY, items)
  return items
}

export async function deleteInbox(store: ConnectionStore, ids: string[]) {
  const want = new Set(ids)
  const items = (await readInbox(store)).filter((i) => !want.has(i.id))
  await store.putState(KEY, items)
  return items
}
