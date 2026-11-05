import { BrowserWindow, Menu, app, ipcMain, net, protocol, screen, shell, type IpcMainEvent, type IpcMainInvokeEvent, type Session, type WebContents } from "electron"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { FindResult, Overlay, SetWebAddressResult, ShellCommand, ShellState, UiCommand } from "../shared/ipc.ts"
import { ConfigStore, type WindowState } from "./config.ts"
import { buildMenu } from "./menu.ts"
import { NATIVE_HOME, registerNativeWorkspace } from "./native-workspace.ts"
import { MacUpdater } from "./updater.ts"
import { SourceUpdater } from "./source-updater.ts"
import { TabManager } from "./tabs.ts"
import { addressToUrl, normalizeWebAddress, sameOrigin } from "./url.ts"
import { createTabSession, rejectCertificateErrors } from "./web-session.ts"

/**
 * The desktop shell: one window whose own page is the chrome UI (tab strip +
 * toolbar, served from the private bw-shell:// scheme), with one
 * WebContentsView per tab laid over the area below it.
 */

const here = path.dirname(fileURLToPath(import.meta.url)) // out/main
const CHROME_ROOT = path.join(here, "..", "chrome")
const CHROME_URL = "bw-shell://chrome/index.html"
const PRELOAD = path.join(here, "..", "preload", "chrome.cjs")
const DEV_ICON = path.join(here, "..", "icons", "icon-512.png")
const GROUND = "#1f2228" // --bw-ground (Dim)

export interface ShellOptions {
  /** Overrides the userData folder (scripts use a throwaway one). */
  userDataDir?: string
}

export interface ShellController {
  readonly ready: Promise<void>
  window(): BrowserWindow | null
  tabs(): TabManager | null
  config: ConfigStore
  /** Resolves once the chrome UI has rendered its first state. */
  chromeReady(): Promise<void>
}

