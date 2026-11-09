import { useEffect, useRef, useState, type FormEvent } from "react"
import { create } from "zustand"
import { ArrowLeft, ArrowRight, Globe, Plus, RotateCw, X } from "lucide-react"
import { addressToUrl } from "../../desktop/src/main/url.ts"

/**
 * The Browser window of the Mac desktop: tabs, an address bar and one <webview> per tab, inside the same
 * draggable window frame as Planner and the rest. The Electron side (desktop/src/main/tabs.ts) vets every
 * webview and sends links clicked in Blackwall pages here through window.__bwBrowserOpen.
 */

export interface WebviewElement extends HTMLElement {
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  canGoBack(): boolean
  canGoForward(): boolean
}

interface BrowserTab {
  id: number
  /** What the page was first told to load; empty for a tab that is still blank. Never changes after the page exists. */
  src: string
  /** Where the page is now. */
  url: string
  title: string
  favicon: string | null
  loading: boolean
  canBack: boolean
  canForward: boolean
}

interface BrowserStore {
  tabs: BrowserTab[]
  activeId: number
  /** Shows a page: in the active tab if that is blank, otherwise in a new tab. */
  open(url: string): void
  newTab(): void
  close(id: number): void
  activate(id: number): void
  patch(id: number, change: Partial<BrowserTab>): void
}

const KEY = "blackwall-mac-browser-v1"
const blank = (id: number): BrowserTab => ({ id, src: "", url: "", title: "", favicon: null, loading: false, canBack: false, canForward: false })

function restore(): { tabs: BrowserTab[]; activeId: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { activeId?: number; tabs?: { id?: number; url?: string; title?: string }[] } | null
    const tabs = (saved?.tabs ?? [])
      .filter((t) => typeof t.id === "number" && typeof t.url === "string")
      .slice(0, 12)
      .map((t) => ({ ...blank(t.id!), src: t.url!, url: t.url!, title: typeof t.title === "string" ? t.title : "" }))
    if (tabs.length) return { tabs, activeId: tabs.some((t) => t.id === saved?.activeId) ? saved!.activeId! : tabs[0].id }
  } catch { /* A fresh browser is fine. */ }
  return { tabs: [blank(1)], activeId: 1 }
}

let nextId = 1
export const useBrowser = create<BrowserStore>()((set, get) => {
  const first = restore()
  nextId = Math.max(...first.tabs.map((t) => t.id)) + 1
  return {
    ...first,
    open(url) {
      const active = get().tabs.find((t) => t.id === get().activeId)
      if (active && !active.src) return set((s) => ({ tabs: s.tabs.map((t) => (t.id === active.id ? { ...t, src: url, url } : t)) }))
      const tab = { ...blank(nextId++), src: url, url }
      set((s) => ({ tabs: [...s.tabs, tab].slice(-12), activeId: tab.id }))
    },
    newTab() {
      const tab = blank(nextId++)
      set((s) => ({ tabs: [...s.tabs, tab].slice(-12), activeId: tab.id }))
    },
    close(id) {
      set((s) => {
        const index = s.tabs.findIndex((t) => t.id === id)
        if (index < 0) return s
        const tabs = s.tabs.filter((t) => t.id !== id)
        if (!tabs.length) { const tab = blank(nextId++); return { tabs: [tab], activeId: tab.id } }
        return { tabs, activeId: s.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : s.activeId }
      })
    },
    activate: (id) => set({ activeId: id }),
    patch: (id, change) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...change } : t)) })),
  }
})

useBrowser.subscribe((s) => {
  try { localStorage.setItem(KEY, JSON.stringify({ activeId: s.activeId, tabs: s.tabs.filter((t) => t.src).map((t) => ({ id: t.id, url: t.url || t.src, title: t.title })) })) } catch { /* Tabs just won't come back. */ }
})

/** Live <webview> elements by tab id, and which of them can be driven yet (after dom-ready). */
const views = new Map<number, WebviewElement>()
const ready = new Set<number>()

const hostOf = (url: string) => { try { return new URL(url).host } catch { return url } }
export const tabLabel = (t: BrowserTab) => t.title || (t.url ? hostOf(t.url) : "New tab")

export function BrowserTitle() {
  const label = useBrowser((s) => { const t = s.tabs.find((x) => x.id === s.activeId); return t ? tabLabel(t) : "Browser" })
  return <>{label}</>
}

function go(id: number, text: string) {
  const url = addressToUrl(text)
  if (!url) return
  const view = views.get(id)
  if (view && ready.has(id)) view.loadURL(url).catch(() => undefined) // failures show as the page's own error page
  else useBrowser.getState().patch(id, { src: url, url })
}

/** Runs a webview method, ignoring the error it throws before the page is ready. */
function drive(id: number, fn: (view: WebviewElement) => void) {
  const view = views.get(id)
  if (!view || !ready.has(id)) return
  try { fn(view) } catch { /* not attached yet */ }
}

/** React drops allowpopups as a boolean; the string form reaches the element. Popups are then routed by the Electron side, never opened as windows. */
const POPUPS = { allowpopups: "true" } as object

