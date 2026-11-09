import { FORMATS, outputSize, type FormatKey, type Rect } from "@shared/assets"

/**
 * Picture work in the browser: decode, turn, crop, resize and encode with a canvas. Nothing leaves the machine until you
 * save, and re-encoding drops the camera's hidden data (location, device) along the way.
 */

export interface Source { bitmap: ImageBitmap; width: number; height: number; bytes: number; mime: string; name: string }

/** Reads a picture file; the camera's rotation flag is applied here, so what you see is the right way up. */
export async function loadSource(blob: Blob, name: string): Promise<Source> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("That file isn't a picture this browser can open. Use a PNG, JPG, WebP, GIF or AVIF.")
  })
  return { bitmap, width: bitmap.width, height: bitmap.height, bytes: blob.size, mime: blob.type, name }
}

export interface Edit {
  /** In the picture's own pixels after turning/flipping. */
  crop: Rect
  /** Quarter turns clockwise: 0, 1, 2 or 3. */
  turns: 0 | 1 | 2 | 3
  flipX: boolean
  format: FormatKey
  /** 0.3 to 1 for the lossy formats. */
  quality: number
  /** Output size in pixels (the crop is scaled to it). */
  width: number
  height: number
}

/** The picture with its turns and flip applied, as the crop box sees it. */
export function orient(source: Source, turns: number, flipX: boolean): HTMLCanvasElement {
  const swap = turns % 2 === 1
  const c = document.createElement("canvas")
  c.width = swap ? source.height : source.width
  c.height = swap ? source.width : source.height
  const g = c.getContext("2d")!
  g.translate(c.width / 2, c.height / 2)
  g.rotate((turns * Math.PI) / 2)
  if (flipX) g.scale(-1, 1)
  g.drawImage(source.bitmap, -source.width / 2, -source.height / 2)
  return c
}

/** Draws the crop at the output size. Big shrinks are done in halves, which keeps small text and edges clean. */
function draw(oriented: CanvasImageSource & { width: number; height: number }, e: Edit, fill?: string): HTMLCanvasElement {
  let w = e.crop.width, h = e.crop.height
  let from: CanvasImageSource = oriented
  let sx = e.crop.x, sy = e.crop.y
  while (w / 2 >= e.width && h / 2 >= e.height) {
    const half = document.createElement("canvas")
    half.width = Math.max(1, Math.round(w / 2)); half.height = Math.max(1, Math.round(h / 2))
    const g = half.getContext("2d")!
    g.imageSmoothingQuality = "high"
    g.drawImage(from, sx, sy, w, h, 0, 0, half.width, half.height)
    from = half; sx = 0; sy = 0; w = half.width; h = half.height
  }
  const out = document.createElement("canvas")
  out.width = e.width; out.height = e.height
  const g = out.getContext("2d")!
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, out.width, out.height) }
  g.imageSmoothingQuality = "high"
  g.drawImage(from, sx, sy, w, h, 0, 0, out.width, out.height)
  return out
}

const toBlob = (c: HTMLCanvasElement, mime: string, quality?: number) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("This browser couldn't make that file type."))), mime, quality))

/** One encode of the edit. JPEG has no see-through, so those areas become white. */
export async function encode(oriented: HTMLCanvasElement, e: Edit): Promise<Blob> {
  const f = FORMATS[e.format]
  return toBlob(draw(oriented, e, e.format === "jpeg" ? "#ffffff" : undefined), f.mime, f.lossy ? e.quality : undefined)
}

/** Finds the highest quality that keeps the file under `maxBytes`. `reached` is false when even the lowest quality is too big. */
export async function encodeUnder(oriented: HTMLCanvasElement, e: Edit, maxBytes: number): Promise<{ blob: Blob; quality: number; reached: boolean }> {
  if (!FORMATS[e.format].lossy) { const blob = await encode(oriented, e); return { blob, quality: 1, reached: blob.size <= maxBytes } }
  let lo = 0.3, hi = e.quality
  let best = await encode(oriented, { ...e, quality: hi })
  if (best.size <= maxBytes) return { blob: best, quality: hi, reached: true }
  const floor = await encode(oriented, { ...e, quality: lo })
  if (floor.size > maxBytes) return { blob: floor, quality: lo, reached: false }
  best = floor
  let bestQ = lo
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2
    const b = await encode(oriented, { ...e, quality: mid })
    if (b.size <= maxBytes) { best = b; bestQ = mid; lo = mid } else hi = mid
  }
  return { blob: best, quality: bestQ, reached: true }
}

/** Which of the formats this browser can really make (WebP is checked, since some can't). */
export function canMake(format: FormatKey): boolean {
  if (format !== "webp") return true
  const c = document.createElement("canvas")
  c.width = c.height = 1
  return c.toDataURL("image/webp").startsWith("data:image/webp")
}

/** Longest-edge presets for "Size". */
export const SIZE_PRESETS = [{ label: "Original", edge: 0 }, { label: "2400", edge: 2400 }, { label: "1600", edge: 1600 }, { label: "1200", edge: 1200 }, { label: "800", edge: 800 }, { label: "400", edge: 400 }] as const

/** A starting edit: the whole picture, at most 1600 px on its long side, as WebP when the browser can. */
export function startingEdit(source: Source): Edit {
  const size = outputSize({ width: source.width, height: source.height }, { longest: Math.min(1600, Math.max(source.width, source.height)) })
  const format: FormatKey = source.mime === "image/png" && source.bytes < 400_000 ? "png" : canMake("webp") ? "webp" : "jpeg"
  return { crop: { x: 0, y: 0, width: source.width, height: source.height }, turns: 0, flipX: false, format, quality: 0.82, ...size }
}