export function startShell(options: ShellOptions = {}): ShellController | null {
  if (options.userDataDir) app.setPath("userData", options.userDataDir)
  else if (!app.isPackaged) app.setPath("userData", path.join(app.getPath("appData"), "Blackwall Dev"))

  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return null
  }

  protocol.registerSchemesAsPrivileged([
    { scheme: "bw-shell", privileges: { standard: true, secure: true } },
    { scheme: "bw-native", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ])

  const config = new ConfigStore(app.getPath("userData"))
  let win: BrowserWindow | null = null
  let tabs: TabManager | null = null
  let tabSession: Session
  let overlay: Overlay = null
  let closing = false
  let quitting = false
  let statePending = false
  let chromeReadyResolve: () => void = () => {}
  let chromeReady = new Promise<void>((r) => (chromeReadyResolve = r))

  const chrome = () => (win && !win.webContents.isDestroyed() ? win.webContents : null)
  const sendUi = (command: UiCommand) => chrome()?.send("shell:ui", command)

  function state(): ShellState | null {
    if (!win || !tabs) return null
    return {
      tabs: tabs.state(),
      activeId: tabs.activeTabId,
      fullscreen: win.isFullScreen(),
      chromeMode: tabs.chromeMode(),
      solo: tabs.solo,
      webAddress: config.get().webAddress,
      overlay,
    }
  }

  /** Coalesces bursts of tab events into one state message and one save. */
  function changed() {
    if (statePending) return
    statePending = true
    setImmediate(() => {
      statePending = false
      const s = state()
      if (!s || !win) return
      chrome()?.send("shell:state", s)
      const active = s.tabs.find((t) => t.id === s.activeId)
      win.setTitle(active && !active.pinned && active.title ? `${active.title} — Blackwall` : "Blackwall")
      saveTabs()
    })
  }

  function saveTabs() {
    if (!tabs || closing) return
    const list = tabs.list()
    const home = config.get().webAddress
    const pinned = tabs.pinned
    const user = list.filter((t) => t.kind === "web" && t.url)
    const activeIndex = Math.max(0, [pinned, ...user].findIndex((t) => t?.id === tabs?.activeTabId))
    config.update({
      pinnedUrl: pinned && home && pinned.url.startsWith(NATIVE_HOME)
        ? new URL(new URL(pinned.url).pathname + new URL(pinned.url).search + new URL(pinned.url).hash, home).href
        : null,
      tabs: user.map((t) => ({ url: t.url, title: t.title })),
      activeIndex,
    })
  }

  function saveWindow() {
    if (!win || win.isFullScreen() || win.isMinimized()) return
    const b = win.getNormalBounds()
    config.update({ window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() } })
  }

  /** Saved bounds if they're still on a connected display, else centered. */
  function initialBounds(saved: WindowState) {
    const size = { width: Math.max(saved.width, 640), height: Math.max(saved.height, 420) }
    if (saved.x === undefined || saved.y === undefined) return size
    const rect = { x: saved.x, y: saved.y, ...size }
    const area = screen.getDisplayMatching(rect).workArea
    const visible = rect.x < area.x + area.width - 80 && rect.x + rect.width > area.x + 80 && rect.y >= area.y - 10 && rect.y < area.y + area.height - 80
    return visible ? rect : size
  }

  function focusAddress() {
    if (!win) return
    win.webContents.focus()
    sendUi({ type: "focus-address" })
  }

  function newTab() {
    tabs?.add({ kind: "web", url: null }, { activate: true })
    focusAddress()
  }

  function navigate(text: string) {
    if (!tabs) return
    const url = addressToUrl(text)
    const tab = tabs.active
    if (!url || !tab) return
    const home = config.get().webAddress
    if (tab.kind === "native" && home && sameOrigin(url, home)) {
      const target = new URL(url)
      tabs.load(tab.id, NATIVE_HOME + target.pathname.slice(1) + target.search + target.hash)
    } else if (tab.kind === "native") tabs.add({ kind: "web", url }, { afterActive: true })
    else tabs.load(tab.id, url)
    tabs.activeContents?.focus()
  }

  function openWebAddress() {
    overlay = { kind: "web-address", firstRun: false, current: config.get().webAddress }
    tabs?.layout()
    changed()
    win?.webContents.focus()
  }

  function setWebAddress(value: string): SetWebAddressResult {
    const url = normalizeWebAddress(value)
    if (!url) return { ok: false, error: "Enter a web address that starts with https:// (or http://)." }
    config.update({ webAddress: url, pinnedUrl: null })
    config.flush()
    overlay = null
    if (tabs?.pinned) {
      tabs.activate(tabs.pinned.id)
      tabs.load(tabs.pinned.id, NATIVE_HOME)
    }
    changed()
    return { ok: true }
  }

  function handle(cmd: ShellCommand) {
    if (!tabs || !win) return
    const wc = tabs.activeContents
    switch (cmd.type) {
      case "ready":
        changed()
        chromeReadyResolve()
        return
      case "new-tab":
        return newTab()
      case "close-tab":
        if (typeof cmd.id === "number") tabs.close(cmd.id)
        return
      case "activate":
        if (typeof cmd.id === "number") tabs.activate(cmd.id)
        return
      case "navigate":
        if (typeof cmd.text === "string") navigate(cmd.text.slice(0, 8192))
        return
      case "back":
        if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
        return
      case "forward":
        if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
        return
      case "reload":
        return reload(false)
      case "stop":
        wc?.stop()
        return
      case "retry":
        return tabs.retry()
      case "find":
        if (typeof cmd.text !== "string" || !wc) return
        if (!cmd.text) {
          wc.stopFindInPage("clearSelection")
          found({ active: 0, matches: 0 })
        } else wc.findInPage(cmd.text.slice(0, 500), { forward: cmd.forward !== false, findNext: cmd.newSearch === true }) // Electron: findNext=true starts a new search
        return
      case "stop-find":
        wc?.stopFindInPage("clearSelection")
        wc?.focus()
        return
      case "cancel-overlay":
        overlay = null
        tabs.layout()
        changed()
        tabs.activeContents?.focus()
        return
      case "open-web-address":
        return openWebAddress()
      case "focus-page":
        wc?.focus()
        return
    }
  }

  function reload(ignoreCache: boolean) {
    const tab = tabs?.active
    if (!tabs || !tab) return
    if (tab.error) return tabs.retry()
    const wc = tabs.activeContents
    if (ignoreCache) wc?.reloadIgnoringCache()
    else wc?.reload()
  }

  function found(result: FindResult) {
    chrome()?.send("shell:find", result)
  }

  /** Only the chrome page in our window may use the shell's IPC. */
  function fromChrome(e: IpcMainEvent | IpcMainInvokeEvent) {
    return !!win && e.sender === win.webContents && e.senderFrame === e.sender.mainFrame && !!e.senderFrame?.url.startsWith("bw-shell://chrome/")
  }

  /** Cmd+1…9 (no menu item can hold nine accelerators tidily). */
  function attachShortcuts(contents: WebContents) {
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || input.shift || input.alt || input.control) return
      if (!(process.platform === "darwin" ? input.meta : input.control)) return
      if (/^[1-9]$/.test(input.key)) {
        event.preventDefault()
        tabs?.activateIndex(Number(input.key))
      }
    })
  }

  function createWindow() {
    const cfg = config.get()
    closing = false
    win = new BrowserWindow({
      ...initialBounds(cfg.window),
      minWidth: 640,
      minHeight: 420,
      show: false,
      title: "Blackwall",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 12 },
      backgroundColor: GROUND,
      fullscreenable: true,
      webPreferences: {
        preload: PRELOAD,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        spellcheck: false,
        scrollBounce: false,
        devTools: !app.isPackaged,
      },
    })
    const w = win
    if (cfg.window.maximized) w.maximize()
    w.once("ready-to-show", () => w.show())

    // The chrome page never navigates or opens windows.
    w.webContents.on("will-navigate", (e) => e.preventDefault())
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    attachShortcuts(w.webContents)

    tabs = new TabManager({
      window: w,
      session: tabSession,
      webAddress: () => config.get().webAddress,
      overlayOpen: () => overlay !== null,
      changed,
      found,
      attach: attachShortcuts,
    })

    // Restore: pinned Blackwall tab first (last page if still on the same site), then saved tabs.
    const home = cfg.webAddress
    const previous = home && cfg.pinnedUrl && sameOrigin(cfg.pinnedUrl, home) ? new URL(cfg.pinnedUrl) : null
    const pinnedStart = previous ? NATIVE_HOME + previous.pathname.slice(1) + previous.search + previous.hash : NATIVE_HOME
    const pinnedId = tabs.add({ kind: "native", url: pinnedStart }, { activate: true, eager: true })
    const ids = [pinnedId, ...cfg.tabs.map((t) => tabs!.add({ kind: "web", url: t.url, title: t.title }, { activate: false }))]
    tabs.activate(ids[cfg.activeIndex] ?? pinnedId)

    w.on("resize", () => {
      tabs?.layout()
      saveWindow()
    })
    w.on("move", saveWindow)
    w.on("enter-full-screen", () => {
      tabs?.layout()
      changed()
    })
    w.on("leave-full-screen", () => {
      tabs?.layout()
      changed()
    })
    w.on("close", () => {
      saveWindow()
      saveTabs()
      config.flush()
      closing = true
      // Free the tab renderers while the window still exists: closing a view's
      // webContents after its window is destroyed deadlocks Electron's main thread.
      // During quit Electron tears them down itself, so leave them alone then.
      if (!quitting) tabs?.destroyAll()
    })
    w.on("closed", () => {
      tabs = null
      win = null
      chromeReady = new Promise<void>((r) => (chromeReadyResolve = r))
    })

    void w.loadURL(CHROME_URL)
  }

  const ready = app.whenReady().then(() => {
    protocol.handle("bw-shell", (request) => {
      const { host, pathname } = new URL(request.url)
      const file = path.normalize(path.join(CHROME_ROOT, decodeURIComponent(pathname)))
      if (host !== "chrome" || !file.startsWith(CHROME_ROOT + path.sep)) return new Response("Not found", { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    })

    rejectCertificateErrors()
    tabSession = createTabSession()
    const updater = new MacUpdater({
      version: app.getVersion(),
      arch: process.arch,
      pid: process.pid,
      server: () => config.get().webAddress,
      fetch: (url, init) => tabSession.fetch(url, init),
      // …/Blackwall.app/Contents/MacOS/Blackwall → …/Blackwall.app; null when run from source.
      bundlePath: () => {
        const bundle = path.resolve(app.getPath("exe"), "..", "..", "..")
        return app.isPackaged && bundle.endsWith(".app") ? bundle : null
      },
      tempDir: () => app.getPath("temp"),
      launchInstaller: (script, args) => {
        spawn("/bin/sh", [script, ...args], { detached: true, stdio: "ignore" }).unref()
      },
      quit: () => app.quit(),
    })
    // "Update from source": rebuilds the installed app from a local checkout of the repo (no release needed).
    const sourceUpdater = new SourceUpdater({
      repo: () => process.env.BLACKWALL_REPO || path.join(app.getPath("home"), "Developer", "bcndlabsadmin"),
      bundlePath: () => {
        const bundle = path.resolve(app.getPath("exe"), "..", "..", "..")
        return app.isPackaged && bundle.endsWith(".app") ? bundle : null
      },
      pid: process.pid,
      tempDir: () => app.getPath("temp"),
      stateDir: () => app.getPath("userData"),
      launch: (script, args) => {
        spawn("/bin/sh", [script, ...args], { detached: true, stdio: "ignore" }).unref()
      },
      quit: () => app.quit(),
    })
    registerNativeWorkspace(tabSession, () => config.get().webAddress, updater, sourceUpdater)

    app.on("web-contents-created", (_e, contents) => {
      contents.on("will-attach-webview", (e) => e.preventDefault())
    })

    ipcMain.on("shell:cmd", (e, cmd: ShellCommand) => {
      if (fromChrome(e) && cmd && typeof cmd === "object" && typeof cmd.type === "string") handle(cmd)
    })
    ipcMain.handle("shell:set-web-address", (e, value: unknown) => {
      if (!fromChrome(e) || typeof value !== "string") return { ok: false, error: "Not allowed." }
      return setWebAddress(value.slice(0, 2048))
    })

    app.setAboutPanelOptions({
      applicationName: "Blackwall",
      applicationVersion: app.getVersion(),
      credits: "Blackwall for Mac.",
      copyright: "bcndlabs",
    })
    if (!app.isPackaged && process.platform === "darwin") app.dock?.setIcon(DEV_ICON)

    Menu.setApplicationMenu(
      buildMenu({
        newTab: () => (win ? newTab() : createWindow()),
        closeTab: () => {
          const tab = tabs?.active
          if (!tab) return win?.close()
          if (!tabs?.close(tab.id)) shell.beep() // the pinned tab stays
        },
        closeWindow: () => win?.close(),
        focusAddress,
        webAddress: () => (win ? openWebAddress() : (createWindow(), void chromeReady.then(openWebAddress))),
        find: () => {
          win?.webContents.focus()
          sendUi({ type: "open-find" })
        },
        findNext: (forward) => sendUi({ type: "find-next", forward }),
        reload,
        back: () => handle({ type: "back" }),
        forward: () => handle({ type: "forward" }),
        home: () => {
          const pinned = tabs?.pinned
          if (!tabs || !pinned) return
          tabs.activate(pinned.id)
          tabs.load(pinned.id, NATIVE_HOME)
        },
        zoom: (delta) => {
          const wc = tabs?.activeContents
          if (wc) wc.setZoomLevel(delta === 0 ? 0 : Math.max(-5, Math.min(5, wc.getZoomLevel() + delta)))
        },
        devTools: () => tabs?.activeContents?.toggleDevTools(),
        nextTab: () => tabs?.activateRelative(1),
        previousTab: () => tabs?.activateRelative(-1),
      }),
    )

    createWindow()
  })

  app.on("second-instance", () => {
    if (!win) return createWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  // macOS: closing the window keeps the app in the Dock; clicking it reopens with the saved tabs.
  app.on("activate", () => {
    if (!win && app.isReady()) createWindow()
  })
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })

  let flushed = false
  app.on("before-quit", (event) => {
    quitting = true
    saveWindow()
    saveTabs()
    config.flush()
    if (flushed || !tabSession) return
    // Make sure the sign-in cookie is on disk before the process exits.
    event.preventDefault()
    flushed = true
    void tabSession.cookies.flushStore().finally(() => app.quit())
  })

  return {
    ready,
    window: () => win,
    tabs: () => tabs,
    config,
    chromeReady: () => chromeReady,
  }
}
