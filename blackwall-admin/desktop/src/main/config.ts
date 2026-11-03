import fs from "node:fs"
import path from "node:path"
import { isWebUrl, normalizeWebAddress } from "./url.ts"

/**
 * The desktop shell's own settings, in <userData>/desktop-config.json.
 * Holds no credentials: sign-in lives in the tab session's cookie store.
 */
export interface SavedTab {
  url: string
  title: string
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface DesktopConfig {
  version: 1
  /** The hosted Blackwall the pinned tab shows. Set from Blackwall → Web address… */
  webAddress: string | null
  /** Last page of the pinned tab (same origin as webAddress), restored on launch. */
  pinnedUrl: string | null
  window: WindowState
  tabs: SavedTab[]
  /** 0 = pinned tab, 1… = tabs[i - 1]. */
  activeIndex: number
}

export const DEFAULT_WINDOW: WindowState = { width: 1280, height: 820, maximized: false }

function defaults(): DesktopConfig {
  return { version: 1, webAddress: null, pinnedUrl: null, window: { ...DEFAULT_WINDOW }, tabs: [], activeIndex: 0 }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined)

/** Accepts anything (a hand-edited or corrupt file) and keeps only valid fields. */
export function sanitizeConfig(raw: unknown): DesktopConfig {
  const out = defaults()
  if (!raw || typeof raw !== "object") return out
  const r = raw as Record<string, unknown>
  if (typeof r.webAddress === "string") out.webAddress = normalizeWebAddress(r.webAddress)
  if (typeof r.pinnedUrl === "string" && isWebUrl(r.pinnedUrl)) out.pinnedUrl = r.pinnedUrl
  if (r.window && typeof r.window === "object") {
    const w = r.window as Record<string, unknown>
    const width = num(w.width)
    const height = num(w.height)
    out.window = {
      x: num(w.x),
      y: num(w.y),
      width: width && width >= 200 ? width : DEFAULT_WINDOW.width,
      height: height && height >= 200 ? height : DEFAULT_WINDOW.height,
      maximized: w.maximized === true,
    }
  }
  if (Array.isArray(r.tabs)) {
    out.tabs = r.tabs
      .filter((t): t is SavedTab => !!t && typeof t === "object" && typeof t.url === "string" && isWebUrl(t.url))
      .slice(0, 50)
      .map((t) => ({ url: t.url, title: typeof t.title === "string" ? t.title.slice(0, 300) : "" }))
  }
  const active = num(r.activeIndex)
  out.activeIndex = active !== undefined && active >= 0 && active <= out.tabs.length ? active : 0
  return out
}

export class ConfigStore {
  private data: DesktopConfig
  private timer: NodeJS.Timeout | null = null
  private readonly file: string

  constructor(dir: string) {
    this.file = path.join(dir, "desktop-config.json")
    let raw: unknown = null
    try {
      raw = JSON.parse(fs.readFileSync(this.file, "utf8"))
    } catch {
      // Missing or unreadable: start from defaults (first run).
    }
    this.data = sanitizeConfig(raw)
  }

  get(): Readonly<DesktopConfig> {
    return this.data
  }

  /** Updates in memory now and writes to disk shortly after (coalesced). */
  update(patch: Partial<DesktopConfig>) {
    this.data = { ...this.data, ...patch }
    this.timer ??= setTimeout(() => this.flush(), 400)
  }

  /** Writes immediately (atomic: temp file + rename). Safe to call on quit. */
  flush() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (e) {
      console.error("[desktop] could not save config:", e)
    }
  }
}
