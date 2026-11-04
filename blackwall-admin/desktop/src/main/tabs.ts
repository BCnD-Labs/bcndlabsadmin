import { Menu, WebContentsView, clipboard, shell, type BrowserWindow, type Session, type WebContents } from "electron"
import { CHROME_HEIGHT, type FindResult, type TabError, type TabState } from "../shared/ipc.ts"
import { NATIVE_HOME } from "./native-workspace.ts"
import { classifyLink, sameOrigin } from "./url.ts"
import { confirmExternal } from "./web-session.ts"

/**
 * One tab = one WebContentsView in the tab session, created when the tab is
 * first shown. Tabs have no preload and no IPC: sandbox on, context isolation
 * on, Node off. Only the active tab's view is visible; it sits below the chrome.
 *
 * Kinds: "native" is the pinned bundled Blackwall workspace, "web" is a
 * normal browser tab.
 */
export type TabKind = "native" | "web"

export interface TabInit {
  kind: TabKind
  url: string | null
  title?: string
}

interface Tab {
  id: number
  kind: TabKind
  view: WebContentsView | null
  /** What to load when the view is created, and what the address bar shows until then. */
  url: string
  title: string
  favicon: string | null
  loading: boolean
  error: TabError | null
}

export interface TabHost {
  window: BrowserWindow
  session: Session
  webAddress(): string | null
  /** True while the chrome draws a full-page panel; tab views are hidden then. */
  overlayOpen(): boolean
  changed(): void
  found(result: FindResult): void
  /** Called for every tab's webContents (shortcut handling). */
  attach(contents: WebContents): void
}

let nextId = 1

export class TabManager {
  private tabs: Tab[] = []
  private activeId = 0

  constructor(private readonly host: TabHost) {}

  /** Adds a tab. Pinned tabs go first; others after the active tab or at the end. */
  add(init: TabInit, { activate = true, afterActive = false, eager = false } = {}): number {
    const tab: Tab = {
      id: nextId++,
      kind: init.kind,
      view: null,
      url: init.url ?? "",
      // Empty for unloaded web tabs: the chrome falls back to the URL's host, then "New tab".
      title: init.title || (init.kind === "native" ? "Blackwall" : ""),
      favicon: null,
      loading: false,
      error: null,
    }
    if (tab.kind === "native") this.tabs.unshift(tab)
    else if (afterActive) this.tabs.splice(this.indexOf(this.activeId) + 1, 0, tab)
    else this.tabs.push(tab)
    if (eager && tab.url) this.createView(tab)
    if (activate || !this.activeId) this.activate(tab.id)
    else {
      this.layout()
      this.host.changed()
    }
    return tab.id
  }

