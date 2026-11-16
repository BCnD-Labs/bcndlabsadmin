import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { getThumbnails, loadPresentation, renderSlideToElement, type LoadedPresentation } from "pptx-viewer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { lockLinks } from "./document-kind"
import { fitText } from "./fit-text"

const RAIL_KEY = "blackwall-slides-rail-open"

function readRailOpen(): boolean {
  try { return localStorage.getItem(RAIL_KEY) !== "0" } catch { return true }
}

/** A PowerPoint deck: thumbnails on the left, one slide at a time, arrow keys to move. Read-only. */
export default function SlidesView({ blob, onError }: { blob: Blob; onError: (message: string) => void }) {
  const [deck, setDeck] = useState<LoadedPresentation | null>(null)
  const [index, setIndex] = useState(0)
  const [railOpen, setRailOpen] = useState(readRailOpen)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    let loaded: LoadedPresentation | null = null
    blob.arrayBuffer().then((buffer) => loadPresentation(buffer)).then((p) => {
      loaded = p
      if (alive) setDeck(p)
      else p.cleanup()
    }).catch((e) => alive && onError(`This presentation couldn't be opened (${(e as Error).message}).`))
    return () => { alive = false; loaded?.cleanup() }
  }, [blob, onError])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [deck])

  const toggleRail = () => setRailOpen((open) => {
    try { localStorage.setItem(RAIL_KEY, open ? "0" : "1") } catch { /* The choice just lasts this session. */ }
    return !open
  })

  const count = deck?.slides.length ?? 0
  const size = deck?.slideSize ?? { width: 16, height: 9 }
  const ratio = size.width / size.height
  const width = Math.max(0, Math.floor(Math.min(stage.width, stage.height * ratio)))
  const height = Math.floor(width / ratio)

  useEffect(() => {
    const slide = slideRef.current
    if (!deck || !slide || !width) return
    slide.replaceChildren()
    renderSlideToElement(deck, index, slide, { width, height })
    fitText(slide)
    lockLinks(slide)
  }, [deck, index, width, height])

  useEffect(() => {
    if (!deck || !railOpen || !rail.current) return
    rail.current.replaceChildren(...getThumbnails(deck, 132).map((svg, i) => {
      const button = document.createElement("button")
      button.type = "button"
      button.dataset.slide = String(i)
      button.setAttribute("aria-label", `Slide ${i + 1}`)
      button.className = "block w-full shrink-0 overflow-hidden rounded-[4px] border border-line-soft bg-white p-0"
      button.append(svg)
      return button
    }))
    // Text boxes can only be measured once they are on the page.
    for (const svg of rail.current.querySelectorAll("svg")) fitText(svg as unknown as HTMLElement)
  }, [deck, railOpen])

  useEffect(() => {
    rail.current?.querySelectorAll<HTMLElement>("button[data-slide]").forEach((b) => {
      const on = Number(b.dataset.slide) === index
      b.classList.toggle("ring-2", on)
      b.classList.toggle("ring-[var(--bw-blue)]", on)
      if (on) b.scrollIntoView({ block: "nearest" })
    })
  }, [deck, index, railOpen])

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0)))
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") go(index + 1)
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") go(index - 1)
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(count - 1)
    else return
    e.preventDefault()
  }

  if (!deck) return <p className="p-4 text-sm text-muted-foreground">Reading the presentation…</p>
  return (
    <div className="flex h-full min-h-0 gap-3 outline-none" tabIndex={0} onKeyDown={onKey} data-testid="slides-view" aria-label="Slides">
      {railOpen && <div ref={rail} onClick={(e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-slide]"); if (b) go(Number(b.dataset.slide)) }} className="hidden w-36 shrink-0 flex-col gap-2 overflow-y-auto pr-1 sm:flex" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div ref={stageRef} className="grid min-h-0 flex-1 place-items-center rounded-md bg-well p-2">
          <div ref={slideRef} style={{ width, height }} className={cn("relative overflow-hidden bg-white shadow-md", !width && "hidden")} role="img" aria-label={`Slide ${index + 1} of ${count}`} />
        </div>
        <div className="relative flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Button variant="outline" size="icon-sm" className="absolute left-0 hidden sm:inline-flex" aria-label={railOpen ? "Hide slide previews" : "Show slide previews"} aria-pressed={railOpen} title={railOpen ? "Hide slide previews" : "Show slide previews"} onClick={toggleRail}>
            {railOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft /></Button>
          <span className="min-w-24 text-center tabular-nums">Slide {index + 1} of {count}</span>
          <Button variant="outline" size="icon-sm" aria-label="Next slide" disabled={index >= count - 1} onClick={() => go(index + 1)}><ChevronRight /></Button>
        </div>
      </div>
    </div>
  )
}
