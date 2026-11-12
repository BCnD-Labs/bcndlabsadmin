/**
 * The asset library's rules, with no DOM: where an asset lives on the site, how crops and sizes are worked out,
 * what a processed file is called, and which pages and posts use which pictures. The browser-side image
 * work (decode, crop, encode) is in src/lib/image-tools.ts and uses these.
 */
import type { Asset, Draft, SiteBlock, SitePage } from "../src/lib/types.ts"

/** Where library pictures sit in a site's files: `images/<file>`. */
export const SITE_IMAGES_DIR = "images"

export const FORMATS = {
  webp: { mime: "image/webp", ext: "webp", label: "WebP", about: "Smallest for most pictures", lossy: true },
  jpeg: { mime: "image/jpeg", ext: "jpg", label: "JPEG", about: "Photos, works everywhere", lossy: true },
  png: { mime: "image/png", ext: "png", label: "PNG", about: "Sharp edges and see-through areas", lossy: false },
} as const
export type FormatKey = keyof typeof FORMATS
export const formatOf = (mime: string): FormatKey | undefined => (Object.keys(FORMATS) as FormatKey[]).find((k) => FORMATS[k].mime === mime || (k === "jpeg" && mime === "image/jpg"))

export const assetPath = (a: Pick<Asset, "file">) => `/${SITE_IMAGES_DIR}/${a.file}`
export const assetCloudPath = (a: Pick<Asset, "folder" | "file">) => `${a.folder.replace(/\/+$/, "")}/${a.file}`
export const findAsset = (assets: readonly Asset[], sitePath: string | undefined) => (sitePath ? assets.find((a) => assetPath(a) === sitePath) : undefined)

export interface Rect { x: number; y: number; width: number; height: number }

/** Shrinks (never enlarges) a size so it fits inside a box, keeping its shape. */
export function fitInside(width: number, height: number, maxWidth: number, maxHeight = maxWidth): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Keeps a crop rectangle inside the picture and at least `min` pixels on each side. */
export function clampRect(r: Rect, imageWidth: number, imageHeight: number, min = 16): Rect {
  const width = Math.min(imageWidth, Math.max(min, Math.round(r.width)))
  const height = Math.min(imageHeight, Math.max(min, Math.round(r.height)))
  return { width, height, x: Math.min(imageWidth - width, Math.max(0, Math.round(r.x))), y: Math.min(imageHeight - height, Math.max(0, Math.round(r.y))) }
}

/** The largest rectangle of a given shape (width ÷ height) that fits the picture, centered on `around` (a point in the picture) when given. */
export function aspectCrop(imageWidth: number, imageHeight: number, aspect: number, around?: { x: number; y: number }): Rect {
  let width = imageWidth, height = Math.round(imageWidth / aspect)
  if (height > imageHeight) { height = imageHeight; width = Math.round(imageHeight * aspect) }
  const cx = around?.x ?? imageWidth / 2, cy = around?.y ?? imageHeight / 2
  return clampRect({ x: cx - width / 2, y: cy - height / 2, width, height }, imageWidth, imageHeight, 1)
}