  get active(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId)
  }

  get activeContents(): WebContents | null {
    const view = this.active?.view
    return view && !view.webContents.isDestroyed() ? view.webContents : null
  }

  get pinned(): Tab | undefined {
    return this.tabs.find((t) => t.kind === "native")
  }

  list(): readonly Tab[] {
    return this.tabs
  }

  private indexOf(id: number) {
    return this.tabs.findIndex((t) => t.id === id)
  }

  activate(id: number) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    if (this.activeId !== id) this.active?.view?.webContents.stopFindInPage("clearSelection")
    this.activeId = id
    if (!tab.view && tab.url) this.createView(tab)
    this.layout()
    this.host.changed()
  }

  /** Cmd+1…8 pick that tab, Cmd+9 the last one (as in Chrome and Safari). */
  activateIndex(n: number) {
    const tab = n === 9 ? this.tabs[this.tabs.length - 1] : this.tabs[n - 1]
    if (tab) this.activate(tab.id)
  }

  activateRelative(step: number) {
    if (!this.tabs.length) return
    const i = this.indexOf(this.activeId)
    this.activate(this.tabs[(i + step + this.tabs.length) % this.tabs.length].id)
  }

  /** Closes a tab. Pinned tabs can't be closed; returns false then. */
  close(id: number): boolean {
    const i = this.indexOf(id)
    const tab = this.tabs[i]
    if (!tab || tab.kind === "native") return false
    this.tabs.splice(i, 1)
    this.destroyView(tab)
    if (this.activeId === id) {
      const next = this.tabs[Math.min(i, this.tabs.length - 1)] ?? this.tabs[0]
      this.activeId = 0
      if (next) this.activate(next.id)
    }
    this.host.changed()
    return true
  }

  /** Loads a URL in a tab (creating its view if needed). */
  load(id: number, url: string) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    tab.url = url
    tab.error = null
    if (!tab.view) {
      if (id === this.activeId) this.createView(tab)
    } else {
      void tab.view.webContents.loadURL(url).catch(() => {}) // failures arrive as did-fail-load
    }
    this.layout()
    this.host.changed()
  }

  retry() {
    const tab = this.active
    if (!tab?.error || !tab.view) return
    const url = tab.error.url || tab.url
    tab.error = null
    void tab.view.webContents.loadURL(url).catch(() => {})
    this.layout()
    this.host.changed()
  }

  /** Positions and shows the active view below the chrome; hides the others. */
  layout() {
    const { width, height } = this.host.window.getContentBounds()
    const bounds = { x: 0, y: CHROME_HEIGHT, width, height: Math.max(0, height - CHROME_HEIGHT) }
    for (const tab of this.tabs) {
      if (!tab.view) continue
      const show = tab.id === this.activeId && !tab.error && !this.host.overlayOpen()
      tab.view.setBounds(bounds)
      tab.view.setVisible(show)
    }
  }

  state(): TabState[] {
    return this.tabs.map((t) => {
      const wc = t.view && !t.view.webContents.isDestroyed() ? t.view.webContents : null
      return {
        id: t.id,
        pinned: t.kind === "native",
        title: t.title,
        url: t.error?.url || t.url,
        favicon: t.favicon,
        loading: t.loading,
        canGoBack: !!wc?.navigationHistory.canGoBack(),
        canGoForward: !!wc?.navigationHistory.canGoForward(),
        error: t.error,
      }
    })
  }

  get activeTabId() {
    return this.activeId
  }

  destroyAll() {
    for (const tab of this.tabs) this.destroyView(tab)
    this.tabs = []
  }

  private destroyView(tab: Tab) {
    if (!tab.view) return
    this.host.window.contentView.removeChildView(tab.view)
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
    tab.view = null
  }

  private createView(tab: Tab) {
    const view = new WebContentsView({
      webPreferences: {
        session: this.host.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        webviewTag: false,
        safeDialogs: true,
        scrollBounce: false,
        spellcheck: true,
      },
    })
    view.setBackgroundColor("#1f2228") // --bw-ground, so a loading page isn't a white flash
    tab.view = view
    this.host.window.contentView.addChildView(view)
    this.wire(tab, view.webContents)
    this.host.attach(view.webContents)
    void view.webContents.loadURL(tab.url).catch(() => {})
  }

  private wire(tab: Tab, wc: WebContents) {
    const changed = () => this.host.changed()

    wc.on("did-start-loading", () => {
      tab.loading = true
      changed()
    })
    wc.on("did-stop-loading", () => {
      tab.loading = false
      changed()
    })
    wc.on("did-start-navigation", (details) => {
      if (!details.isMainFrame || details.isSameDocument) return
      if (tab.error) {
        tab.error = null
        this.layout()
      }
      changed()
    })
    const updateUrl = () => {
      const url = wc.getURL()
      if (url && !url.startsWith("chrome-error:")) tab.url = url
      changed()
    }
    wc.on("did-navigate", () => {
      tab.favicon = null // the new page reports its own (page-favicon-updated)
      updateUrl()
    })
    wc.on("did-navigate-in-page", (_e, _url, isMainFrame) => isMainFrame && updateUrl())
    wc.on("page-title-updated", (_e, title) => {
      tab.title = title || tab.url
      changed()
    })
    wc.on("page-favicon-updated", (_e, favicons) => {
      const url = favicons.find((f) => /^(https?:|data:image\/)/.test(f))
      if (url) void this.loadFavicon(tab, url)
    })
    wc.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
      // -3 = ABORTED: the user stopped it or started another navigation.
      if (!isMainFrame || code === -3) return
      tab.error = { kind: "load", code, description, url: url || tab.url }
      tab.loading = false
      this.layout()
      changed()
    })
    wc.on("render-process-gone", (_e, details) => {
      if (details.reason === "clean-exit") return
      tab.error = { kind: "crash", reason: details.reason, url: tab.url }
      tab.loading = false
      this.layout()
      changed()
    })
    wc.on("found-in-page", (_e, result) => {
      if (tab.id === this.activeId) this.host.found({ active: result.activeMatchOrdinal, matches: result.matches })
    })

    // target=_blank / window.open → a new tab, never a new window.
    wc.setWindowOpenHandler(({ url, disposition }) => {
      const server = this.host.webAddress()
      if (tab.kind === "native" && url.startsWith("bw-native://app/")) this.load(tab.id, url)
      else if (tab.kind === "native" && server && sameOrigin(url, server)) {
        const target = new URL(url)
        this.load(tab.id, NATIVE_HOME + target.pathname.slice(1) + target.search + target.hash)
      } else this.openLink(url, disposition !== "background-tab")
      return { action: "deny" }
    })

    wc.on("will-navigate", (event) => {
      const url = event.url
      if (tab.kind === "native" && url.startsWith("bw-native://app/")) return
      const server = this.host.webAddress()
      if (tab.kind === "native" && server && sameOrigin(url, server)) {
        event.preventDefault()
        const target = new URL(url)
        this.load(tab.id, NATIVE_HOME + target.pathname.slice(1) + target.search + target.hash)
        return
      }
      const kind = classifyLink(url)
      if (kind !== "web") {
        event.preventDefault()
        if (kind === "external") void this.openExternal(url)
        return
      }
      // The bundled workspace stays pinned; external pages open in a web tab.
      if (tab.kind === "native") {
        event.preventDefault()
        this.openLink(url, true)
      }
    })

    wc.on("context-menu", (_e, params) => this.contextMenu(wc, params))
  }

  private favicons = new Map<string, string>()

  /**
   * Fetches a favicon in the tab session and hands the chrome a data: URL, so
   * the chrome page itself never loads anything from the web (its CSP allows
   * only 'self' and data: images).
   */
  private async loadFavicon(tab: Tab, url: string) {
    const MAX = 200_000
    let data: string | null = url.startsWith("data:image/") ? (url.length < MAX ? url : null) : (this.favicons.get(url) ?? null)
    if (!data && !url.startsWith("data:")) {
      try {
        const res = await this.host.session.fetch(url, { signal: AbortSignal.timeout(5000) })
        const type = (res.headers.get("content-type") ?? "").split(";")[0].trim()
        const buf = Buffer.from(await res.arrayBuffer())
        if (res.ok && type.startsWith("image/") && buf.length < MAX) {
          data = `data:${type};base64,${buf.toString("base64")}`
          this.favicons.set(url, data)
        }
      } catch {
        // No favicon: the chrome shows a globe.
      }
    }
    if (tab.favicon === data) return
    tab.favicon = data
    this.host.changed()
  }

  /** A link from a page: web links open in a new tab next to the current one. */
  openLink(url: string, activate: boolean) {
    const kind = classifyLink(url)
    if (kind === "web") this.add({ kind: "web", url }, { activate, afterActive: true })
    else if (kind === "external") void this.openExternal(url)
  }

  private async openExternal(url: string) {
    if (await confirmExternal(this.host.window, url)) await shell.openExternal(url)
  }

  private contextMenu(wc: WebContents, p: Electron.ContextMenuParams) {
    const items: Electron.MenuItemConstructorOptions[] = []
    if (p.linkURL && classifyLink(p.linkURL) === "web") {
      items.push(
        { label: "Open Link in New Tab", click: () => this.openLink(p.linkURL, false) },
        { label: "Copy Link Address", click: () => clipboard.writeText(p.linkURL) },
        { type: "separator" },
      )
    }
    if (p.mediaType === "image" && p.srcURL && classifyLink(p.srcURL) === "web") {
      items.push(
        { label: "Open Image in New Tab", click: () => this.openLink(p.srcURL, false) },
        { label: "Copy Image", click: () => wc.copyImageAt(p.x, p.y) },
        { type: "separator" },
      )
    }
    if (p.isEditable) {
      items.push({ role: "cut", enabled: p.editFlags.canCut }, { role: "copy", enabled: p.editFlags.canCopy }, { role: "paste", enabled: p.editFlags.canPaste }, { role: "selectAll" })
    } else if (p.selectionText) {
      items.push({ role: "copy" })
    } else {
      items.push(
        { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
        { label: "Forward", enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
        { label: "Reload", click: () => wc.reload() },
      )
    }
    items.push({ type: "separator" }, { label: "Inspect Element", click: () => wc.inspectElement(p.x, p.y) })
    Menu.buildFromTemplate(items).popup({ window: this.host.window })
  }
}
