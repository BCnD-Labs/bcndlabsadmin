/**
 * Address-bar and navigation rules. Pure functions (no Electron imports) so
 * they run under `node --test` too.
 */

const SEARCH = "https://duckduckgo.com/?q="

/** Schemes a tab may load itself. */
export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Schemes that must never be handed to the OS or loaded in a tab, even when a
 * page links to them. Everything else that isn't http(s) (mailto:, obsidian:,
 * zoommtg: …) can open in its own app after the user confirms.
 */
const BLOCKED_SCHEMES = new Set([
  "javascript:", "data:", "file:", "blob:", "filesystem:", "about:", "chrome:", "chrome-extension:",
  "chrome-error:", "devtools:", "view-source:", "bw-shell:", "ws:", "wss:", "ftp:",
])

export type LinkKind = "web" | "external" | "blocked"

export function classifyLink(value: string): LinkKind {
  let protocol: string
  try {
    protocol = new URL(value).protocol
  } catch {
    return "blocked"
  }
  if (protocol === "http:" || protocol === "https:") return "web"
  if (BLOCKED_SCHEMES.has(protocol)) return "blocked"
  // Custom app schemes are letters, digits, + - . (RFC 3986).
  return /^[a-z][a-z0-9+.-]*:$/i.test(protocol) ? "external" : "blocked"
}

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/
const HOST_PORT_PATH = /^([^\s/?#:]+)(:\d{1,5})?([/?#][^\s]*)?$/

function looksLikeHost(host: string, hasPort: boolean): "https" | "http" | null {
  const lower = host.toLowerCase()
  if (lower === "localhost" || lower.endsWith(".localhost")) return "http"
  if (IPV4.test(lower)) return lower.split(".").every((n) => Number(n) <= 255) ? "http" : null
  const labels = lower.split(".")
  if (labels.length >= 2 && labels.every((l) => /^[a-z0-9-]+$/.test(l) && l.length > 0)) {
    // The last label must look like a TLD (letters, 2+), so "1.5" or "v2.3" stay searches.
    return /^[a-z]{2,}$/.test(labels[labels.length - 1]) ? "https" : null
  }
  // A single word with a port ("mikoshi:8780") is a host on the local network.
  if (hasPort && /^[a-z0-9-]+$/.test(lower)) return "http"
  return null
}

/**
 * Turns what was typed in the address bar into a URL to load: a web URL as
 * typed, a bare host ("example.com/x", "localhost:5173") with a scheme added,
 * or otherwise a DuckDuckGo search. Never returns a non-http(s) URL.
 */
export function addressToUrl(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).href
    } catch {
      return SEARCH + encodeURIComponent(text)
    }
  }
  const m = HOST_PORT_PATH.exec(text)
  if (m) {
    const scheme = looksLikeHost(m[1], Boolean(m[2]))
    if (scheme) {
      try {
        return new URL(`${scheme}://${text}`).href
      } catch {
        // fall through to search
      }
    }
  }
  return SEARCH + encodeURIComponent(text)
}

/** Validates the pinned tab's address: http(s) with a host, no credentials. */
export function normalizeWebAddress(input: string): string | null {
  let text = input.trim()
  if (!text) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`
  try {
    const url = new URL(text)
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) return null
    if (url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}
