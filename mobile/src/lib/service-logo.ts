import { ICON_SLUG } from "./shared.ts"

/**
 * Mikoshi tile logos, as the web launcher shows them: an uploaded logo saved on the tile (a small image data URL),
 * else a dashboard-icons logo by name from your server's copy (`GET /api/icons/<slug>` → `{svg}`), else nothing
 * (the row keeps its letter badge). Pure apart from the injected fetch.
 */
export type LogoSource = { kind: "svg"; xml: string } | { kind: "image"; uri: string }

const MAX_SVG = 256 * 1024

/** An uploaded logo from the tile record: raster data URLs are shown as images, SVG data URLs are decoded to markup. */
export function customLogoSource(value: string | undefined): LogoSource | null {
  if (!value) return null
  const raster = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.exec(value)
  if (raster) return { kind: "image", uri: value }
  const svg = /^data:image\/svg\+xml(;charset=[\w-]+)?(;base64)?,(.*)$/s.exec(value)
  if (!svg) return null
  let xml: string
  try {
    xml = svg[2] ? atob(svg[3]) : decodeURIComponent(svg[3])
  } catch {
    return null
  }
  return usableSvg(xml) ? { kind: "svg", xml } : null
}

export const usableSvg = (xml: string) => xml.length <= MAX_SVG && xml.includes("<svg")

export const iconUrl = (address: string, slug: string) => `${address.replace(/\/+$/, "")}/api/icons/${encodeURIComponent(slug)}`

/** One request per logo name per app session; a failure is remembered as "no logo" until the next session or retry. */
const cache = new Map<string, Promise<string | null>>()

export function loadIcon(address: string, slug: string | undefined, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!slug || !ICON_SLUG.test(slug)) return Promise.resolve(null)
  const key = `${address}|${slug}`
  let p = cache.get(key)
  if (!p) {
    p = fetchImpl(iconUrl(address, slug), { credentials: "include", headers: { Accept: "application/json", "X-Blackwall": "1" } })
      .then(async (res) => {
        if (!res.ok) return null
        const body = (await res.json()) as { svg?: unknown }
        return typeof body.svg === "string" && usableSvg(body.svg) ? body.svg : null
      })
      .catch(() => null)
    cache.set(key, p)
  }
  return p
}

/** For tests and pull-to-refresh: forget what was loaded so logos are asked for again. */
export const clearIconCache = () => cache.clear()
