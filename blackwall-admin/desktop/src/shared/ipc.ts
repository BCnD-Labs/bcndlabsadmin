/**
 * Messages between the main process and the chrome UI (tab strip + toolbar).
 * Types only: the sandboxed preload can't import local files at runtime, so it
 * repeats the channel names, checked against these types.
 */

/** Tab strip (38px) + toolbar (40px). Web tab views start below this. */
export const CHROME_HEIGHT = 78
/** Just the title/tab strip: what sits above the Blackwall workspace (no address bar). */
export const STRIP_HEIGHT = 38

/**
 * How much of the chrome shows. On the Blackwall workspace the app is the tool, not a browser. With no
 * browser tab open the workspace draws its own title bar ("hidden": no chrome at all). With browser tabs
 * open, a slim tab strip sits above the workspace ("strip"). A browser tab itself gets the tab strip and
 * address bar ("full").
 */
export type ChromeMode = "full" | "strip" | "hidden"
export const CHROME_HEIGHTS: Record<ChromeMode, number> = { full: CHROME_HEIGHT, strip: STRIP_HEIGHT, hidden: 0 }

export type TabError =
  | { kind: "load"; code: number; description: string; url: string }
  | { kind: "crash"; reason: string; url: string }

export interface TabState {
  id: number
  /** The pinned Blackwall tab: always first, can't be closed. */
  pinned: boolean
  title: string
  url: string
  favicon: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error: TabError | null
}

/** A full-page panel the chrome draws in the page area (tab views are hidden meanwhile). */
export type Overlay = null | { kind: "web-address"; firstRun: boolean; current: string | null }

export interface ShellState {
  tabs: TabState[]
  activeId: number
  fullscreen: boolean
  chromeMode: ChromeMode
  /** Only the Blackwall workspace tab exists (no browser tabs open). */
  solo: boolean
  webAddress: string | null
  overlay: Overlay
}

export interface FindResult {
  active: number
  matches: number
}

/** chrome → main, over `shell:cmd`. */
export type ShellCommand =
  | { type: "ready" }
  | { type: "new-tab" }
  | { type: "close-tab"; id: number }
  | { type: "activate"; id: number }
  | { type: "navigate"; text: string }
  | { type: "back" }
  | { type: "forward" }
  | { type: "reload" }
  | { type: "stop" }
  | { type: "retry" }
  | { type: "find"; text: string; forward: boolean; newSearch: boolean }
  | { type: "stop-find" }
  | { type: "cancel-overlay" }
  | { type: "open-web-address" }
  | { type: "focus-page" }

/** main → chrome, over `shell:ui`. */
export type UiCommand = { type: "focus-address" } | { type: "open-find" } | { type: "find-next"; forward: boolean }

export type SetWebAddressResult = { ok: true } | { ok: false; error: string }

/** What the preload exposes to the chrome page as `window.shell`. */
export interface ShellBridge {
  send(command: ShellCommand): void
  setWebAddress(value: string): Promise<SetWebAddressResult>
  onState(listener: (state: ShellState) => void): void
  onUi(listener: (command: UiCommand) => void): void
  onFind(listener: (result: FindResult) => void): void
}

export type Channel = "shell:cmd" | "shell:set-web-address" | "shell:state" | "shell:ui" | "shell:find"