function PageView({ tab, active, onFocus }: { tab: BrowserTab; active: boolean; onFocus: () => void }) {
  const ref = useRef<HTMLWebViewElement>(null)
  const focus = useRef(onFocus)
  useEffect(() => { focus.current = onFocus })
  const id = tab.id
  useEffect(() => {
    const view = ref.current as unknown as WebviewElement | null
    if (!view) return
    const patch = useBrowser.getState().patch
    const sync = () => {
      if (!ready.has(id)) return
      try { patch(id, { url: view.getURL(), canBack: view.canGoBack(), canForward: view.canGoForward() }) } catch { /* detached */ }
    }
    const listeners: Record<string, (event: Event) => void> = {
      "dom-ready": () => { ready.add(id); sync() },
      "did-navigate": () => { patch(id, { favicon: null }); sync() },
      "did-navigate-in-page": sync,
      "did-start-loading": () => patch(id, { loading: true }),
      "did-stop-loading": () => { patch(id, { loading: false }); sync() },
      "page-title-updated": (event) => patch(id, { title: (event as Event & { title?: string }).title ?? "" }),
      "page-favicon-updated": (event) => { const icon = ((event as Event & { favicons?: string[] }).favicons ?? []).find((f) => /^https?:/.test(f)); if (icon) patch(id, { favicon: icon }) },
      focus: () => focus.current(),
    }
    views.set(id, view)
    for (const [name, fn] of Object.entries(listeners)) view.addEventListener(name, fn)
    return () => {
      for (const [name, fn] of Object.entries(listeners)) view.removeEventListener(name, fn)
      views.delete(id)
      ready.delete(id)
    }
  }, [id])
  return <webview ref={ref} src={tab.src} partition="persist:blackwall-web" {...POPUPS} className="mac-br-page" data-active={active} />
}

export function BrowserApp({ onFocus }: { onFocus: () => void }) {
  const tabs = useBrowser((s) => s.tabs)
  const activeId = useBrowser((s) => s.activeId)
  const { activate, close, newTab } = useBrowser.getState()
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]
  // What is being typed, and for which tab (switching tabs drops it).
  const [typing, setTyping] = useState<{ id: number; text: string } | null>(null)
  const draft = typing && typing.id === active?.id ? typing.text : null
  const setDraft = (text: string | null) => setTyping(text === null || !active ? null : { id: active.id, text })
  const address = useRef<HTMLInputElement>(null)

  // A blank tab is for typing an address.
  const blankId = active && !active.src ? active.id : 0
  useEffect(() => { if (blankId) address.current?.focus() }, [blankId])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (active && draft?.trim()) go(active.id, draft)
    setDraft(null)
    address.current?.blur()
  }

  return <div className="mac-br">
    <div className="mac-br-tabs" role="tablist" aria-label="Browser tabs">
      {tabs.map((tab) => <div key={tab.id} role="tab" tabIndex={0} aria-selected={tab.id === active?.id} className="mac-br-tab" data-active={tab.id === active?.id} title={tab.url || undefined}
        onClick={() => activate(tab.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") activate(tab.id) }} onAuxClick={(e) => { if (e.button === 1) close(tab.id) }}>
        {tab.favicon ? <img src={tab.favicon} alt="" referrerPolicy="no-referrer" onError={() => useBrowser.getState().patch(tab.id, { favicon: null })} /> : <Globe size={13} aria-hidden />}
        <span>{tabLabel(tab)}</span>
        <button type="button" aria-label={`Close ${tabLabel(tab)}`} onClick={(e) => { e.stopPropagation(); close(tab.id) }}><X size={12} /></button>
      </div>)}
      <button type="button" className="mac-br-new" aria-label="New tab" title="New tab" onClick={newTab}><Plus size={14} /></button>
    </div>
    <form className="mac-br-bar" onSubmit={submit}>
      <button type="button" aria-label="Back" title="Back" disabled={!active?.canBack} onClick={() => active && drive(active.id, (v) => v.goBack())}><ArrowLeft size={15} /></button>
      <button type="button" aria-label="Forward" title="Forward" disabled={!active?.canForward} onClick={() => active && drive(active.id, (v) => v.goForward())}><ArrowRight size={15} /></button>
      <button type="button" aria-label={active?.loading ? "Stop" : "Reload"} title={active?.loading ? "Stop" : "Reload"} disabled={!active?.src} onClick={() => active && drive(active.id, (v) => (active.loading ? v.stop() : v.reload()))}>{active?.loading ? <X size={15} /> : <RotateCw size={14} />}</button>
      <input ref={address} aria-label="Address" spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="Search or enter a web address" value={draft ?? active?.url ?? ""}
        onFocus={(e) => { setDraft(active?.url ?? ""); e.currentTarget.select() }} onChange={(e) => setDraft(e.target.value)} onBlur={() => setDraft(null)} onKeyDown={(e) => { if (e.key === "Escape") { setDraft(null); e.currentTarget.blur() } }} />
    </form>
    <div className="mac-br-stage">
      {tabs.map((tab) => tab.src ? <PageView key={tab.id} tab={tab} active={tab.id === active?.id} onFocus={onFocus} /> : null)}
      {active && !active.src && <div className="mac-br-empty"><Globe size={26} aria-hidden /><p>Type an address or a search above.</p><small>Links in your Blackwall pages open here, next to your other windows.</small></div>}
    </div>
  </div>
}
