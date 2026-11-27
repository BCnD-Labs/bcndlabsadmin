import assert from "node:assert/strict"
import { test } from "node:test"
import { blankDraft, draftProblem, outgoing, replyDraft } from "../src/lib/mail-compose.ts"
import { fetchAttachment, previewKind, runMailAction, saveAttachment, sendMail, toBase64 } from "../src/lib/mail-client.ts"
import type { MailMessage } from "../src/lib/shared.ts"

const message: MailMessage = { uid: 9, subject: "Plans", from: "Pat <pat@example.com>", to: "Me <me@work.example>, other@example.com", cc: "Sam <sam@example.com>", replyTo: "", date: "2026-11-25T05:00:00Z", unread: false, starred: false, answered: false, size: 10,
  text: "Hello\nthere", html: "", attachments: [{ index: 0, name: "a.pdf", mime: "application/pdf", size: 100 }, { index: 1, name: "logo.png", mime: "image/png", size: 5, inline: true }] }
const mine = ["me@home.example", "me@work.example"]

test("reply, reply all and forward are filled in by the shared rules", () => {
  const reply = replyDraft("reply", message, "INBOX", mine, "Nov 25")
  assert.equal(reply.to, "Pat <pat@example.com>"); assert.equal(reply.cc, ""); assert.equal(reply.subject, "Re: Plans"); assert.equal(reply.from, "me@work.example")
  assert.ok(reply.text.includes("> Hello"))
  assert.equal(replyDraft("replyAll", message, "INBOX", mine, "Nov 25").cc, "other@example.com, Sam <sam@example.com>")
  const fwd = replyDraft("forward", message, "INBOX", mine, "Nov 25")
  assert.equal(fwd.to, ""); assert.equal(fwd.subject, "Fwd: Plans"); assert.deepEqual(fwd.forwarded.map(f => f.index), [0])
  assert.deepEqual(outgoing(fwd).reply, { folder: "INBOX", uid: 9, mode: "forward", include: [0] })
})

test("a draft is checked before it is sent", () => {
  const d = blankDraft("me@home.example")
  assert.match(draftProblem(d) ?? "", /recipient/)
  assert.match(draftProblem({ ...d, to: "nobody" }) ?? "", /valid/)
  assert.match(draftProblem({ ...d, to: "a@b.co" }) ?? "", /subject or a message/)
  assert.equal(draftProblem({ ...d, to: "a@b.co", subject: "Hi" }), null)
  assert.equal(outgoing({ ...d, to: "a@b.co", subject: "Hi" }).reply, undefined)
})

test("attachments: base64, preview kinds, and the 409 meanings", async () => {
  assert.equal(toBase64(new TextEncoder().encode("Man")), "TWFu"); assert.equal(toBase64(new TextEncoder().encode("Ma")), "TWE="); assert.equal(toBase64(new TextEncoder().encode("M")), "TQ==")
  assert.equal(previewKind({ mime: "image/png", name: "x", size: 10 }), "image")
  assert.equal(previewKind({ mime: "application/octet-stream", name: "notes.txt", size: 10 }), "text")
  assert.equal(previewKind({ mime: "application/pdf", name: "a.pdf", size: 10 }), null)
  assert.equal(previewKind({ mime: "image/png", name: "x", size: 6 * 1024 * 1024 }), null)
  const reply = (status: number, body: string, headers: Record<string, string> = {}): typeof fetch => async () => new Response(body, { status, headers })
  const saved = await saveAttachment("https://b.example", "INBOX", 1, 0, "/Docs", reply(409, "{}"))
  assert.ok(!saved.ok && saved.kind === "error" && /already in that folder/.test(saved.message))
  const path = await saveAttachment("https://b.example", "INBOX", 1, 0, "/Docs", reply(201, '{"path":"/Docs/a.pdf"}'))
  assert.deepEqual(path.ok && path.value, "/Docs/a.pdf")
  const big = await fetchAttachment("https://b.example", "INBOX", 1, 0, 10, reply(200, "x", { "Content-Length": "999" }))
  assert.ok(!big.ok && big.kind === "too-large")
  const ok = await fetchAttachment("https://b.example", "INBOX", 1, 0, 10, reply(200, "abc"))
  assert.deepEqual(ok.ok && [...ok.value], [97, 98, 99])
})

test("actions and send are POSTs with a JSON body to the server's mail routes", async () => {
  const calls: { url: string; body: unknown }[] = []
  const fake: typeof fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return new Response('{"sent":true,"id":"x"}', { status: 200 }) }
  assert.ok((await runMailAction("https://b.example", "INBOX", { uids: [3], action: "label", target: "Labels/Work" }, fake)).ok)
  assert.ok((await sendMail("https://b.example", { to: "a@b.co", subject: "s", text: "t" }, fake)).ok)
  assert.equal(calls[0].url, "https://b.example/api/mail/actions?folder=INBOX"); assert.deepEqual(calls[0].body, { uids: [3], action: "label", target: "Labels/Work" })
  assert.equal(calls[1].url, "https://b.example/api/mail/send")
})
