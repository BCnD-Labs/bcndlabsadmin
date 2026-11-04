import { STARTERS } from "../../../../blackwall-admin/shared/site-starters.ts"
import { defaultMakeId, type Collections } from "../../lib/shared.ts"

type Site = Collections["sites"][number]
export type SiteFields = Pick<Site, "name" | "domain" | "footerText" | "darkMode">

/** Save core site identity without touching its publishing connection or pages. */
export function saveSiteRecord(data: Collections, previousId: string | undefined, fields: SiteFields, starter: string, options: { siteId?: string; pageId?: string; now?: string } = {}): Collections {
  if (previousId && !data.sites.some(site => site.id === previousId)) throw new Error("This site no longer exists.")
  const now = options.now ?? new Date().toISOString()
  const values = { ...fields, name: fields.name.trim(), domain: fields.domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""), footerText: fields.footerText.trim() }
  if (previousId) return { ...data, sites: data.sites.map(site => site.id === previousId ? { ...site, ...values, updatedAt: now } : site) }
  const palette = STARTERS[starter] ?? STARTERS.midnight
  const siteId = options.siteId ?? defaultMakeId("sit")
  const site: Site = { ...values, id: siteId, root: "", starter: starter in STARTERS ? starter : "midnight", light: { ...palette.light }, dark: { ...palette.dark }, customCss: "", redirects: [], createdAt: now, updatedAt: now }
  const home: Collections["pages"][number] = { id: options.pageId ?? defaultMakeId("pag"), siteId, title: "Home", slug: "", description: "", inMenu: true, order: 0, sections: [], createdAt: now, updatedAt: now }
  return { ...data, sites: [site, ...data.sites], pages: [home, ...data.pages] }
}