/** Output size for a crop: set one side (or a longest edge) and the other follows; or both, when the shape is allowed to change. */
export function outputSize(crop: { width: number; height: number }, want: { width?: number; height?: number; longest?: number }, allowEnlarge = false): { width: number; height: number } {
  const ratio = crop.width / crop.height
  let width = crop.width, height = crop.height
  if (want.longest) {
    const scale = want.longest / Math.max(crop.width, crop.height)
    width = crop.width * scale; height = crop.height * scale
  } else if (want.width && want.height) { width = want.width; height = want.height }
  else if (want.width) { width = want.width; height = want.width / ratio }
  else if (want.height) { height = want.height; width = want.height * ratio }
  if (!allowEnlarge && !(want.width && want.height)) {
    const s = Math.min(1, crop.width / width, crop.height / height)
    width *= s; height *= s
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
}

/** A safe, readable file name for the library and the site: lowercase words and dashes, never one that's already taken. */
export function libraryFileName(name: string, ext: string, taken: ReadonlySet<string>): string {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "picture"
  let file = `${base}.${ext}`, n = 2
  while (taken.has(file.toLowerCase())) file = `${base}-${n++}.${ext}`
  return file
}

export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** "97% smaller" / "12% bigger" against the original, or nothing when it is about the same. */
export function sizeChange(original: number, now: number): string {
  if (!original || !now) return ""
  const pct = Math.round((1 - now / original) * 100)
  return Math.abs(pct) < 3 ? "about the same size" : pct > 0 ? `${pct}% smaller` : `${-pct}% bigger`
}

/* ---------------------------------------------------------- who uses what */

const MD_IMAGE = /!\[[^\]]*\]\(\s*(\/images\/[^)\s]+)/g

/** Site paths of the pictures a page's image blocks point at. */
export function imagePathsIn(blocks: readonly SiteBlock[], out: string[] = []): string[] {
  for (const b of blocks) {
    if (b.type === "image" && typeof b.src === "string" && b.src.trim()) out.push(b.src.trim())
    if (b.kids) imagePathsIn(b.kids, out)
  }
  return out
}

/** Site paths of the pictures in a post: its cover and every Markdown image. */
export function imagePathsInPost(post: Pick<Draft, "cover" | "body">): string[] {
  return [...(post.cover ? [post.cover] : []), ...[...post.body.matchAll(MD_IMAGE)].map((m) => m[1])]
}

/** Where a library picture is used: pages (image blocks) and posts (cover or in the text). */
export function assetUsage(asset: Pick<Asset, "file">, pages: readonly SitePage[], drafts: readonly Draft[]): { pages: SitePage[]; posts: Draft[] } {
  const path = assetPath(asset)
  return {
    pages: pages.filter((p) => imagePathsIn(p.sections).includes(path)),
    posts: drafts.filter((d) => d.kind === "post" && imagePathsInPost(d).includes(path)),
  }
}

/** The library pictures a built site needs copied next to it: those on its pages and in its published posts. */
export function usedAssets(assets: readonly Asset[], siteId: string, pages: readonly SitePage[], drafts: readonly Draft[]): Asset[] {
  const paths = new Set<string>()
  for (const p of pages) if (p.siteId === siteId) imagePathsIn(p.sections).forEach((x) => paths.add(x))
  for (const d of drafts) if (d.siteId === siteId && d.publishedAt) imagePathsInPost(d).forEach((x) => paths.add(x))
  return assets.filter((a) => paths.has(assetPath(a)))
}

/* ---------------------------------------------------------------- cropping */

export type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

/**
 * Moves or resizes a crop rectangle by a drag of (dx, dy) picture pixels. It stays inside the picture and at least `min` big;
 * with `aspect` (width ÷ height) its shape is kept: a corner or side moves while the opposite one stays put.
 */
