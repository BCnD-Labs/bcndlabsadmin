import { FlipHorizontal2, Loader2, RotateCcw, RotateCw } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { toast } from "sonner"
import { FORMATS, aspectCrop, dragRect, humanBytes, outputSize, sizeChange, type FormatKey, type Handle, type Rect } from "@shared/assets"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Asset } from "@/lib/types"
import { SIZE_PRESETS, canMake, encode, encodeUnder, loadSource, orient, startingEdit, type Edit, type Source } from "@/lib/image-tools"
import { cn } from "@/lib/utils"
import { replaceAsset, saveNewAsset } from "./use-assets"

export interface EditorItem {
  blob: Blob
  name: string
  source: string
  /** Set when editing a picture that is already in the library. */
  asset?: Asset
}

const ASPECTS: { key: string; label: string; ratio: number | "orig" | null }[] = [
  { key: "free", label: "Free", ratio: null }, { key: "orig", label: "Original", ratio: "orig" }, { key: "1:1", label: "1:1", ratio: 1 }, { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "3:2", label: "3:2", ratio: 3 / 2 }, { key: "16:9", label: "16:9", ratio: 16 / 9 }, { key: "4:5", label: "4:5", ratio: 4 / 5 }, { key: "3:1", label: "3:1", ratio: 3 },
]
const HANDLES: { h: Handle; cls: string }[] = [
  { h: "nw", cls: "left-0 top-0 cursor-nwse-resize" }, { h: "n", cls: "left-1/2 top-0 cursor-ns-resize" }, { h: "ne", cls: "left-full top-0 cursor-nesw-resize" },
  { h: "w", cls: "left-0 top-1/2 cursor-ew-resize" }, { h: "e", cls: "left-full top-1/2 cursor-ew-resize" },
  { h: "sw", cls: "left-0 top-full cursor-nesw-resize" }, { h: "s", cls: "left-1/2 top-full cursor-ns-resize" }, { h: "se", cls: "left-full top-full cursor-nwse-resize" },
]

