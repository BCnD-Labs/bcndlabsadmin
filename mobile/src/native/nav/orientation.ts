import { DESTINATIONS, type Destination, type GroupName } from "./destinations.ts"

/** Which arrangement the shell and screens use. Pure so node tests can load it. */
export type LayoutMode = "portrait" | "landscape"

/** Width of the left sidebar that replaces the bottom nav in landscape. */
export const SIDEBAR_WIDTH = 176

/** Landscape is simply "wider than tall"; a tablet held upright stays portrait. */
export const layoutMode = (width: number, height: number): LayoutMode => (width > height ? "landscape" : "portrait")

/** The width the page itself gets once the sidebar takes its share. */
export const pageWidth = (width: number, mode: LayoutMode) => (mode === "landscape" ? Math.max(0, width - SIDEBAR_WIDTH) : width)

const GROUPS: readonly GroupName[] = ["Daily", "Build", "Homelab"]

/** Every destination, once: the four main screens on top, then the launcher's three groups. The bottom nav shows a few and tucks the rest under More; the sidebar has room for all. */
export const sidebarSections = (): { group: string | null; items: Destination[] }[] => [
  { group: null, items: DESTINATIONS.filter((d) => d.primary) },
  ...GROUPS.map((group) => ({ group, items: DESTINATIONS.filter((d) => !d.primary && d.group === group) })),
].filter((s) => s.items.length)
