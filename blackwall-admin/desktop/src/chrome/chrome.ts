/**
 * The chrome UI: tab strip, toolbar, find bar and page-area panels.
 * Talks to the main process only through `window.shell` (see preload).
 * Page titles and URLs are untrusted, so they're only ever set as text.
 */
import type { FindResult, ShellBridge, ShellState, TabState } from "../shared/ipc.ts"

declare global {
  interface Window {
    shell: ShellBridge
  }
}

const shell = window.shell
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

const tabsEl = $("tabs")
const address = $<HTMLInputElement>("address")
const security = $("security")
const back = $<HTMLButtonElement>("back")
const forward = $<HTMLButtonElement>("forward")
const findBar = $("find")
const findInput = $<HTMLInputElement>("find-input")
const findCount = $("find-count")
const panels = { address: $("panel-address"), error: $("panel-error"), blank: $("panel-new") }
const webAddress = $<HTMLInputElement>("web-address")
const webAddressError = $("web-address-error")

let state: ShellState | null = null
let shownActiveId = -1
let shownAddressKey = ""

const GLOBE = `<svg class="globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`
const WARN = `<svg class="warn" viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>`
const CLOSE = `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>`

function active(): TabState | undefined {
  return state?.tabs.find((t) => t.id === state?.activeId)
}

// ---------- Tabs ----------

const tabEls = new Map<number, HTMLElement>()

function tabElement(tab: TabState): HTMLElement {
  let el = tabEls.get(tab.id)
  if (el) return el
  el = document.createElement("div")
  el.className = "tab"
  el.setAttribute("role", "tab")
  el.tabIndex = -1
  el.dataset.id = String(tab.id)
  const icon = document.createElement("span")
  icon.className = "favicon"
  const title = document.createElement("span")
  title.className = "title"
  el.append(icon, title)
  if (!tab.pinned) {
    const close = document.createElement("span")
    close.className = "close"
    close.setAttribute("role", "button")
    close.setAttribute("aria-label", "Close tab")
    close.title = "Close tab (⌘W)"
    close.innerHTML = CLOSE
    close.addEventListener("click", (e) => {
      e.stopPropagation()
      shell.send({ type: "close-tab", id: tab.id })
    })
    el.append(close)
  }
  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) shell.send({ type: "activate", id: tab.id })
  })
  el.addEventListener("auxclick", (e) => {
    if (e.button === 1 && !tab.pinned) shell.send({ type: "close-tab", id: tab.id })
  })
  tabEls.set(tab.id, el)
  return el
}

function renderIcon(el: HTMLElement, tab: TabState) {
  const icon = el.querySelector<HTMLElement>(".favicon")!
  const key = tab.loading ? "loading" : tab.error ? "error" : tab.pinned ? "pinned" : tab.favicon ?? "none"
  if (icon.dataset.key === key) return
  icon.dataset.key = key
  icon.replaceChildren()
  if (tab.loading) {
    const s = document.createElement("span")
    s.className = "spinner"
    icon.append(s)
  } else if (tab.error) {
    icon.innerHTML = WARN
  } else if (tab.pinned || tab.favicon) {
    const img = document.createElement("img")
    img.alt = ""
    img.src = tab.pinned ? "bw-icon.png" : tab.favicon!
    img.addEventListener("error", () => {
      icon.innerHTML = GLOBE
    })
    icon.append(img)
  } else {
    icon.innerHTML = GLOBE
  }
}

function renderTabs(s: ShellState) {
  const seen = new Set<number>()
  const els = s.tabs.map((tab) => {
    seen.add(tab.id)
    const el = tabElement(tab)
    el.classList.toggle("active", tab.id === s.activeId)
    el.classList.toggle("pinned", tab.pinned)
    el.setAttribute("aria-selected", String(tab.id === s.activeId))
    const label = tab.pinned ? "Blackwall" : tab.title || hostOf(tab.url) || "New tab"
    const title = el.querySelector<HTMLElement>(".title")!
    if (title.textContent !== label) title.textContent = label
    el.title = tab.pinned ? `Blackwall — ${tab.title || tab.url || "not set up"}` : tab.title || tab.url
    renderIcon(el, tab)
    return el
  })
  for (const [id, el] of tabEls) {
    if (!seen.has(id)) {
      el.remove()
      tabEls.delete(id)
    }
  }
  // Re-append only when the order changed, so hover state isn't lost on every update.
  const current = [...tabsEl.children]
  if (current.length !== els.length || els.some((el, i) => current[i] !== el)) tabsEl.replaceChildren(...els)
}

function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

// ---------- Toolbar ----------

function renderToolbar(s: ShellState) {
  const tab = active()
  document.body.classList.toggle("loading", !!tab?.loading)
  document.body.classList.toggle("fullscreen", s.fullscreen)
  document.body.dataset.chrome = s.chromeMode
  document.body.classList.toggle("solo", s.solo)
  back.disabled = !tab?.canGoBack
  forward.disabled = !tab?.canGoForward
  const url = tab?.url ?? ""
  const native = url.startsWith("bw-native://app/")
  security.className = native || url.startsWith("https://") ? "secure" : url.startsWith("http://") ? "insecure" : "none"
  security.title = url.startsWith("http://") ? "Not secure (http)" : ""
  // Don't overwrite what the user is typing, unless they switched tabs.
  if (document.activeElement !== address || s.activeId !== shownActiveId) address.value = native ? `Blackwall  /  ${new URL(url).pathname.slice(1) || "Home"}` : url
  shownActiveId = s.activeId
}

