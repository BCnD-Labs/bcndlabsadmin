import { Check, EyeOff, Inbox, Mail, MailCheck, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Fragment, useEffect, useState } from "react"
import { toast } from "sonner"
import type { InboxItem, InboxKind } from "@shared/site-inbox"
import type { Site } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { SegmentedTabs } from "@/components/common/segmented-tabs"
import { StatusMarker } from "@/components/common/tags"
import { timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useConnections } from "@/services/connector"
import { useInbox } from "@/services/inbox"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"

type Show = "all" | InboxKind
const KIND_LABEL: Record<InboxKind, string> = { form: "Message", comment: "Comment", newsletter: "Sign-up" }
const HIDDEN = new Set(["email", "name", "comment"])

/** One message, comment or sign-up: who, what, and the actions that fit it. */
function InboxRow({ item, open, onToggle }: { item: InboxItem; open: boolean; onToggle: () => void }) {
  const forms = useWorkspace((s) => s.forms)
  const drafts = useWorkspace((s) => s.drafts)
  const { setStatus, remove } = useInbox()
  const where = item.kind === "comment" ? `on ${drafts.find((d) => d.siteId === item.site && d.slug === item.post)?.title ?? item.post ?? "a post"}` : item.kind === "form" ? forms.find((f) => f.id === item.form)?.name ?? "Form" : "Newsletter"
  const text = item.kind === "comment" ? item.fields.comment ?? "" : Object.entries(item.fields).filter(([k]) => !HIDDEN.has(k)).map(([, v]) => v).join(" · ")
  const unread = item.status === "new"
  const toggle = () => { onToggle(); if (unread && item.kind === "form") setStatus([item.id], "read") }
  return (
    <li className={cn("border-t border-line-soft first:border-t-0", open && "bg-raised")}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full min-w-0 items-start gap-3 px-3.5 py-2.5 text-left hover:bg-raised">
        <StatusMarker tone={unread ? "warn" : item.status === "approved" ? "ok" : "off"} className="mt-1.5" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <b className={cn("truncate text-[13px]", unread ? "text-ink" : "text-ink-2")}>{item.name || item.email}</b>
            <span className="shrink-0 text-[11.5px] text-faint">{KIND_LABEL[item.kind]} · {where}</span>
          </span>
          {text && !open && <span className="block truncate text-[12.5px] text-muted-foreground">{text}</span>}
        </span>
        <span className="shrink-0 text-[11.5px] text-faint">{timeAgo(item.at)}</span>
      </button>
      {open && (
        <div className="grid gap-2.5 px-3.5 pb-3 pl-9">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-faint">Email</dt><dd className="truncate text-ink-2">{item.email} {item.verified ? <span className="text-green">· confirmed</span> : <span className="text-faint">· not confirmed by email</span>}</dd>
            {Object.entries(item.fields).filter(([k]) => k !== "email").map(([k, v]) => <Fragment key={k}><dt className="text-faint capitalize">{k}</dt><dd className="whitespace-pre-wrap text-ink-2">{v}</dd></Fragment>)}
            {item.page && <><dt className="text-faint">Sent from</dt><dd className="truncate"><a className="text-muted-foreground hover:underline" href={item.page} target="_blank" rel="noreferrer">{item.page}</a></dd></>}
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {item.kind === "comment" && item.status !== "approved" && <Button size="sm" variant="outline" onClick={() => { setStatus([item.id], "approved"); toast.success("Approved", { description: "It shows under the post after you publish." }) }}><Check /> Approve</Button>}
            {item.kind === "comment" && item.status !== "hidden" && <Button size="sm" variant="outline" onClick={() => setStatus([item.id], "hidden")}><EyeOff /> {item.status === "approved" ? "Unapprove" : "Hide"}</Button>}
            {item.kind !== "newsletter" && <Button size="sm" variant="outline" asChild><a href={`mailto:${item.email}`}><Mail /> Reply</a></Button>}
            {item.kind === "form" && item.status !== "new" && <Button size="sm" variant="ghost" onClick={() => setStatus([item.id], "new")}>Mark unread</Button>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove([item.id])}><Trash2 /> Delete</Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Website → Forms: what visitors sent (messages, comments to approve, sign-ups) and the reusable form library. */
export function FormsPanel({ site }: { site: Site }) {
  const forms = useWorkspace((s) => s.forms)
  const pages = useWorkspace((s) => s.pages)
  const sites = useWorkspace((s) => s.sites)
  const openForm = useUi((s) => s.openForm)
  const inbox = useInbox()
  const receiver = useConnections((s) => s.list).find((c) => c.provider === "forms")
  const [show, setShow] = useState<Show>("all")
  const [open, setOpen] = useState<string>()
  useEffect(() => {
    void useInbox.getState().refresh()
    const t = setInterval(() => void useInbox.getState().refresh(), 60_000)
    return () => clearInterval(t)
  }, [])
  const usedOn = (id: string) => pages.filter((p) => JSON.stringify(p.sections).includes(id)).map((p) => `${sites.find((s) => s.id === p.siteId)?.name ?? "?"} · ${p.title}`)

  const mine = inbox.items.filter((i) => i.site === site.id)
  const count = (k: InboxKind) => mine.filter((i) => i.kind === k).length
  const waiting = mine.filter((i) => i.status === "new").length
  const shown = mine.filter((i) => show === "all" || i.kind === show).sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || b.at.localeCompare(a.at))
  const check = async () => {
    try {
      const n = await inbox.collect()
      toast.success(n ? `${n} new` : "Nothing new")
    } catch (e) {
      toast.error("Couldn't check", { description: (e as Error).message })
    }
  }

  return (
    <div className="grid content-start gap-[var(--bw-grid-gap)]">
          <Panel
            category="website"
            title="Inbox"
            meta={waiting ? `${waiting} new` : mine.length ? `${mine.length} total` : undefined}
            actions={receiver ? <Button variant="ghost" size="xs" onClick={check} disabled={inbox.checking}><RefreshCw className={cn(inbox.checking && "animate-spin")} /> Check now</Button> : undefined}
            bodyClassName="flex flex-col"
          >
            {receiver && mine.length > 0 && (
              <div className="border-b border-line-soft px-3.5 py-2">
                <SegmentedTabs label="Show" value={show} onChange={(v) => setShow(v as Show)} className="max-w-full overflow-x-auto [scrollbar-width:none]" tabClassName="flex-none px-2.5"
                  tabs={[{ value: "all", label: "All", count: mine.length }, { value: "form", label: "Messages", count: count("form") }, { value: "comment", label: "Comments", count: count("comment") }, { value: "newsletter", label: "Sign-ups", count: count("newsletter") }]} />
              </div>
            )}
            {!receiver ? (
              <EmptyState icon={Inbox} title="Connect your form receiver" action={<Button variant="outline" onClick={() => useUi.getState().openSettings("connections", "forms")}>Connect it</Button>}>
                Forms on a static site send to a small Cloudflare Worker (worker/forms in this repo) that checks the email and holds what's sent until Blackwall collects it.
              </EmptyState>
            ) : shown.length ? (
              <ul>{shown.map((i) => <InboxRow key={i.id} item={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? undefined : i.id)} />)}</ul>
            ) : (
              <EmptyState icon={Inbox} title={mine.length ? "Nothing here" : "Nothing sent yet"}>
                {!site.formEndpoint ? "Set Form receiver in Site settings so this site's forms post to your Worker." : "Messages, comments and sign-ups show up here within a minute of being confirmed."}
              </EmptyState>
            )}
          </Panel>
          <Panel category="website" title="Receiver" bodyClassName="grid content-start gap-2 px-3.5 py-3 text-[12.5px]">
            <p className="flex items-center gap-2 text-ink-2"><StatusMarker tone={!receiver ? "off" : receiver.status === "ok" ? "ok" : receiver.status === "error" ? "error" : "warn"} />{!receiver ? "Not connected" : receiver.status === "ok" ? "Connected" : receiver.status === "error" ? "Needs attention" : "Not tested yet"}</p>
            {receiver?.summary?.slice(1).map((s) => <p key={s.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{s.label}</span><span className="text-ink-2">{s.value}</span></p>)}
            {receiver?.status === "error" && receiver.message && <p className="text-red-light">{receiver.message}</p>}
            <p className="text-[11.5px] text-muted-foreground">Comments only appear on the site after you approve them and publish.</p>
          </Panel>
          <Panel category="website" title="Form library" meta="reusable on any site" actions={<Button variant="outline" size="xs" onClick={() => openForm({ kind: "siteForm" })}><Plus /> Form</Button>}>
            {forms.length ? (
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="text-[11px] text-faint"><tr><th className="py-2 pl-3.5 font-normal">Form</th><th className="font-normal">Used on</th><th className="hidden w-24 font-normal @2xl:table-cell">Edited</th></tr></thead>
                <tbody>
                  {forms.map((f) => {
                    const used = usedOn(f.id)
                    return (
                      <tr key={f.id} className="cursor-pointer border-t border-line-soft hover:bg-raised" onClick={() => openForm({ kind: "siteForm", id: f.id })}>
                        <td className="py-2 pl-3.5"><b className="text-ink">{f.name}</b><span className="block truncate text-[11.5px] text-muted-foreground">{f.fields.map((x) => x.label).join(" · ")}</span></td>
                        <td className="truncate text-xs text-muted-foreground">{used.length ? used.join(", ") : "Not on a page yet"}</td>
                        <td className="hidden text-xs text-muted-foreground @2xl:table-cell">{timeAgo(f.updatedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={MailCheck} title="No forms yet" action={<Button variant="outline" onClick={() => openForm({ kind: "siteForm" })}><Plus /> Form</Button>}>
                Make a contact form once, then add it to any page with the Form block. Newsletter sign-ups have their own block.
              </EmptyState>
            )}
          </Panel>
    </div>
  )
}
