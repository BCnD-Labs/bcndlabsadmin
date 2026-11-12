/**
 * A small set of built-in icons the Icon block uses, and that buttons and badges can show alongside their text.
 *
 * Each icon is one inline SVG string with a 24×24 viewBox, 2-pixel stroke, `currentColor` so it inherits the surrounding
 * text colour. The set stays short on purpose — it covers the ones every site reaches for (links, mail, calendar, a few
 * socials) without becoming a graphic-design kit.
 *
 * The strokes are from Lucide (MIT, see THIRD_PARTY_NOTICES). Nothing loads from the network; the whole pack is bytes
 * in this file and ships only where the renderer actually uses them.
 */

export type IconName = keyof typeof ICONS
export interface IconInfo { name: string; svg: string }

const svg = (d: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

export const ICONS: Record<string, IconInfo> = {
  github: { name: "GitHub", svg: svg(`<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>`) },
  twitter: { name: "X / Twitter", svg: svg(`<path d="M18 2h3l-7.5 8.6L22 22h-6.8l-5.3-6.9L3.8 22H.8l8-9.1L0 2h7l4.8 6.3L18 2z"/>`) },
  youtube: { name: "YouTube", svg: svg(`<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4a2.8 2.8 0 0 0-2 2A29.9 29.9 0 0 0 1 12a29.9 29.9 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.4a2.8 2.8 0 0 0 2-2A29.9 29.9 0 0 0 23 12a29.9 29.9 0 0 0-.5-5.6z"/><polygon points="10 15 15 12 10 9 10 15"/>`) },
  instagram: { name: "Instagram", svg: svg(`<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.4a4 4 0 1 1-7.9 1.1 4 4 0 0 1 7.9-1.1z"/><line x1="17.5" x2="17.5" y1="6.5" y2="6.5"/>`) },
  linkedin: { name: "LinkedIn", svg: svg(`<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>`) },
  bluesky: { name: "Bluesky", svg: svg(`<path d="M5.4 3.4C8.3 5.6 11.3 10 12 12.4c.8-2.4 3.8-6.8 6.6-9 2-1.5 5.4-2.7 5.4 1.2 0 .8-.5 6.6-.7 7.6-.9 3.3-4.2 4.2-7 3.7 5 .8 6.2 3.6 3.5 6.4C14.5 27.8 12 20.3 12 18.3c0 2-2.5 9.5-7.8 4-2.7-2.8-1.5-5.6 3.5-6.4-2.8.5-6.1-.4-7-3.7-.2-1-.7-6.8-.7-7.6C0 .7 3.4 1.9 5.4 3.4z" transform="scale(0.85) translate(0,2)"/>`) },
  mail: { name: "Email", svg: svg(`<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>`) },
  phone: { name: "Phone", svg: svg(`<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/>`) },
  globe: { name: "Website", svg: svg(`<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`) },
  link: { name: "Link", svg: svg(`<path d="M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1-1"/>`) },
  "external-link": { name: "External link", svg: svg(`<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`) },
  download: { name: "Download", svg: svg(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`) },
  calendar: { name: "Calendar", svg: svg(`<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`) },
  "map-pin": { name: "Location", svg: svg(`<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>`) },
  star: { name: "Star", svg: svg(`<polygon points="12 2 15.1 8.6 22 9.6 17 14.5 18.2 21.4 12 18.1 5.8 21.4 7 14.5 2 9.6 8.9 8.6 12 2"/>`) },
  heart: { name: "Heart", svg: svg(`<path d="M19 14c1.5-1.4 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3a5.5 5.5 0 0 0-4.5 2.4A5.5 5.5 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4.1 3 5.5l7 7z"/>`) },
  check: { name: "Check", svg: svg(`<path d="m5 12 5 5L20 7"/>`) },
  home: { name: "Home", svg: svg(`<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`) },
  "arrow-right": { name: "Arrow right", svg: svg(`<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`) },
  "chevron-right": { name: "Chevron right", svg: svg(`<polyline points="9 18 15 12 9 6"/>`) },
  code: { name: "Code", svg: svg(`<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`) },
  search: { name: "Search", svg: svg(`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`) },
  menu: { name: "Menu", svg: svg(`<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>`) },
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** The SVG for a name; a hollow square when the name is unknown, so the block never crashes a build. */
export function iconSvg(name: string): string {
  return (ICONS as Record<string, IconInfo>)[name]?.svg ?? svg(`<rect x="3" y="3" width="18" height="18" rx="2"/>`)
}
