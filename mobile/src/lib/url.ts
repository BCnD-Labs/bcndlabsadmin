/**
 * Address validation and link rules for the Blackwall shell. Pure functions with no
 * React Native imports, so they run under `node --test` and behave the same on Hermes.
 * Deliberately doesn't use `URL`: React Native's URL support has historically been
 * incomplete, and the rules here need to be exact on both runtimes.
 */

export type AddressResult = { ok: true; url: string; origin: string } | { ok: false; error: string }

/** Hostname labels: ASCII letters, digits and inner hyphens; 1–63 chars each, 253 total. */
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const IPV6 = /^\[[0-9a-f:.]+\]$/
const SCHEME = /^([a-z][a-z0-9+.-]*):/i
const CONTROL_OR_SPACE = /[\s\u0000-\u001f\u007f-\u009f]/

function validHost(host: string): boolean {
  if (!host || host.length > 253) return false
  if (IPV4.test(host)) return true
  if (IPV6.test(host)) return host.includes(":")
  return host.split(".").every((l) => LABEL.test(l)) && !/^\d+$/.test(host.split(".").pop() ?? "")
}

type Authority = { host: string; port: string }

/** `host[:port]` → lowercased host and non-default port, or null if malformed. */
function parseAuthority(authority: string, defaultPort: string): Authority | null {
  if (authority.includes("@")) return null // userinfo: never accepted
  const m = /^(\[[^\]]*\]|[^:]*)(?::(\d{1,5}))?$/.exec(authority)
  if (!m) return null
  const host = m[1].toLowerCase().replace(/\.$/, "")
  const port = m[2] ?? ""
  if (!validHost(host)) return null
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null
  return { host, port: port === defaultPort ? "" : String(Number(port) || "") }
}

/** Origin (`scheme://host[:port]`) of an http(s) URL, or null for anything else or anything malformed. */
export function originOf(url: string): string | null {
  if (CONTROL_OR_SPACE.test(url)) return null
  const m = /^(https?):\/\/([^/?#\\]*)([/?#].*)?$/i.exec(url)
  if (!m) return null
  const scheme = m[1].toLowerCase()
  const auth = parseAuthority(m[2], scheme === "https" ? "443" : "80")
  if (!auth) return null
  return `${scheme}://${auth.host}${auth.port ? `:${auth.port}` : ""}`
}

/**
 * Validates and normalizes what you type on the setup screen into the start URL.
 * https only; a bare host gets `https://`; any path, query or fragment is dropped
 * (Blackwall is served from the root); credentials, other schemes and malformed
 * hosts are refused.
 */
export function normalizeAddress(input: string): AddressResult {
  const raw = input.trim()
  if (!raw) return { ok: false, error: "Enter your Blackwall address." }
  if (raw.length > 2048) return { ok: false, error: "That address is too long." }
  if (CONTROL_OR_SPACE.test(raw)) return { ok: false, error: "An address can't contain spaces." }
  // "host:8443" looks like a scheme to the regex; treat host:port as a bare host.
  const bareHostPort = /^[^/:?#@]+:\d{1,5}([/?#].*)?$/.test(raw)
  const scheme = bareHostPort ? null : SCHEME.exec(raw)?.[1].toLowerCase()
  if (scheme === "http") return { ok: false, error: "Use an https:// address. The app only connects over a secure connection." }
  if (scheme && scheme !== "https") return { ok: false, error: "Only https:// web addresses are allowed." }
  const candidate = scheme ? raw : `https://${raw}`
  if (!/^https:\/\//i.test(candidate)) return { ok: false, error: "That doesn't look like a web address." }
  const authority = /^https:\/\/([^/?#\\]*)/i.exec(candidate)?.[1] ?? ""
  if (authority.includes("@")) return { ok: false, error: "Leave out any username or password. You sign in on the page itself." }
  if (/[^\x21-\x7e]/.test(authority)) return { ok: false, error: "Use the plain ASCII form of the address." }
  const origin = originOf(candidate)
  if (!origin) return { ok: false, error: "That doesn't look like a web address." }
  return { ok: true, url: `${origin}/`, origin }
}

/**
 * What to do with a navigation (link, redirect, form, window.open) requested by the page.
 *  - `load`: same origin as your Blackwall → load it in the app
 *  - `browser`: another http(s) site → open in the default browser
 *  - `app`: mailto:, tel:, obsidian:// and similar → ask, then hand to the other app
 *  - `block`: everything that could reach local files, run script or launch arbitrary
 *    Android components (javascript:, file:, data:, blob:, content:, intent:, …) and anything malformed
 */
export type LinkAction = "load" | "browser" | "app" | "block"

const BLOCKED_SCHEMES = new Set([
  "javascript", "vbscript", "file", "data", "blob", "content", "intent", "android-app",
  "about", "chrome", "chrome-extension", "filesystem", "view-source", "jar", "ws", "wss", "ftp",
])

export function classifyLink(url: string, allowedOrigin: string): LinkAction {
  const u = url.trim()
  if (!u || u.length > 8192 || CONTROL_OR_SPACE.test(u)) return "block"
  if (u === "about:blank" || u === "about:srcdoc") return "load"
  const scheme = SCHEME.exec(u)?.[1].toLowerCase()
  if (!scheme) return "block"
  if (scheme === "http" || scheme === "https") {
    const origin = originOf(u)
    if (!origin) return "block"
    return origin === allowedOrigin ? "load" : "browser"
  }
  if (BLOCKED_SCHEMES.has(scheme)) return "block"
  return "app"
}