/** The crop box on top of the picture. Everything it reports is in the picture's own pixels. */
function CropBox({ canvas, crop, aspect, onChange }: { canvas: HTMLCanvasElement; crop: Rect; aspect: number | null; onChange: (r: Rect) => void }) {
  const shown = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 480, h: 320 })
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect } | null>(null)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = () => {
      const maxW = Math.max(120, (el.clientWidth || 480) - 24), maxH = 340
      const s = Math.min(maxW / canvas.width, maxH / canvas.height, 1)
      setBox({ w: Math.max(40, Math.round(canvas.width * s)), h: Math.max(40, Math.round(canvas.height * s)) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [canvas])
  useEffect(() => {
    const c = shown.current
    if (!c) return
    c.width = box.w; c.height = box.h
    const g = c.getContext("2d")!
    g.imageSmoothingQuality = "high"
    g.drawImage(canvas, 0, 0, box.w, box.h)
  }, [canvas, box])
  const k = box.w / canvas.width
  const down = (handle: Handle) => (e: PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (d) onChange(dragRect(d.start, d.handle, (e.clientX - d.x) / k, (e.clientY - d.y) / k, { width: canvas.width, height: canvas.height }, aspect))
  }
  const up = () => { drag.current = null }
  return (
    <div ref={frame} className="flex justify-center rounded-[8px] bg-[repeating-conic-gradient(#0003_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-3">
      <div className="relative touch-none select-none" style={{ width: box.w, height: box.h }}>
        <canvas ref={shown} style={{ width: box.w, height: box.h }} className="block" aria-label="Picture being edited" />
        <div className="absolute cursor-move overflow-visible outline outline-1 outline-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" data-testid="crop-box" onPointerDown={down("move")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ left: crop.x * k, top: crop.y * k, width: crop.width * k, height: crop.height * k, clipPath: "none" }}>
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-60" aria-hidden>{Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/30" />)}</div>
          {HANDLES.filter((h) => !aspect || h.h.length === 2).map(({ h, cls }) => (
            <span key={h} role="slider" aria-label={`Crop ${h}`} aria-valuenow={0} onPointerDown={down(h)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              className={cn("absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-black/60 bg-white", cls)} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Crop, resize, turn, change the type and quality of one picture, see what the saved file will be, and put it in the library. */
export function AssetEditor({ item, onClose, onSaved }: { item: EditorItem; onClose: () => void; onSaved: (a: Asset) => void }) {
  const [source, setSource] = useState<Source | null>(null)
  const [error, setError] = useState("")
  const [edit, setEdit] = useState<Edit | null>(null)
  const [aspect, setAspect] = useState("free")
  const [edge, setEdge] = useState(1600)
  const [width, setWidth] = useState("")
  const [name, setName] = useState(item.asset?.name ?? item.name.replace(/\.[^.]+$/, ""))
  const [alt, setAlt] = useState(item.asset?.alt ?? "")
  const [tags, setTags] = useState((item.asset?.tags ?? []).join(", "))
  const [capKb, setCapKb] = useState("")
  const [result, setResult] = useState<{ blob: Blob; url: string; quality: number; reached: boolean } | null>(null)
  const [replace, setReplace] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    let live = true
    loadSource(item.blob, item.name).then((s) => {
      if (!live) return
      setSource(s)
      const first = startingEdit(s)
      setEdit(first)
      setEdge(item.asset ? 0 : Math.max(first.width, first.height))
    }).catch((e: Error) => live && setError(e.message))
    return () => { live = false }
  }, [item])

  const oriented = useMemo(() => (source && edit ? orient(source, edit.turns, edit.flipX) : null), [source, edit?.turns, edit?.flipX]) // eslint-disable-line react-hooks/exhaustive-deps
  const ratio = useMemo(() => {
    const a = ASPECTS.find((x) => x.key === aspect)
    return a?.ratio === "orig" && oriented ? oriented.width / oriented.height : typeof a?.ratio === "number" ? a.ratio : null
  }, [aspect, oriented])
  /** Size of the saved picture: a typed width, else the chosen long edge (0 keeps the crop's own size). */
  const out = useMemo(() => {
    if (!edit) return { width: 1, height: 1 }
    const w = Math.round(Number(width))
    return outputSize(edit.crop, w > 0 ? { width: w } : edge > 0 ? { longest: edge } : {}, w > 0)
  }, [edit, width, edge])
  const final = edit ? { ...edit, ...out } : null
  const cap = Math.round(Number(capKb)) > 0 ? Math.round(Number(capKb)) * 1024 : 0

  // Make the real file in the background, so the size shown is the size you get.
  const finalKey = final ? JSON.stringify([final.crop, final.turns, final.flipX, final.format, final.quality, final.width, final.height, cap]) : ""
  useEffect(() => {
    if (!final || !oriented) return
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const made = cap ? await encodeUnder(oriented, final, cap) : { blob: await encode(oriented, final), quality: final.quality, reached: true }
        if (mine !== seq.current) return
        setResult((old) => { if (old) URL.revokeObjectURL(old.url); return { blob: made.blob, url: URL.createObjectURL(made.blob), quality: made.quality, reached: made.reached } })
      } catch (e) { if (mine === seq.current) setError((e as Error).message) }
    }, 220)
    return () => clearTimeout(t)
    // finalKey captures every input of the encode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalKey, oriented])
  useEffect(() => () => { seq.current++ }, [])

  if (error && !source) return <div className="grid gap-3 p-5"><DialogTitle>Can't open that picture</DialogTitle><DialogDescription>{error}</DialogDescription><Button variant="outline" onClick={onClose} className="justify-self-end">Close</Button></div>
  if (!source || !edit || !oriented || !final) return <div className="grid place-items-center gap-2 p-12 text-sm text-muted-foreground"><DialogTitle className="sr-only">Opening picture</DialogTitle><Loader2 className="animate-spin" /> Opening the picture…</div>

  const patch = (p: Partial<Edit>) => setEdit({ ...edit, ...p })
  const pickAspect = (key: string) => {
    setAspect(key)
    const a = ASPECTS.find((x) => x.key === key)!
    const r = a.ratio === "orig" ? oriented.width / oriented.height : a.ratio
    if (r) patch({ crop: aspectCrop(oriented.width, oriented.height, r, { x: edit.crop.x + edit.crop.width / 2, y: edit.crop.y + edit.crop.height / 2 }) })
  }
  /** Turning or flipping changes what the crop box is measured against, so it starts again as the whole picture. */
  const reorient = (p: Partial<Edit>) => {
    const turns = p.turns ?? edit.turns
    const swap = turns % 2 === 1
    setAspect("free")
    setEdit({ ...edit, ...p, crop: { x: 0, y: 0, width: swap ? source.height : source.width, height: swap ? source.width : source.height } })
  }
  const sameType = !!item.asset && FORMATS[edit.format].mime === item.asset.mime
  const canReplace = sameType
  const saving = progress !== null
  const save = async () => {
    if (!result) return
    setProgress(0)
    try {
      const pic = { blob: result.blob, name: name.trim() || "Picture", alt: alt.trim(), tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12), width: final.width, height: final.height, source: item.source, original: item.asset ? undefined : { bytes: source.bytes, width: source.width, height: source.height } }
      const saved = item.asset && replace && canReplace ? await replaceAsset(item.asset, pic, setProgress) : await saveNewAsset(pic, setProgress)
      toast.success(item.asset && replace && canReplace ? "Picture replaced everywhere it's used" : "Added to the library", { description: `${saved.file} · ${humanBytes(saved.bytes)}` })
      onSaved(saved)
    } catch (e) {
      toast.error((e as Error).message)
      setProgress(null)
    }
  }
  const chip = (on: boolean) => cn("h-7 rounded-[6px] px-2.5 text-xs font-medium", on ? "bg-selected text-ink ring-1 ring-[var(--bw-red)]" : "bg-raised text-muted-foreground hover:text-ink")
  const lossy = FORMATS[edit.format].lossy
  const smaller = sizeChange(source.bytes, result?.blob.size ?? 0)

  return (
    <div className="flex max-h-[88dvh] flex-col">
      <div className="border-b border-line py-3 pr-12 pl-4">
        <DialogTitle className="font-heading text-base font-bold">{item.asset ? "Edit picture" : "Prepare picture"}</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">Crop, shrink and choose the file type. Only the result is saved to your library; the original stays where it is.</DialogDescription>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(15rem,1fr)]">
        <div className="grid min-w-0 content-start gap-2.5">
          <CropBox canvas={oriented} crop={edit.crop} aspect={ratio} onChange={(crop) => patch({ crop })} />
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Crop shape">
            {ASPECTS.map((a) => <button key={a.key} type="button" role="radio" aria-checked={aspect === a.key} className={chip(aspect === a.key)} onClick={() => pickAspect(a.key)}>{a.label}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" aria-label="Turn left" onClick={() => reorient({ turns: ((edit.turns + 3) % 4) as Edit["turns"] })}><RotateCcw /> Left</Button>
            <Button type="button" size="sm" variant="outline" aria-label="Turn right" onClick={() => reorient({ turns: ((edit.turns + 1) % 4) as Edit["turns"] })}><RotateCw /> Right</Button>
            <Button type="button" size="sm" variant="outline" aria-label="Flip" onClick={() => reorient({ flipX: !edit.flipX })}><FlipHorizontal2 /> Flip</Button>
            <Button type="button" size="sm" variant="quiet" className="ml-auto" onClick={() => { setEdit(startingEdit(source)); setAspect("free"); setEdge(1600); setWidth("") }}>Start over</Button>
          </div>
          <p className="text-[11px] text-faint">Original: {source.width} × {source.height} · {humanBytes(source.bytes)} · {source.mime.replace("image/", "").toUpperCase()}. Crop: {Math.round(edit.crop.width)} × {Math.round(edit.crop.height)}.</p>
        </div>
        <div className="grid min-w-0 content-start gap-3.5">
          <div className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink">Size</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Longest side">
              {SIZE_PRESETS.map((s) => <button key={s.label} type="button" role="radio" aria-checked={!width && edge === s.edge} className={chip(!width && edge === s.edge)} onClick={() => { setEdge(s.edge); setWidth("") }}>{s.label}</button>)}
            </div>
            <div className="flex items-center gap-2"><Label htmlFor="asset-width" className="shrink-0 text-xs font-normal text-muted-foreground">or width</Label><Input id="asset-width" inputMode="numeric" className="h-8 w-24" placeholder={String(out.width)} value={width} onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))} /><span className="text-xs text-muted-foreground">px → {out.width} × {out.height}</span></div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink">File type</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="File type">
              {(Object.keys(FORMATS) as FormatKey[]).filter(canMake).map((k) => <button key={k} type="button" role="radio" aria-checked={edit.format === k} title={FORMATS[k].about} className={chip(edit.format === k)} onClick={() => patch({ format: k })}>{FORMATS[k].label}</button>)}
            </div>
            <span className="text-[11px] text-faint">{FORMATS[edit.format].about}.</span>
            {lossy && (
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2"><Label htmlFor="asset-quality" className="shrink-0 text-xs font-normal text-muted-foreground">Quality</Label><input id="asset-quality" type="range" min={30} max={100} step={1} value={Math.round(edit.quality * 100)} disabled={!!cap} onChange={(e) => patch({ quality: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-[var(--bw-red)]" aria-valuetext={`${Math.round((cap && result ? result.quality : edit.quality) * 100)} percent`} /><output className="w-9 text-right font-mono text-xs text-ink-2 tabular-nums">{Math.round((cap && result ? result.quality : edit.quality) * 100)}</output></div>
                <div className="flex items-center gap-2"><Label htmlFor="asset-cap" className="shrink-0 text-xs font-normal text-muted-foreground">Keep under</Label><Input id="asset-cap" inputMode="numeric" className="h-8 w-20" placeholder="no limit" value={capKb} onChange={(e) => setCapKb(e.target.value.replace(/\D/g, ""))} /><span className="text-xs text-muted-foreground">KB</span></div>
              </div>
            )}
          </div>
          <div className="grid gap-2 border-t border-line-soft pt-3">
            <div className="grid gap-1"><Label htmlFor="asset-name" className="text-xs font-normal text-muted-foreground">Name</Label><Input id="asset-name" className="h-8" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-1"><Label htmlFor="asset-alt" className="text-xs font-normal text-muted-foreground">What it shows (alt text)</Label><Input id="asset-alt" className="h-8" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Two people at a whiteboard" /></div>
            <div className="grid gap-1"><Label htmlFor="asset-tags" className="text-xs font-normal text-muted-foreground">Tags (commas)</Label><Input id="asset-tags" className="h-8" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="team, hero" /></div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-raised/40 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {result ? <img src={result.url} alt="The picture as it will be saved" className="h-12 max-w-24 rounded-[6px] bg-white object-contain" /> : <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <p className="min-w-0 text-xs leading-snug text-ink-2" data-testid="asset-summary" aria-live="polite">
            <b className="text-ink">{final.width} × {final.height} px · {FORMATS[edit.format].label} · {result ? humanBytes(result.blob.size) : "…"}</b><br />
            <span className="text-muted-foreground">{result && smaller ? `${smaller} than the original` : "Working out the size…"}{cap && result && !result.reached ? ` · can't get under ${capKb} KB; try a smaller size` : ""}</span>
          </p>
        </div>
        {item.asset && (
          <label className={cn("flex items-center gap-1.5 text-xs", !canReplace && "opacity-50")} title={canReplace ? undefined : "Only possible when the file type stays the same"}>
            <input type="checkbox" checked={replace && canReplace} disabled={!canReplace} onChange={(e) => setReplace(e.target.checked)} /> Replace it everywhere it's used
          </label>
        )}
        <Button variant="quiet" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={!result || saving || !name.trim()}>{saving ? <><Loader2 className="animate-spin" /> Saving {Math.round((progress ?? 0) * 100)}%</> : item.asset && replace && canReplace ? "Replace picture" : "Save to library"}</Button>
      </div>
    </div>
  )
}
