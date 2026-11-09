import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A page of the site as visitors will see it, in a frame. When it is told what to do with clicks, the
 * preview becomes the editor's handle on the page: clicking a block reports its id, clicking a menu
 * link reports where it goes, and the page keeps its scroll position while you type.
 */
export function SitePreview({ html, title, width = "100%", selectedId, onBlock, onLink, className }: {
  html: string; title: string; width?: string; selectedId?: string | null
  onBlock?: (id: string) => void; onLink?: (href: string) => void; className?: string
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const scroll = useRef(0)
  const latest = useRef({ onBlock, onLink, selectedId })
  const mark = () => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll(".bw-sel").forEach((el) => el.classList.remove("bw-sel"))
    const id = latest.current.selectedId
    if (id) doc.querySelector(`[data-bw="${CSS.escape(id)}"]`)?.firstElementChild?.classList.add("bw-sel")
  }
  useEffect(() => {
    latest.current = { onBlock, onLink, selectedId }
    mark()
    const el = selectedId ? frame.current?.contentDocument?.querySelector(`[data-bw="${CSS.escape(selectedId)}"]`)?.firstElementChild : null
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  })

  const attach = () => {
    const win = frame.current?.contentWindow, doc = frame.current?.contentDocument
    if (!win || !doc) return
    win.scrollTo(0, scroll.current)
    win.addEventListener("scroll", () => { scroll.current = win.scrollY })
    mark()
    let hover: Element | null = null
    const blockAt = (target: EventTarget | null) => (target as Element | null)?.closest?.("[data-bw]") ?? null
    doc.addEventListener("mouseover", (e) => {
      hover?.classList.remove("bw-hover")
      hover = latest.current.onBlock ? blockAt(e.target)?.firstElementChild ?? null : null
      hover?.classList.add("bw-hover")
    })
    doc.addEventListener("submit", (e) => e.preventDefault())
    doc.addEventListener("click", (e) => {
      e.preventDefault()
      const block = blockAt(e.target)
      if (block && latest.current.onBlock) return latest.current.onBlock(block.getAttribute("data-bw")!)
      const href = (e.target as Element).closest?.("a")?.getAttribute("href")
      if (href) latest.current.onLink?.(href)
    })
  }

  return <iframe ref={frame} title={title} srcDoc={html} onLoad={attach} sandbox="allow-same-origin" className={cn("h-[min(78vh,900px)] max-w-full rounded-[8px] bg-white", className)} style={{ width }} />
}

/** A whole page shrunk into a card: the page is laid out at `width` and scaled to fit what the card allows. */
export function ScaledFrame({ html, title, width = 1100, aspect = 16 / 10, className }: { html: string; title: string; width?: number; aspect?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.max(0.05, el.clientWidth / width))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={box} className={cn("pointer-events-none relative w-full overflow-hidden bg-white", className)} style={{ aspectRatio: String(aspect) }} aria-hidden>
      <iframe title={title} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} className="absolute top-0 left-0 origin-top-left border-0" style={{ width, height: width / aspect, transform: `scale(${scale})` }} />
    </div>
  )
}
