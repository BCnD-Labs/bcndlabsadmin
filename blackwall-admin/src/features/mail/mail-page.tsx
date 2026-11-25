import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { NextcloudPicker } from "@/features/documents/nextcloud-picker"
import { DocumentPane } from "@/features/documents/document-viewer"
import { api } from "@/services/connector"
import { formatSize } from "@shared/storage"

type Folder = { path: string; name: string; specialUse: string | null }
type MailSummary = { uid: number; subject: string; from: string; to: string; date: string; unread: boolean; size: number }
type Attachment = { index: number; name: string; mime: string; size: number }
type MailMessage = MailSummary & { text: string; html: string; attachments: Attachment[] }
const query = (folder: string) => `?folder=${encodeURIComponent(folder)}`
const mailPath = (uid: number, folder: string) => `mail/messages/${uid}${query(folder)}`
const attachmentPath = (uid: number, folder: string, index: number) => `mail/messages/${uid}/attachments/${index}${query(folder)}`

async function loadAttachment(uid: number, folder: string, index: number): Promise<Blob> {
  const res = await fetch(`/api/${attachmentPath(uid, folder, index)}`, { headers: { "X-Blackwall": "1" } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
  return res.blob()
}

function AttachmentPreview({ attachment, uid, folder, onClose }: { attachment: Attachment; uid: number; folder: string; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(() => loadAttachment(uid, folder, attachment.index), [uid, folder, attachment.index])
  useEffect(() => {
    let active = true
    load().then(async (data) => {
      if (!active) return
      const typed = new Blob([data], { type: attachment.mime })
      setBlob(typed)
      setUrl(URL.createObjectURL(typed))
      if (/^text\//.test(attachment.mime) || /\.(txt|md|csv|json|log)$/i.test(attachment.name)) {
        const content = await typed.text()
        if (active) setText(content)
      }
    }).catch((e) => active && setError((e as Error).message))
    return () => { active = false }
  }, [load, attachment.mime, attachment.name])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  const save = async (path: string) => {
    setPicker(false); setSaving(true); setError(null)
    try {
      const result = await api<{ path: string }>(`mail/messages/${uid}/attachments/${attachment.index}/save${query(folder)}`, { method: "POST", body: JSON.stringify({ folder: path }) })
      setSaved(result.path)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }
  const download = () => {
    if (!url) return
    const link = Object.assign(document.createElement("a"), { href: url, download: attachment.name })
    document.body.append(link); link.click(); link.remove()
  }
  const office = /\.(docx|xlsx|pptx)$/i.test(attachment.name)
  return <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="truncate">{attachment.name}</DialogTitle>
        <DialogDescription>{formatSize(attachment.size)} · {attachment.mime || "Attachment"}</DialogDescription>
        <div className="max-h-[60dvh] min-h-40 overflow-auto rounded-md border border-line-soft bg-well">
          {error && !blob ? <p role="alert" className="p-4 text-sm text-red-text">{error}</p> : !blob ? <p className="p-4 text-sm text-muted-foreground">Opening…</p> : office ? <div className="min-h-96"><DocumentPane name={attachment.name} load={load} /></div> : attachment.mime.startsWith("image/") && url ? <img src={url} alt={attachment.name} className="mx-auto max-h-[58dvh] max-w-full object-contain" /> : attachment.mime === "application/pdf" && url ? <iframe title={attachment.name} src={url} className="h-[55dvh] w-full" /> : text != null ? <pre className="whitespace-pre-wrap break-words p-4 text-sm">{text}</pre> : <p className="p-4 text-sm text-muted-foreground">Preview is unavailable for this file type. Download it to open it.</p>}
        </div>
        {error && blob && <p role="alert" className="text-sm text-red-text">{error}</p>}
        {saved && <p role="status" className="text-sm">Saved to Nextcloud: {saved}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={download} disabled={!blob}>Download</Button>
          <Button onClick={() => setPicker(true)} disabled={!blob || saving}>{saving ? "Saving…" : "Save to Nextcloud"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    {picker && <NextcloudPicker folders onPick={(path) => void save(path)} onClose={() => setPicker(false)} />}
  </>
}

export function MailPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState("INBOX")
  const [messages, setMessages] = useState<MailSummary[]>([])
  const [selected, setSelected] = useState<MailMessage | null>(null)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([api<{ folders: Folder[] }>("mail/folders"), api<{ messages: MailSummary[] }>(`mail/messages${query(folder)}`)])
      setFolders(f.folders); setMessages(m.messages); setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [folder])
  useEffect(() => { void refresh() }, [refresh])
  const open = async (uid: number) => {
    setBusy(true); setError(null)
    try { setSelected(await api<MailMessage>(mailPath(uid, folder))); setComposing(false) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const send = async () => {
    setBusy(true); setError(null)
    try {
      await api("mail/send", { method: "POST", body: JSON.stringify({ to, subject, text: body }) })
      setComposing(false); setTo(""); setSubject(""); setBody(""); setNotice("Message sent")
      void refresh()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const trash = async () => {
    if (!selected) return
    setBusy(true); setError(null)
    try {
      await api(`mail/messages/${selected.uid}/trash${query(folder)}`, { method: "POST" })
      setSelected(null); setNotice("Moved to Trash"); await refresh()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <>
    <PageHeader title="Mail" subtitle="Proton Mail Bridge" actions={<Button onClick={() => { setSelected(null); setComposing(true); setNotice(null) }}>Compose</Button>} />
    {error && <p role="alert" className="mb-3 rounded-md border border-red/30 p-3 text-sm text-red-text">{error} {error.includes("Connect and test") && <Link className="underline" to="/settings/connections">Open Connections</Link>}</p>}
    {notice && <p role="status" className="mb-3 text-sm">{notice}</p>}
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(15rem,22rem)_minmax(0,1fr)]">
      <Panel title="Folders" category="mail"><div className="p-2">{folders.map((f) => <button key={f.path} type="button" onClick={() => { setFolder(f.path); setSelected(null); setComposing(false) }} className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised ${folder === f.path ? "bg-raised font-semibold" : ""}`}>{f.name || f.path}</button>)}</div></Panel>
      <Panel title="Messages" category="mail" count={messages.length} actions={<Button size="sm" variant="ghost" onClick={() => void refresh()}>Refresh</Button>}>
        <div className="max-h-[70dvh] overflow-auto">{error ? <p className="p-4 text-sm text-muted-foreground">Mail is unavailable.</p> : messages.length ? messages.map((m) => <button key={m.uid} type="button" onClick={() => void open(m.uid)} className={`block w-full border-b border-line-soft px-3 py-3 text-left hover:bg-raised ${selected?.uid === m.uid ? "bg-raised" : ""}`}><span className={m.unread ? "block truncate text-sm font-semibold" : "block truncate text-sm"}>{m.from || "Unknown sender"}</span><span className="block truncate text-sm">{m.subject}</span><time className="text-xs text-muted-foreground" dateTime={m.date}>{new Date(m.date).toLocaleString()}</time></button>) : <p className="p-4 text-sm text-muted-foreground">No messages in this folder.</p>}</div>
      </Panel>
      <Panel title={composing ? "Compose" : selected?.subject || "Message"} category="mail" actions={selected && !composing ? <Button size="sm" variant="ghost" onClick={() => void trash()} disabled={busy}>Move to Trash</Button> : undefined}>
        <div className="min-h-80 p-4">{composing ? <div className="space-y-3"><label className="block text-sm">To<Input value={to} onChange={(e) => setTo(e.target.value)} type="email" autoComplete="email" /></label><label className="block text-sm">Subject<Input value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label className="block text-sm">Message<Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-48" /></label><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setComposing(false)}>Cancel</Button><Button onClick={() => void send()} disabled={busy}>{busy ? "Sending…" : "Send"}</Button></div></div> : selected ? <><p className="mb-1 text-sm"><strong>From:</strong> {selected.from}</p><p className="mb-3 text-sm"><strong>To:</strong> {selected.to}</p><p className="mb-4 text-xs text-muted-foreground">{new Date(selected.date).toLocaleString()}</p>{selected.text ? <div className="whitespace-pre-wrap break-words text-sm">{selected.text}</div> : selected.html ? <iframe title="Message content" sandbox="" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:">${selected.html}`} className="min-h-80 w-full bg-white" /> : <p className="text-sm text-muted-foreground">No message text.</p>}{selected.attachments.length > 0 && <div className="mt-5 border-t border-line-soft pt-3"><h3 className="mb-2 text-sm font-semibold">Attachments</h3>{selected.attachments.map((a) => <button key={a.index} type="button" onClick={() => setPreview(a)} className="mr-2 mb-2 rounded-md border border-line-soft px-3 py-2 text-sm hover:bg-raised">{a.name} · {formatSize(a.size)}</button>)}</div>}</> : <p className="text-sm text-muted-foreground">Select a message or compose a new one.</p>}</div>
      </Panel>
    </div>
    {selected && preview && <AttachmentPreview key={`${selected.uid}:${preview.index}`} attachment={preview} uid={selected.uid} folder={folder} onClose={() => setPreview(null)} />}
  </>
}
