import { unzip, zip, type AsyncZippable, type Unzipped } from "fflate"

/**
 * Makes big Word, Excel and PowerPoint files smaller by shrinking their pictures, the way "Compress Pictures"
 * does. An Office file is a zip: the text and layout are tiny, the pictures are almost all of the size. Text,
 * layout and everything else are copied across untouched.
 */
export const OFFICE_FILE = /\.(pptx|docx|xlsx)$/i
/** Only files at least this big are worth offering this for. */
export const MIN_SHRINK_BYTES = 2 * 1024 * 1024
/** Pictures at least this big are looked at; smaller ones aren't worth the effort. */
const MIN_PICTURE_BYTES = 150 * 1024
const PICTURE = /^(ppt|word|xl)\/media\/[^/]+\.(jpe?g|png)$/i

export const isShrinkable = (name: string, size: number) => OFFICE_FILE.test(name) && size >= MIN_SHRINK_BYTES
export const pictureKind = (path: string): "jpeg" | "png" | null => (PICTURE.test(path) ? (/\.png$/i.test(path) ? "png" : "jpeg") : null)

/** The size a picture shrinks to so its longest side is at most `max`. Never makes a picture bigger. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export const formatMB = (bytes: number) => (bytes >= 10 * 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${(bytes / 1048576).toFixed(1)} MB`)
export const savedLabel = (before: number, after: number) => `${formatMB(before)} → ${formatMB(after)}${after < before ? ` (${Math.round((1 - after / before) * 100)}% smaller)` : ""}`

/** Re-encodes one picture smaller, or returns null to leave it alone. */
export type Reencode = (bytes: Uint8Array, kind: "jpeg" | "png", options: { maxEdge: number; quality: number }) => Promise<Uint8Array | null>

export interface ShrinkResult { blob: Blob; before: number; after: number; pictures: number; shrunk: number }

const unzipAsync = (data: Uint8Array) => new Promise<Unzipped>((resolve, reject) => unzip(data, (error, files) => (error ? reject(error) : resolve(files))))
const zipAsync = (files: AsyncZippable) => new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 9 }, (error, data) => (error ? reject(error) : resolve(data))))

/** The browser's own image tools: decode, scale down on a canvas, save again. */
export const canvasReencode: Reencode = async (bytes, kind, { maxEdge, quality }) => {
  const type = kind === "jpeg" ? "image/jpeg" : "image/png"
  let bitmap: ImageBitmap
  try {
    // "none": keep the pixels as stored, which is how Office draws them (it ignores the camera's rotate flag).
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }), { imageOrientation: "none" })
  } catch {
    return null // a picture the browser can't read (some CMYK files) stays as it is
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvas.convertToBlob(kind === "jpeg" ? { type, quality } : { type })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

/**
 * Returns a copy of the file with its larger JPEG and PNG pictures shrunk to at most `maxEdge` pixels on the long side
 * (JPEGs also re-saved at `quality`). A picture only changes if the new one is clearly smaller. If nothing gets smaller,
 * the original bytes come back unchanged.
 */
export async function shrinkOffice(file: Blob, options: { maxEdge?: number; quality?: number; reencode?: Reencode; onProgress?: (done: number, total: number) => void } = {}): Promise<ShrinkResult> {
  const { maxEdge = 1600, quality = 0.8, reencode = canvasReencode, onProgress } = options
  const before = file.size
  const files: Record<string, Uint8Array> = await unzipAsync(new Uint8Array(await file.arrayBuffer()))
  const pictures = Object.keys(files).filter((path) => pictureKind(path) && files[path].length >= MIN_PICTURE_BYTES)
  let shrunk = 0
  for (const [index, path] of pictures.entries()) {
    onProgress?.(index, pictures.length)
    const original = files[path]
    const next = await reencode(original, pictureKind(path)!, { maxEdge, quality })
    if (next && next.length < original.length * 0.95) { files[path] = next; shrunk++ }
  }
  onProgress?.(pictures.length, pictures.length)
  if (!shrunk) return { blob: file, before, after: before, pictures: pictures.length, shrunk: 0 }
  // Pictures are already compressed, so store them as they are; everything else is squeezed as far as it goes.
  const zippable: AsyncZippable = {}
  for (const [path, data] of Object.entries(files)) zippable[path] = [data, { level: pictureKind(path) ? 0 : 9 }]
  const out = await zipAsync(zippable)
  if (out.length >= before) return { blob: file, before, after: before, pictures: pictures.length, shrunk: 0 }
  return { blob: new Blob([out as BlobPart], { type: file.type }), before, after: out.length, pictures: pictures.length, shrunk }
}
