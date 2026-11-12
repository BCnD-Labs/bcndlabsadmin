import { ExternalLink, FileText, Link2, Plus, X } from "lucide-react"
import { useState } from "react"
import type { DocLink } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { openNextcloudLink } from "@/features/documents/linked-document"
import { NextcloudPicker } from "@/features/documents/nextcloud-picker"
import { nextcloudLink, nextcloudPathOf } from "@/features/documents/nextcloud-link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/**
 * Document links: a label + URL that opens in whatever app owns the file. Blackwall never
 * renders or edits them. Web links plus common app schemes (SiYuan, Obsidian, VS Code, OneNote,
 * Office, Notion, AFFiNE) are allowed, plus `nextcloud:/path/file` for a file in your Nextcloud, which opens in the built-in viewer; script/data URLs never are.
 */
const SAFE = /^(https?:\/\/|siyuan:|obsidian:|vscode:|onenote:|ms-(word|excel|powerpoint):|notion:|affine:|mailto:|nextcloud:)/i
export const isSafeLink = (url: string) => SAFE.test(url.trim())
export const cleanLinks = (links: DocLink[]) => links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url && isSafeLink(l.url)).map((l) => ({ ...l, label: l.label || hostOf(l.url) }))

function hostOf(url: string) {
  try {
    const u = new URL(url)
    return u.hostname || u.protocol.replace(":", "")
  } catch {
    return url.slice(0, 40)
  }
}

/** Form editor: rows of label + URL. */
export function DocLinksField({ value, onChange }: { value: DocLink[]; onChange: (links: DocLink[]) => void }) {
  const [picking, setPicking] = useState(false)
  return (
    <div className="grid gap-2">
      {value.map((l, i) => {
        const bad = !!l.url.trim() && !isSafeLink(l.url)
        return (
          <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] items-start gap-2">
            <Input aria-label="Link name" placeholder="Name, e.g. Lab 7 doc" value={l.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <div>
              <Input aria-label="Link URL" aria-invalid={bad} placeholder="https://… or siyuan://blocks/…" value={l.url} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              {bad && <p className="mt-1 text-[11px] text-red-text">Use a web link (https://) or an app link like siyuan://.</p>}
            </div>
            <Button type="button" variant="quiet" size="icon-sm" aria-label="Remove link" onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { label: "", url: "" }])}><Plus /> Add link</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}><FileText /> Link a Nextcloud file</Button>
      </div>
      {picking && <NextcloudPicker onClose={() => setPicking(false)} onPick={(path, name) => { const url = nextcloudLink(path); if (url) onChange([...value.filter((l) => l.url.trim()), { label: name, url }]); setPicking(false) }} />}
    </div>
  )
}

/** Compact paperclip button with a count; lists the links in a menu. Renders nothing without links. */
export function DocLinksMenu({ links, className }: { links?: DocLink[]; className?: string }) {
  if (!links?.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-raised px-2 text-[11px] text-ink-2 hover:text-ink ${className ?? ""}`}
        aria-label={`${links.length} linked ${links.length === 1 ? "document" : "documents"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Link2 className="size-3.5" aria-hidden />{links.length}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="bw-label">Linked documents</DropdownMenuLabel>
        {links.map((l, i) => (
          nextcloudPathOf(l.url) ? (
            <DropdownMenuItem key={i} onSelect={() => openNextcloudLink(l)} className="flex items-center gap-2">
              <FileText className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{l.label}</span>
            </DropdownMenuItem>
          ) : (
          <DropdownMenuItem key={i} asChild>
            <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2">
              <ExternalLink className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{l.label}</span>
            </a>
          </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Inline list (for detail views such as a course overview). */
export function DocLinksList({ links }: { links?: DocLink[] }) {
  if (!links?.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {links.map((l, i) => (
        <li key={i}>
          {nextcloudPathOf(l.url) ? (
            <button type="button" onClick={() => openNextcloudLink(l)} className="inline-flex h-[var(--bw-control-sm)] max-w-64 items-center gap-1.5 rounded-full bg-raised px-3 text-xs text-ink-2 hover:text-ink">
              <FileText className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{l.label}</span>
            </button>
          ) : (
          <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-[var(--bw-control-sm)] max-w-64 items-center gap-1.5 rounded-full bg-raised px-3 text-xs text-ink-2 hover:text-ink">
            <ExternalLink className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{l.label}</span>
          </a>
          )}
        </li>
      ))}
    </ul>
  )
}
