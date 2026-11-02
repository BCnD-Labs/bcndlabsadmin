import { format } from "date-fns"
import {
  ArrowUpRight,
  ChevronRight,
  Download,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { StatStrip } from "@/components/common/stat-strip"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { timeFmt } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { useUi } from "@/stores/ui"
import { downloadFile, fetchFile, formatSize, isImage, isOffice, isTextFile, joinPath, parentOf, storage, uploadFile, type FolderListing, type StorageEntry, type StorageInfo } from "./storage-api"

function EntryIcon({ entry, className }: { entry: StorageEntry; className?: string }) {
  const Icon = entry.type === "dir" ? Folder : isImage(entry) ? FileImage : /\.(xlsx?|ods|csv)$/i.test(entry.name) ? FileSpreadsheet : isOffice(entry) || /\.(md|txt|pdf)$/i.test(entry.name) ? FileText : isTextFile(entry) ? FileCode2 : File
  return <Icon className={cn("size-4 shrink-0", entry.type === "dir" ? "text-[var(--bw-category)]" : "text-muted-foreground", className)} strokeWidth={1.8} aria-hidden />
}

/** "/Documents/School" as clickable segments, root first. */
function Crumbs({ path, onGo }: { path: string; onGo: (p: string) => void }) {
  const parts = path.split("/").filter(Boolean)
  return (
    <nav aria-label="Folder" className="flex min-w-0 items-center gap-0.5 text-[13px]">
      <button type="button" onClick={() => onGo("/")} className={cn("shrink-0 rounded px-1.5 py-0.5 hover:bg-raised", parts.length ? "text-muted-foreground hover:text-ink" : "font-semibold text-ink")}>Files</button>
      {parts.map((p, i) => {
        const to = "/" + parts.slice(0, i + 1).join("/")
        const last = i === parts.length - 1
        return (
          <span key={to} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
            <button type="button" onClick={() => onGo(to)} aria-current={last ? "page" : undefined} className={cn("truncate rounded px-1.5 py-0.5 hover:bg-raised", last ? "font-semibold text-ink" : "text-muted-foreground hover:text-ink")}>{p}</button>
          </span>
        )
      })}
    </nav>
  )
}

type Ask = { kind: "rename" | "folder" | "newfile"; entry?: StorageEntry } | { kind: "move"; entry: StorageEntry } | { kind: "delete"; entry: StorageEntry } | null

/** One-field dialog: rename, new folder, new text file. */
function NameDialog({ ask, dir, onClose, onDone }: { ask: Extract<NonNullable<Ask>, { kind: "rename" | "folder" | "newfile" }>; dir: string; onClose: () => void; onDone: (selectPath?: string) => void }) {
  const [name, setName] = useState(ask.kind === "rename" ? ask.entry!.name : ask.kind === "newfile" ? "untitled.md" : "")
  const [busy, setBusy] = useState(false)
  const bad = !name.trim() || /[/\\]/.test(name) || name === "." || name === ".."
  const title = ask.kind === "rename" ? `Rename ${ask.entry!.name}` : ask.kind === "folder" ? "New folder" : "New text file"
  const submit = async () => {
    if (bad) return
    setBusy(true)
    try {
      const target = joinPath(ask.kind === "rename" ? parentOf(ask.entry!.path) : dir, name.trim())
      if (ask.kind === "rename") await storage.move(ask.entry!.path, target)
      else if (ask.kind === "folder") await storage.mkdir(target)
      else await storage.writeText(target, "", { create: true })
      toast.success(ask.kind === "rename" ? "Renamed" : ask.kind === "folder" ? "Folder created" : "File created")
      onDone(target)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">Enter a name.</DialogDescription>
        <form onSubmit={(e) => (e.preventDefault(), void submit())} className="grid gap-3">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" onFocus={(e) => { const dot = e.target.value.lastIndexOf("."); e.target.setSelectionRange(0, ask.kind !== "folder" && dot > 0 ? dot : e.target.value.length) }} />
          {/[/\\]/.test(name) && <p className="text-xs text-red-text">Names can't contain / or \.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="quiet" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={bad || busy}>{ask.kind === "rename" ? "Rename" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Pick a destination folder by browsing, then move there. */
function MoveDialog({ entry, onClose, onDone }: { entry: StorageEntry; onClose: () => void; onDone: () => void }) {
  const [dir, setDir] = useState(parentOf(entry.path))
  const [folders, setFolders] = useState<StorageEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    setFolders(null)
    storage.list(dir).then((l) => live && setFolders(l.entries.filter((e) => e.type === "dir" && e.path !== entry.path))).catch((e) => live && (toast.error((e as Error).message), setFolders([])))
    return () => {
      live = false
    }
  }, [dir, entry.path])
  const same = dir === parentOf(entry.path)
  const move = async () => {
    setBusy(true)
    try {
      await storage.move(entry.path, joinPath(dir, entry.name))
      toast.success(`Moved to ${dir === "/" ? "Files" : dir.split("/").at(-1)}`)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Move {entry.name}</DialogTitle>
        <DialogDescription className="sr-only">Choose a folder.</DialogDescription>
        <div className="rounded-lg bg-well px-2 py-1.5"><Crumbs path={dir} onGo={setDir} /></div>
        <ul className="max-h-64 overflow-y-auto rounded-lg bg-raised" aria-label="Folders">
          {folders === null ? <li className="px-3 py-3 text-xs text-muted-foreground">Loading…</li> : folders.length ? folders.map((f) => (
            <li key={f.path}>
              <button type="button" onClick={() => setDir(f.path)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-selected">
                <EntryIcon entry={f} /> <span className="min-w-0 flex-1 truncate">{f.name}</span> <ChevronRight className="size-3.5 text-faint" aria-hidden />
              </button>
            </li>
          )) : <li className="px-3 py-3 text-xs text-muted-foreground">No folders here.</li>}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void move()} disabled={same || busy}>{same ? "Already here" : "Move here"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Text editor (2 MB max). Saving checks the file hasn't changed in Nextcloud since it was opened. */
function TextEditor({ entry, onClose, onSaved }: { entry: StorageEntry; onClose: () => void; onSaved: () => void }) {
  const [doc, setDoc] = useState<{ text: string; etag: string } | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    storage.readText(entry.path).then((d) => (setDoc(d), setText(d.text))).catch((e) => setError((e as Error).message))
  }, [entry.path])
  const dirty = !!doc && text !== doc.text
  const save = async () => {
    if (!doc) return
    setBusy(true)
    try {
      const r = await storage.writeText(entry.path, text, { etag: doc.etag })
      setDoc({ text, etag: r.etag })
      toast.success(`Saved ${entry.name}`)
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && (!dirty || confirm("Discard unsaved changes?")) && onClose()}>
      <DialogContent className="flex h-[min(80dvh,760px)] flex-col gap-3 sm:max-w-3xl">
        <DialogTitle className="flex items-center gap-2 pr-8"><EntryIcon entry={entry} /> <span className="truncate">{entry.name}</span>{dirty && <span className="text-xs font-normal text-amber">· unsaved</span>}</DialogTitle>
        <DialogDescription className="truncate font-mono text-[11px]">{entry.path}</DialogDescription>
        {error ? <p className="text-sm text-red-text">{error}</p> : !doc ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); void save() } }}
            spellCheck={false}
            aria-label={`Contents of ${entry.name}`}
            className="min-h-0 flex-1 resize-none rounded-lg bg-well p-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-[11px] text-faint">⌘/Ctrl + S saves</span>
          <Button variant="quiet" onClick={onClose}>Close</Button>
          <Button onClick={() => void save()} disabled={!dirty || busy}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ImagePreview({ entry, onClose }: { entry: StorageEntry; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    fetchFile(entry.path).then((b) => setUrl((made = URL.createObjectURL(b)))).catch((e) => toast.error((e as Error).message))
    return () => void (made && URL.revokeObjectURL(made))
  }, [entry.path])
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="truncate pr-8">{entry.name}</DialogTitle>
        <DialogDescription className="sr-only">Image preview</DialogDescription>
        <div className="flex min-h-48 items-center justify-center rounded-lg bg-well p-2">{url ? <img src={url} alt={entry.name} className="max-h-[65dvh] max-w-full object-contain" /> : <span className="text-sm text-muted-foreground">Loading…</span>}</div>
      </DialogContent>
    </Dialog>
  )
}

const when = (iso: string) => {
  const d = new Date(iso)
  return d.getFullYear() === new Date().getFullYear() ? format(d, `MMM d, ${timeFmt()}`) : format(d, "MMM d, yyyy")
}

export function MikoshiStoragePage() {
  const [params, setParams] = useSearchParams()
  const dir = params.get("path") || "/"
  const go = useCallback((p: string) => setParams(p === "/" ? {} : { path: p }), [setParams])
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [listing, setListing] = useState<FolderListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [ask, setAsk] = useState<Ask>(null)
  const [editing, setEditing] = useState<StorageEntry | null>(null)
  const [viewing, setViewing] = useState<StorageEntry | null>(null)
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    storage.info().then(setInfo).catch((e) => setInfo({ connected: false, message: (e as Error).message }))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setListing(await storage.list(dir))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dir])
  useEffect(() => {
    if (info?.connected) void load()
  }, [info?.connected, load])
  useEffect(() => {
    setSelected(null)
    setFilter("")
  }, [dir])

  const upload = async (files: FileList | File[]) => {
    const list = [...files]
    if (!list.length) return
    const existing = new Set(listing?.entries.map((e) => e.name))
    const clash = list.filter((f) => existing.has(f.name)).map((f) => f.name)
    if (clash.length && !confirm(`Replace ${clash.length === 1 ? `“${clash[0]}”` : `${clash.length} files`} already in this folder?`)) return
    setUploads(list.map((f) => ({ name: f.name, progress: 0 })))
    let ok = 0
    for (const [i, f] of list.entries()) {
      try {
        await uploadFile(joinPath(dir, f.name), f, (p) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: p } : x))))
        ok++
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`)
      }
    }
    setUploads([])
    if (ok) toast.success(`Uploaded ${ok} ${ok === 1 ? "file" : "files"}`)
    void load()
  }

  const open = (e: StorageEntry) => {
    if (e.type === "dir") return go(e.path)
    if (isTextFile(e) && e.size <= 2 * 1024 * 1024) return setEditing(e)
    if (isImage(e)) return setViewing(e)
    if (isOffice(e) && info?.url && e.fileId) return void window.open(`${info.url}/f/${e.fileId}`, "_blank", "noreferrer")
    void downloadFile(e).catch((err) => toast.error((err as Error).message))
  }
  const remove = async (e: StorageEntry) => {
    try {
      await storage.remove(e.path)
      toast.success(`${e.name} moved to Nextcloud's trash`)
      void load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const entries = (listing?.entries ?? []).filter((e) => !filter.trim() || e.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const sel = listing?.entries.find((e) => e.path === selected)
  const folders = listing?.entries.filter((e) => e.type === "dir").length ?? 0
  const files = (listing?.entries.length ?? 0) - folders
  const quota = listing?.quota
  const nextcloudLink = (e?: StorageEntry) => (info?.url ? (e?.fileId && e.type === "file" ? `${info.url}/f/${e.fileId}` : `${info.url}/apps/files/?dir=${encodeURIComponent(e?.type === "dir" ? e.path : dir)}`) : undefined)

  const actions = (e: StorageEntry) => (
    <>
      <DropdownMenuItem onSelect={() => open(e)}>{e.type === "dir" ? <><Folder /> Open</> : isTextFile(e) ? <><Pencil /> Edit</> : isOffice(e) ? <><ArrowUpRight /> Open in Nextcloud</> : <><Download /> {isImage(e) ? "Preview" : "Download"}</>}</DropdownMenuItem>
      {e.type === "file" && (isTextFile(e) || isImage(e) || isOffice(e)) && <DropdownMenuItem onSelect={() => void downloadFile(e).catch((err) => toast.error((err as Error).message))}><Download /> Download</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => setAsk({ kind: "rename", entry: e })}><Pencil /> Rename</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setAsk({ kind: "move", entry: e })}><FolderInput /> Move…</DropdownMenuItem>
      {nextcloudLink(e) && !isOffice(e) && <DropdownMenuItem asChild><a href={nextcloudLink(e)} target="_blank" rel="noreferrer"><ArrowUpRight /> Open in Nextcloud</a></DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => setAsk({ kind: "delete", entry: e })} className="text-red-text"><Trash2 /> Delete</DropdownMenuItem>
    </>
  )

  if (info && !info.connected) {
    return (
      <>
        <PageHeader title="Mikoshi" />
        <WorkspaceGrid><GridItem span={2}><Panel category="mikoshi" title="Storage">
          <EmptyState roomy icon={HardDrive} title={info.status === "error" ? "Nextcloud needs attention" : "Connect Nextcloud"} action={<Button onClick={() => useUi.getState().openSettings("connections", info.status ? undefined : "nextcloud")}>{info.status ? "Open connections" : "Connect Nextcloud"}</Button>}>
            {info.status === "error" ? info.message : "Use an app password from Nextcloud (Personal settings → Security). Your files stay in Nextcloud; Blackwall browses and edits them there."}
          </EmptyState>
        </Panel></GridItem></WorkspaceGrid>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Mikoshi"
        actions={info?.connected ? (
          <>
            <Button variant="ghost" onClick={() => setAsk({ kind: "folder" })}><FolderPlus /> New folder</Button>
            <Button onClick={() => fileInput.current?.click()}><Upload /> Upload</Button>
          </>
        ) : undefined}
      />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => (void upload(e.target.files ?? []), (e.target.value = ""))} />
      <WorkspaceGrid>
        <GridItem span="full">
          <StatStrip
            items={[
              { label: "Used", value: quota ? formatSize(quota.used) : "—", sub: quota && quota.free >= 0 ? `of ${formatSize(quota.used + quota.free)}` : info?.user ? `${info.user}'s Nextcloud` : undefined },
              { label: "Folders here", value: listing ? folders : "—" },
              { label: "Files here", value: listing ? files : "—" },
              { label: "Connected as", value: <span className="text-base">{info?.user ?? "…"}</span>, sub: info?.url?.replace(/^https?:\/\//, "") },
            ]}
          />
        </GridItem>
        <GridItem span={3}>
          <Panel
            category="mikoshi"
            title="Files"
            subtitle={<Crumbs path={dir} onGo={go} />}
            actions={
              <>
                <label className="relative hidden sm:block">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
                  <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter this folder" aria-label="Filter this folder" className="h-7 w-44 rounded-[7px] bg-well pr-2 pl-7 text-[13px] text-ink outline-none placeholder:text-faint" />
                </label>
                <Button variant="quiet" size="icon-sm" aria-label="New text file" title="New text file" onClick={() => setAsk({ kind: "newfile" })}><FileText /></Button>
                <Button variant="quiet" size="icon-sm" aria-label="Reload" title="Reload" onClick={() => void load()} className={cn(loading && "animate-spin motion-reduce:animate-none")}><RotateCw /></Button>
              </>
            }
          >
            <div
              className={cn("relative min-h-64", dragOver && "bg-[color-mix(in_srgb,var(--bw-category)_8%,transparent)] ring-2 ring-[var(--bw-category)] ring-inset")}
              data-category="mikoshi"
              onDragOver={(e: DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true) } }}
              onDragLeave={(e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false) }}
              onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files) }}
            >
              {uploads.length > 0 && (
                <ul className="border-b border-line-soft px-3.5 py-2" aria-label="Uploading">
                  {uploads.map((u) => (
                    <li key={u.name} className="flex items-center gap-3 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="h-1.5 w-32 overflow-hidden rounded-full bg-off"><span className="block h-full rounded-full bg-[var(--bw-category)]" style={{ width: `${Math.round(u.progress * 100)}%` }} /></span>
                      <span className="w-9 text-right tabular-nums text-muted-foreground">{Math.round(u.progress * 100)}%</span>
                    </li>
                  ))}
                </ul>
              )}
              {error ? (
                <EmptyState icon={HardDrive} title="Couldn't open this folder" action={<Button variant="outline" onClick={() => void load()}>Try again</Button>}>{error}</EmptyState>
              ) : !listing ? (
                <p className="px-3.5 py-6 text-sm text-muted-foreground">Loading…</p>
              ) : entries.length ? (
                <table className="w-full table-fixed text-left text-[13px]">
                  <thead className="text-[11px] text-faint">
                    <tr>
                      <th className="py-2 pl-3.5 font-normal">Name</th>
                      <th className="hidden w-40 py-2 font-normal md:table-cell">Modified</th>
                      <th className="hidden w-24 py-2 pr-2 text-right font-normal sm:table-cell">Size</th>
                      <th className="w-12 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dir !== "/" && !filter && (
                      <tr className="border-t border-line-soft hover:bg-raised">
                        <td colSpan={4} className="py-0">
                          <button type="button" onClick={() => go(parentOf(dir))} className="flex h-10 w-full items-center gap-2.5 pl-3.5 text-left text-muted-foreground hover:text-ink">
                            <Folder className="size-4 text-faint" aria-hidden /> ..
                          </button>
                        </td>
                      </tr>
                    )}
                    {entries.map((e) => (
                      <tr key={e.path} className={cn("group border-t border-line-soft hover:bg-raised", selected === e.path && "bg-selected hover:bg-selected")} data-testid="storage-row">
                        <td className="py-0 pl-3.5">
                          <button type="button" onClick={() => setSelected(e.path)} onDoubleClick={() => open(e)} onKeyDown={(k) => k.key === "Enter" && open(e)} className="flex h-10 w-full min-w-0 items-center gap-2.5 text-left" title={e.type === "dir" ? "Double-click to open" : "Double-click to open; click to select"}>
                            <EntryIcon entry={e} />
                            <span className="min-w-0 truncate text-ink">{e.name}</span>
                          </button>
                        </td>
                        <td className="hidden py-0 text-xs text-muted-foreground md:table-cell">{when(e.modified)}</td>
                        <td className="hidden py-0 pr-2 text-right text-xs text-muted-foreground tabular-nums sm:table-cell">{e.type === "dir" ? (e.size ? formatSize(e.size) : "—") : formatSize(e.size)}</td>
                        <td className="py-0 pr-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="quiet" size="icon-sm" aria-label={`Actions for ${e.name}`} className="opacity-60 group-hover:opacity-100 aria-expanded:opacity-100"><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">{actions(e)}</DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon={Folder} title={filter ? "Nothing matches" : "This folder is empty"} action={!filter && <Button variant="outline" onClick={() => fileInput.current?.click()}><Upload /> Upload files</Button>}>
                  {!filter && "Drop files here to upload them."}
                </EmptyState>
              )}
            </div>
          </Panel>
        </GridItem>
        <GridItem className="[&>.bw-panel]:flex-none">
          <Panel category="mikoshi" title={sel ? "Details" : "This folder"} bodyClassName="px-3.5 py-3">
            {sel ? (
              <div className="grid gap-3">
                <div className="flex items-center gap-2.5"><EntryIcon entry={sel} className="size-5" /><span className="min-w-0 break-all text-sm font-semibold text-ink">{sel.name}</span></div>
                <dl className="grid gap-1 text-[13px]">
                  {[["Type", sel.type === "dir" ? "Folder" : sel.mime ?? "File"], ["Size", sel.size ? formatSize(sel.size) : "—"], ["Modified", when(sel.modified)], ["Path", sel.path]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-0.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-all text-right text-ink">{v}</dd></div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(sel)}>{sel.type === "dir" ? "Open" : isTextFile(sel) ? "Edit" : isOffice(sel) ? "Open in Nextcloud" : isImage(sel) ? "Preview" : "Download"}</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="outline">More</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">{actions(sel)}</DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 text-[13px] text-muted-foreground">
                <p>{listing ? `${folders} ${folders === 1 ? "folder" : "folders"}, ${files} ${files === 1 ? "file" : "files"}.` : "Loading…"}</p>
                <p>Click a row for details. Double-click opens: folders open here, text files open in the editor, office files open in Nextcloud.</p>
                {nextcloudLink() && <a href={nextcloudLink()} target="_blank" rel="noreferrer" className="bw-action-link"><ArrowUpRight className="size-3.5" /> Open this folder in Nextcloud</a>}
              </div>
            )}
          </Panel>
        </GridItem>
      </WorkspaceGrid>

      {ask && (ask.kind === "rename" || ask.kind === "folder" || ask.kind === "newfile") && (
        <NameDialog ask={ask} dir={dir} onClose={() => setAsk(null)} onDone={(p) => { setAsk(null); void load().then(() => p && setSelected(p)) }} />
      )}
      {ask?.kind === "move" && <MoveDialog entry={ask.entry} onClose={() => setAsk(null)} onDone={() => { setAsk(null); void load() }} />}
      {ask?.kind === "delete" && (
        <Dialog open onOpenChange={(o) => !o && setAsk(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Delete {ask.entry.name}?</DialogTitle>
            <DialogDescription>{ask.entry.type === "dir" ? "The folder and everything in it go" : "It goes"} to Nextcloud's trash bin, where you can restore it.</DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="quiet" onClick={() => setAsk(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { const e = ask.entry; setAsk(null); void remove(e) }}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {editing && <TextEditor entry={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />}
      {viewing && <ImagePreview entry={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
