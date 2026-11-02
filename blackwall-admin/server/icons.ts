import type { ConnectionStore } from "./store.ts"

/**
 * Service logos for the Mikoshi launcher, from dashboard-icons (homarr-labs, Apache-2.0),
 * the set Homarr and Homepage use. Fetched once, then served from the store so tiles
 * keep their logos when the CDN (or the internet) isn't reachable.
 */
export const ICON_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const SOURCE = (slug: string) => `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`
const MAX_BYTES = 256 * 1024

/** The tiles show logos through <img>, where scripts never run; this strips them anyway. */
export function cleanSvg(svg: string): string | undefined {
  const start = svg.indexOf("<svg")
  if (start < 0 || svg.length > MAX_BYTES) return undefined
  return svg
    .slice(start)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "")
}

export type IconResult = { svg: string } | { error: string; status: number }

export async function serviceIcon(store: ConnectionStore, slug: string, fetchImpl: typeof fetch = fetch): Promise<IconResult> {
  if (!ICON_SLUG.test(slug)) return { error: "Not a valid icon name", status: 400 }
  const cached = await store.getIcon(slug)
  if (cached) return { svg: cached }
  let res: Response
  try {
    res = await fetchImpl(SOURCE(slug), { signal: AbortSignal.timeout(8000) })
  } catch {
    return { error: "Couldn't reach dashboard-icons", status: 502 }
  }
  if (res.status === 404) return { error: `No logo named "${slug}" in dashboard-icons`, status: 404 }
  if (!res.ok) return { error: `dashboard-icons answered ${res.status}`, status: 502 }
  const svg = cleanSvg(await res.text())
  if (!svg) return { error: "That file isn't a usable SVG logo", status: 502 }
  await store.putIcon(slug, svg)
  return { svg }
}
