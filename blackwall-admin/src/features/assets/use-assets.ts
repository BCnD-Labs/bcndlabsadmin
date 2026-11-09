import { useEffect, useMemo, useState } from "react"
import { assetCloudPath, assetPath, findAsset, formatOf, libraryFileName, FORMATS } from "@shared/assets"
import type { Asset } from "@/lib/types"
import { ConnectorError } from "@/services/connector"
import { fetchFile, storage, uploadFile, type StorageInfo } from "@/features/mikoshi/storage-api"
import { usePrefs } from "@/stores/prefs"
import { useWorkspace } from "@/stores/workspace"

/* ------------------------------------------------------------ showing assets */

const loading = new Map<string, Promise<string>>()
/** An address the page can show the picture from. The file is fetched once per version and kept for the session. */
export function assetObjectUrl(a: Asset): Promise<string> {
  const key = `${a.id}:${a.updatedAt}:${a.bytes}`
  let p = loading.get(key)
  if (!p) {
    p = fetchFile(assetCloudPath(a)).then((b) => URL.createObjectURL(b))
    p.catch(() => loading.delete(key)) // a failed fetch can be tried again
    loading.set(key, p)
  }
  return p
}

/** Asset id → address, filling in as the files arrive. */
export function useAssetUrls(assets: readonly Asset[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = assets.map((a) => `${a.id}:${a.updatedAt}:${a.bytes}`).join("|")
  useEffect(() => {
    let live = true
    for (const a of assets) void assetObjectUrl(a).then((u) => live && setUrls((x) => (x[`${a.id}:${a.updatedAt}`] === u ? x : { ...x, [`${a.id}:${a.updatedAt}`]: u }))).catch(() => undefined)
    return () => { live = false }
    // `key` stands for the list: the effect runs when an asset appears or its file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return useMemo(() => Object.fromEntries(assets.flatMap((a) => (urls[`${a.id}:${a.updatedAt}`] ? [[a.id, urls[`${a.id}:${a.updatedAt}`]]] : []))), [assets, urls])
}

/** Site path → address for the pictures a preview needs (pass every path a page or post uses). */
export function usePreviewPictures(paths: readonly string[]): Record<string, string> {
  const all = useWorkspace((s) => s.assets)
  const key = [...new Set(paths)].sort().join("|")
  const wanted = useMemo(() => key.split("|").filter(Boolean).flatMap((p) => { const a = findAsset(all, p); return a ? [a] : [] }), [key, all])
  const urls = useAssetUrls(wanted)
  return useMemo(() => Object.fromEntries(wanted.flatMap((a) => (urls[a.id] ? [[assetPath(a), urls[a.id]]] : []))), [wanted, urls])
}

/* ------------------------------------------------------------------ the store */

export function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo | null | "error">(null)
  useEffect(() => {
    let live = true
    storage.info().then((i) => live && setInfo(i)).catch(() => live && setInfo("error"))
    return () => { live = false }
  }, [])
  return info
}

async function ensureFolder(folder: string) {
  let at = ""
  for (const seg of folder.split("/").filter(Boolean)) {
    at += `/${seg}`
    try { await storage.mkdir(at) } catch (e) { if (!(e instanceof ConnectorError && e.status === 409)) throw e }
  }
}

export interface NewPicture {
  blob: Blob
  name: string
  alt: string
  tags: string[]
  width: number
  height: number
  source?: string
  original?: { bytes: number; width: number; height: number }
}

/** Writes a processed picture to the library folder in Nextcloud and records it. */
export async function saveNewAsset(p: NewPicture, onProgress: (f: number) => void = () => undefined): Promise<Asset> {
  const folder = usePrefs.getState().assetsFolder
  const format = formatOf(p.blob.type) ?? "webp"
  await ensureFolder(folder)
  const there = await storage.list(folder).catch(() => ({ entries: [] as { name: string }[] }))
  const taken = new Set([...there.entries.map((e) => e.name.toLowerCase()), ...useWorkspace.getState().assets.filter((a) => a.folder === folder).map((a) => a.file.toLowerCase())])
  const file = libraryFileName(p.name, FORMATS[format].ext, taken)
  await uploadFile(`${folder}/${file}`, new File([p.blob], file, { type: p.blob.type }), onProgress)
  return useWorkspace.getState().create("assets", {
    name: p.name, file, folder, mime: p.blob.type, width: p.width, height: p.height, bytes: p.blob.size, alt: p.alt, tags: p.tags.length ? p.tags : undefined,
    source: p.source, originalBytes: p.original?.bytes, originalWidth: p.original?.width, originalHeight: p.original?.height,
  })
}

/** Replaces the file of an existing picture (same name, same type), so every page that uses it picks up the change. */
export async function replaceAsset(a: Asset, p: NewPicture, onProgress: (f: number) => void = () => undefined): Promise<Asset> {
  await uploadFile(assetCloudPath(a), new File([p.blob], a.file, { type: a.mime }), onProgress)
  useWorkspace.getState().update("assets", a.id, { name: p.name, alt: p.alt, tags: p.tags.length ? p.tags : undefined, width: p.width, height: p.height, bytes: p.blob.size })
  return useWorkspace.getState().assets.find((x) => x.id === a.id)!
}