address.addEventListener("focus", () => address.select())
address.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault()
    const text = address.value.trim()
    if (text) {
      shell.send({ type: "navigate", text })
      address.blur()
    }
  } else if (e.key === "Escape") {
    address.value = active()?.url ?? ""
    address.blur()
    shell.send({ type: "focus-page" })
  }
})

$("back").addEventListener("click", () => shell.send({ type: "back" }))
$("forward").addEventListener("click", () => shell.send({ type: "forward" }))
$("reload").addEventListener("click", () => shell.send({ type: active()?.loading ? "stop" : "reload" }))
$("new-tab").addEventListener("click", () => shell.send({ type: "new-tab" }))
// Double-clicking empty tab-strip space opens a tab, like Safari (window zoom stays on the title area).
$("tabstrip").addEventListener("dblclick", (e) => {
  if (e.target === tabsEl) shell.send({ type: "new-tab" })
})

// ---------- Find in page ----------

function openFind() {
  findBar.hidden = false
  findInput.focus()
  findInput.select()
  if (findInput.value) shell.send({ type: "find", text: findInput.value, forward: true, newSearch: true })
}

function closeFind() {
  findBar.hidden = true
  findCount.textContent = ""
  shell.send({ type: "stop-find" })
}

function findNext(forwardDir: boolean) {
  if (findBar.hidden) return openFind()
  if (findInput.value) shell.send({ type: "find", text: findInput.value, forward: forwardDir, newSearch: false })
}

findInput.addEventListener("input", () => {
  shell.send({ type: "find", text: findInput.value, forward: true, newSearch: true })
  if (!findInput.value) findCount.textContent = ""
})
findInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault()
    findNext(!e.shiftKey)
  } else if (e.key === "Escape") {
    e.preventDefault()
    closeFind()
  }
})
$("find-prev").addEventListener("click", () => findNext(false))
$("find-next").addEventListener("click", () => findNext(true))
$("find-close").addEventListener("click", closeFind)

shell.onFind((r: FindResult) => {
  if (!findInput.value) return
  findCount.textContent = r.matches ? `${r.active} of ${r.matches}` : "No results"
  findCount.classList.toggle("none", !r.matches)
})

// ---------- Page-area panels ----------

const ERROR_TEXT: Record<string, string> = {
  "-105": "The server’s name couldn’t be found. Check the address, or that Tailscale (or your network) is connected.",
  "-106": "This Mac appears to be offline.",
  "-102": "The server refused the connection. It may be down or not listening on this port.",
  "-109": "The server can’t be reached. It may be down, or Tailscale may be disconnected.",
  "-118": "The server took too long to respond.",
  "-7": "The server took too long to respond.",
  "-21": "The network changed while loading.",
  "-100": "The server closed the connection.",
  "-101": "The connection was reset.",
}

function renderPanels(s: ShellState) {
  const tab = active()
  const setup = !!tab?.pinned && !s.webAddress
  const overlay = s.overlay?.kind === "web-address"
  const showAddress = overlay || setup
  panels.address.hidden = !showAddress
  panels.error.hidden = showAddress || !tab?.error
  panels.blank.hidden = showAddress || !!tab?.error || !tab || tab.pinned || !!tab.url

  // Reset the form only when it first appears (or switches between first-run and menu).
  const addressKey = overlay ? "menu" : setup ? "first-run" : ""
  if (addressKey && addressKey !== shownAddressKey) {
    const firstRun = addressKey === "first-run"
    $("address-title").textContent = firstRun ? "Welcome — set your Blackwall address" : "Blackwall web address"
    $("web-address-cancel").hidden = firstRun
    webAddress.value = s.webAddress ?? ""
    webAddressError.hidden = true
    requestAnimationFrame(() => {
      webAddress.focus()
      webAddress.select()
    })
  }
  shownAddressKey = addressKey

  if (tab?.error && !showAddress) {
    const e = tab.error
    const cert = e.kind === "load" && e.code <= -200 && e.code > -300
    $("error-title").textContent = e.kind === "crash" ? "This page stopped working" : cert ? "This connection isn’t trusted" : "Can’t reach this page"
    $("error-detail").textContent =
      e.kind === "crash"
        ? "The page’s process ended unexpectedly. Retry to load it again."
        : cert
          ? "The site’s certificate couldn’t be verified, so Blackwall didn’t load it. Certificate errors are never bypassed."
          : (ERROR_TEXT[String(e.code)] ?? "The page failed to load.")
    $("error-url").textContent = e.url
    $("error-code").textContent = e.kind === "crash" ? `Reason: ${e.reason}` : `${e.description} (${e.code})`
    $("error-address").hidden = !tab.pinned
  }
}

$("error-retry").addEventListener("click", () => shell.send({ type: "retry" }))
$("error-address").addEventListener("click", () => shell.send({ type: "open-web-address" }))
$("web-address-cancel").addEventListener("click", () => shell.send({ type: "cancel-overlay" }))
$("address-setup").addEventListener("submit", async (e) => {
  e.preventDefault()
  const result = await shell.setWebAddress(webAddress.value)
  if (!result.ok) {
    webAddressError.textContent = result.error
    webAddressError.hidden = false
  }
})
webAddress.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state?.overlay) shell.send({ type: "cancel-overlay" })
})

// ---------- Wiring ----------

shell.onState((s) => {
  state = s
  renderTabs(s)
  renderToolbar(s)
  renderPanels(s)
})

shell.onUi((cmd) => {
  if (cmd.type === "focus-address") {
    address.focus()
    address.select()
  } else if (cmd.type === "open-find") openFind()
  else if (cmd.type === "find-next") findNext(cmd.forward)
})

shell.send({ type: "ready" })
