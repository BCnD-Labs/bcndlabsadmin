/** The classic sidebar's sub-pages, one section per window in the desktop view. */
export interface SectionDestination { id: string; label: string; match: string; children?: { label: string; to: string }[] }

/**
 * The section whose sub-pages all live in this window (Mikoshi: Launcher, Status, Storage; Websites: All sites, Pages, Posts…),
 * with the sub-page that `path` is on. Sections that spread over several windows (Productivity) have their own window and rail
 * button for each page, so they get no tabs.
 */
export function windowSections<W extends string>(nav: readonly SectionDestination[], windowFor: (path: string) => W, windowId: W, path: string) {
  const [pathname, query = ""] = path.split("?")
  const section = nav.find((d) => d.children?.length && (d.match === "/" ? pathname === "/" : pathname.startsWith(d.match)) && d.children.every((c) => windowFor(c.to) === windowId))
  if (!section?.children) return null
  const full = query ? `${pathname}?${query}` : pathname
  const current = section.children.find((c) => c.to === full)
    ?? section.children.filter((c) => !c.to.includes("?") && (pathname === c.to || pathname.startsWith(c.to + "/"))).sort((a, b) => b.to.length - a.to.length)[0]
  return { label: section.label, children: section.children, current }
}