export function dragRect(r: Rect, handle: Handle, dx: number, dy: number, bounds: { width: number; height: number }, aspect: number | null = null, min = 16): Rect {
  if (handle === "move") return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, bounds.width, bounds.height, 1)
  let left = r.x, top = r.y, right = r.x + r.width, bottom = r.y + r.height
  if (handle.includes("w")) left += dx
  if (handle.includes("e")) right += dx
  if (handle.includes("n")) top += dy
  if (handle.includes("s")) bottom += dy
  left = Math.max(0, left); top = Math.max(0, top); right = Math.min(bounds.width, right); bottom = Math.min(bounds.height, bottom)
  if (right - left < min) { if (handle.includes("w")) left = right - min; else right = left + min }
  if (bottom - top < min) { if (handle.includes("n")) top = bottom - min; else bottom = top + min }
  let width = right - left, height = bottom - top
  if (!aspect) return clampRect({ x: left, y: top, width, height }, bounds.width, bounds.height, 1)
  const sideways = handle === "e" || handle === "w", upright = handle === "n" || handle === "s"
  if (upright) width = height * aspect
  else if (sideways) height = width / aspect
  else if (width / aspect > height) height = width / aspect
  else width = height * aspect
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2
  const fixedRight = handle.includes("w"), fixedLeft = handle.includes("e"), fixedBottom = handle.includes("n"), fixedTop = handle.includes("s")
  const maxW = fixedRight ? r.x + r.width : fixedLeft ? bounds.width - r.x : 2 * Math.min(cx, bounds.width - cx)
  const maxH = fixedBottom ? r.y + r.height : fixedTop ? bounds.height - r.y : 2 * Math.min(cy, bounds.height - cy)
  const k = Math.min(1, maxW / width, maxH / height)
  width = Math.max(1, Math.round(width * k)); height = Math.max(1, Math.round(height * k))
  const x = fixedRight ? r.x + r.width - width : fixedLeft ? r.x : cx - width / 2
  const y = fixedBottom ? r.y + r.height - height : fixedTop ? r.y : cy - height / 2
  return clampRect({ x, y, width, height }, bounds.width, bounds.height, 1)
}

/* ------------------------------------------------------------ organising */

export type AssetSort = "newest" | "oldest" | "name" | "largest" | "unused"
export const ASSET_SORTS: { value: AssetSort; label: string }[] = [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "name", label: "Name A to Z" }, { value: "largest", label: "Largest files first" }, { value: "unused", label: "Unused first" }]
/** The collection filter value for pictures that are in none. */
export const UNSORTED = "-"
export interface AssetView { q: string; /** "" is every picture, UNSORTED those in no collection, anything else a collection name. */ collection: string; tag: string; use: "any" | "used" | "unused"; sort: AssetSort }
export const DEFAULT_VIEW: AssetView = { q: "", collection: "", tag: "", use: "any", sort: "newest" }
export const isFiltered = (v: AssetView) => !!(v.q || v.collection || v.tag || v.use !== "any")

/** A collection name as it is stored: trimmed, single spaces, at most 40 letters. Empty means none. */
export const cleanCollection = (v: string) => v.trim().replace(/\s+/g, " ").slice(0, 40)

export function collectionsOf(assets: readonly Asset[]): { name: string; count: number }[] {
  const n = new Map<string, number>()
  for (const a of assets) if (a.collection) n.set(a.collection, (n.get(a.collection) ?? 0) + 1)
  return [...n].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
}

export function tagsOf(assets: readonly Asset[]): { tag: string; count: number }[] {
  const n = new Map<string, number>()
  for (const a of assets) for (const t of a.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
  return [...n].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** The pictures to show for a search, a collection, a tag, a used/unused choice and a sort order. `uses` says how many places a picture is used. */
export function viewAssets(assets: readonly Asset[], uses: (a: Asset) => number, v: AssetView): Asset[] {
  const q = v.q.trim().toLowerCase()
  const shown = assets.filter((a) => {
    if (q && !`${a.name} ${a.file} ${a.alt} ${a.collection ?? ""} ${(a.tags ?? []).join(" ")}`.toLowerCase().includes(q)) return false
    if (v.collection === UNSORTED ? !!a.collection : v.collection && a.collection !== v.collection) return false
    if (v.tag && !(a.tags ?? []).includes(v.tag)) return false
    if (v.use !== "any" && (uses(a) > 0) !== (v.use === "used")) return false
    return true
  })
  const newest = (a: Asset, b: Asset) => b.createdAt.localeCompare(a.createdAt)
  const by: Record<AssetSort, (a: Asset, b: Asset) => number> = {
    newest, oldest: (a, b) => -newest(a, b), name: (a, b) => a.name.localeCompare(b.name), largest: (a, b) => b.bytes - a.bytes || newest(a, b),
    unused: (a, b) => uses(a) - uses(b) || newest(a, b),
  }
  return [...shown].sort(by[v.sort])
}
