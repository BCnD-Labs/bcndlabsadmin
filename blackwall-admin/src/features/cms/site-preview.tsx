import { useEffect, useRef, useState } from "react"
import bootstrapCssUrl from "bootstrap/dist/css/bootstrap.min.css?url"
import { previewAssets } from "@shared/site-bootstrap"
import { cn } from "@/lib/utils"

/** A small badge drawn on a block in the page, e.g. the accessibility check's findings. */
export interface CanvasMark { id: string; glyph: string; color: string; text: string }

// Previews of Bootstrap sites use the copy of Bootstrap bundled with the app, so they work offline and need no outside host.
previewAssets.bootstrapCssUrl = new URL(bootstrapCssUrl, document.baseURI).href

export type BlockAction = "up" | "down" | "duplicate" | "remove" | "parent" | "change"

/** What the site editor adds to the preview: inline text editing, the "+" between sections and its keyboard shortcuts. */
export interface CanvasEditing {
  /** The block's name, for the label shown on hover. */
  label: (id: string) => string | undefined
  /** The block's editable text, or undefined when it isn't edited in place. */
  text: (id: string) => { value: string; multiline: boolean; placeholder: string } | undefined
  commit: (id: string, value: string) => void
  insert: (at: number) => void
  deselect: () => void
  /** The toolbar on the selected block. */
  act: (id: string, action: BlockAction) => void
  canGoUp: (id: string) => boolean
  /** Whether the block can be changed to another kind (shows the ⇄ button). */
  canChange: (id: string) => boolean
  /** Which way a block's siblings run: "x" for the blocks of a row (the move buttons say left and right), otherwise "y". */
  axis: (id: string) => "x" | "y"
  key: (e: KeyboardEvent) => void
  activate: () => void
}

interface Inline { id: string; wrapper: Element; target: HTMLElement; saved: string; value: string }

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html")

/** The part of the block a user sees: its element, or the wrapper when the block can draw several. */
const boxOf = (wrapper: Element | null | undefined) => (wrapper instanceof HTMLElement && wrapper.style.display === "block" ? wrapper : wrapper?.firstElementChild ?? null)

/** Brings the live page up to date by replacing only what changed: no reload, no flash, images and scroll stay put. */
function patchChildren(live: Element, before: Element, after: Element, depth: number) {
  if (before.children.length !== after.children.length || live.children.length !== after.children.length) {
    live.innerHTML = after.innerHTML
    return
  }
  ;[...after.children].forEach((next, i) => {
    const old = before.children[i]
    if (old.outerHTML === next.outerHTML) return
    const sameShell = depth > 0 && old.tagName === next.tagName && old.getAttribute("class") === next.getAttribute("class") && old.children.length > 0
    if (sameShell) patchChildren(live.children[i], old, next, depth - 1)
    else live.children[i].replaceWith(live.ownerDocument.importNode(next, true))
  })
}

/**
 * A page of the site as visitors will see it, in a frame. When it is told what to do with clicks, the
 * preview becomes the editor's handle on the page: clicking a block reports its id, clicking a menu
 * link reports where it goes, and the page keeps its scroll position while you type. With `editing`
 * it is the editor's canvas: a second click on a selected heading, text, button or link edits it in place.
 */
export function SitePreview({ html, title, width = "100%", selectedId, onBlock, onLink, editing, marks, className }: {
  html: string; title: string; width?: string; selectedId?: string | null
  onBlock?: (id: string) => void; onLink?: (href: string) => void; editing?: CanvasEditing; marks?: CanvasMark[]; className?: string
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [firstHtml] = useState(html)
  const shown = useRef<Document | null>(null)
  const scroll = useRef(0)
  const inline = useRef<Inline | null>(null)
  const scrolledTo = useRef<string | null | undefined>(undefined)
  const latest = useRef({ onBlock, onLink, selectedId, editing, marks })

  /** The marks sit in the page's own document, beside the block they are about; they never touch the site's markup. */
  const drawMarks = (doc: Document) => {
    doc.querySelectorAll(".bw-a11y").forEach((el) => el.remove())
    const win = doc.defaultView!, seen = new Map<string, number>()
    for (const m of latest.current.marks ?? []) {
      const box = boxOf(doc.querySelector(`[data-bw="${CSS.escape(m.id)}"]`))
      if (!box) continue
      const n = seen.get(m.id) ?? 0
      seen.set(m.id, n + 1)
      const r = box.getBoundingClientRect(), b = doc.createElement("span")
      b.className = "bw-a11y"
      b.textContent = m.glyph
      b.title = m.text
      b.style.cssText = `position:absolute;z-index:9997;left:${Math.max(2, r.left + win.scrollX - 8 + n * 22)}px;top:${Math.max(2, r.top + win.scrollY - 10)}px;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:${m.color};color:#fff;font:700 12px/20px system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 0 0 2px #fff`
      doc.documentElement.append(b)
    }
  }

  const mark = () => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    drawMarks(doc)
    doc.querySelectorAll(".bw-sel").forEach((el) => el.classList.remove("bw-sel"))
    const id = latest.current.selectedId
    const box = id ? boxOf(doc.querySelector(`[data-bw="${CSS.escape(id)}"]`)) : null
    box?.classList.add("bw-sel")
    doc.getElementById("bw-bar")?.remove()
    if (id) doc.getElementById("bw-tag")?.remove()
    const edit = latest.current.editing
    if (!box || !id || !edit || inline.current) return
    // The selected block's own toolbar, drawn in the page right above it.
    const bar = doc.createElement("div")
    bar.id = "bw-bar"
    bar.dataset.for = id
    const name = doc.createElement("span")
    name.textContent = edit.label(id) ?? ""
    bar.append(name)
    const across = edit.axis(id) === "x"
    const tools: [BlockAction, string, string][] = [["up", across ? "←" : "↑", across ? "Move left" : "Move up"], ["down", across ? "→" : "↓", across ? "Move right" : "Move down"], ["duplicate", "⧉", "Duplicate"], ["remove", "✕", "Remove"]]
    if (edit.canGoUp(id)) tools.unshift(["parent", "⤴", "Select what it's inside"])
    if (edit.canChange(id)) tools.unshift(["change", "⇄", "Change to another component…"])
    for (const [act, glyph, title] of tools) {
      const b = doc.createElement("button")
      b.type = "button"
      b.textContent = glyph
      b.title = title
      b.setAttribute("aria-label", title)
      b.dataset.act = act
      bar.append(b)
    }
    doc.documentElement.append(bar)
    const win = doc.defaultView!, rect = box.getBoundingClientRect()
    bar.style.left = `${Math.max(2, Math.min(rect.left + win.scrollX - 3, doc.documentElement.clientWidth - bar.offsetWidth - 2))}px`
    bar.style.top = `${Math.max(2, rect.top + win.scrollY - 31)}px`
  }

  const sync = (next: string) => {
    const doc = frame.current?.contentDocument
    if (!doc || !shown.current || inline.current) return
    const parsed = parse(next)
    if (shown.current.head.innerHTML !== parsed.head.innerHTML) doc.head.innerHTML = parsed.head.innerHTML
    doc.body.className = parsed.body.className
    patchChildren(doc.body, shown.current.body, parsed.body, 2)
    shown.current = parsed
    doc.getElementById("bw-tag")?.remove()
    mark()
  }
  const latestHtml = useRef(html)
  useEffect(() => {
    latestHtml.current = html
    sync(html)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new page of HTML needs bringing in
  }, [html])

  useEffect(() => {
    latest.current = { onBlock, onLink, selectedId, editing, marks }
    mark()
    if (scrolledTo.current === selectedId) return
    scrolledTo.current = selectedId
    if (selectedId) boxOf(frame.current?.contentDocument?.querySelector(`[data-bw="${CSS.escape(selectedId)}"]`))?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  })

  const finishInline = (save: boolean) => {
    const now = inline.current
    if (!now) return
    inline.current = null
    now.target.removeAttribute("contenteditable")
    now.target.classList.remove("bw-editing")
    const value = now.target.innerText.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    if (save && value !== now.value.trim()) latest.current.editing?.commit(now.id, value)
    else now.wrapper.innerHTML = now.saved
    sync(latestHtml.current)
  }

  const startInline = (wrapper: Element, id: string, x: number, y: number) => {
    const doc = frame.current?.contentDocument
    const what = latest.current.editing?.text(id)
    const target = wrapper.firstElementChild
    if (!doc || !what || !(target instanceof doc.defaultView!.HTMLElement)) return
    const saved = wrapper.innerHTML
    target.classList.remove("bw-sel", "bw-hover")
    doc.getElementById("bw-bar")?.remove()
    // A text block can be several paragraphs on the page; it is one piece of text while you edit it.
    while (target.nextElementSibling) target.nextElementSibling.remove()
    target.textContent = what.value
    target.classList.add("bw-editing")
    target.dataset.placeholder = what.placeholder
    try { target.contentEditable = "plaintext-only" } catch { target.contentEditable = "true" }
    inline.current = { id, wrapper, target, saved, value: what.value }
    doc.getElementById("bw-tag")?.remove()
    target.focus()
    const range = doc.caretRangeFromPoint?.(x, y)
    const sel = doc.defaultView!.getSelection()
    if (range && target.contains(range.startContainer)) { sel?.removeAllRanges(); sel?.addRange(range) }
    else { sel?.selectAllChildren(target); sel?.collapseToEnd() }
    target.addEventListener("blur", () => finishInline(true), { once: true })
    target.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Escape") { e.preventDefault(); finishInline(false) }
      else if (e.key === "Enter" && !(e.shiftKey && what.multiline)) { e.preventDefault(); finishInline(true) }
    })
  }

  const attach = () => {
    const win = frame.current?.contentWindow, doc = frame.current?.contentDocument
    if (!win || !doc) return
    shown.current = parse(firstHtml)
    win.scrollTo(0, scroll.current)
    win.addEventListener("scroll", () => { scroll.current = win.scrollY })
    sync(latestHtml.current)
    mark()
    let hover: Element | null = null
    const blockAt = (target: EventTarget | null) => (target as Element | null)?.closest?.("[data-bw]") ?? null
    doc.addEventListener("mouseover", (e) => {
      if (inline.current) return
      hover?.classList.remove("bw-hover")
      const wrapper = latest.current.onBlock ? blockAt(e.target) : null
      hover = boxOf(wrapper)
      hover?.classList.add("bw-hover")
      doc.getElementById("bw-tag")?.remove()
      const hoveredId = wrapper?.getAttribute("data-bw")
      const name = hoveredId && hoveredId !== latest.current.selectedId ? latest.current.editing?.label(hoveredId) : undefined
      if (!hover || !name) return
      const box = hover.getBoundingClientRect()
      const tag = doc.createElement("div")
      tag.id = "bw-tag"
      tag.textContent = name
      tag.style.left = `${box.left + win.scrollX - 3}px`
      tag.style.top = `${Math.max(0, box.top + win.scrollY - 20)}px`
      doc.documentElement.append(tag)
    })
    doc.addEventListener("mouseleave", () => { hover?.classList.remove("bw-hover"); doc.getElementById("bw-tag")?.remove() })
    doc.addEventListener("submit", (e) => e.preventDefault())
    doc.addEventListener("pointerdown", () => latest.current.editing?.activate())
    doc.addEventListener("keydown", (e) => { if (!inline.current) latest.current.editing?.key(e) })
    doc.addEventListener("click", (e) => {
      e.preventDefault()
      const el = e.target as Element
      if (inline.current?.target.contains(el)) return
      const tool = el.closest?.("#bw-bar button")
      if (tool) { latest.current.editing?.act(el.closest("#bw-bar")!.getAttribute("data-for")!, tool.getAttribute("data-act") as BlockAction); return }
      if (el.closest?.("#bw-bar")) return
      const strip = el.closest?.("[data-bw-insert]")
      if (strip) { if (el.closest("button")) latest.current.editing?.insert(Number(strip.getAttribute("data-bw-insert"))); return }
      const block = blockAt(el)
      if (block && latest.current.onBlock) {
        const id = block.getAttribute("data-bw")!
        if (id === latest.current.selectedId && latest.current.editing?.text(id)) return startInline(block, id, e.clientX, e.clientY)
        return latest.current.onBlock(id)
      }
      const href = el.closest?.("a")?.getAttribute("href")
      if (href) latest.current.onLink?.(href)
      else latest.current.editing?.deselect()
    })
  }

  return <iframe ref={frame} title={title} srcDoc={firstHtml} onLoad={attach} sandbox="allow-same-origin" className={cn("h-[min(78vh,900px)] max-w-full rounded-[8px] bg-white", className)} style={{ width }} />
}

/** A whole page shrunk into a card: the page is laid out at `width` and scaled to fit what the card allows. */
export function ScaledFrame({ html, title, width = 1100, aspect = 16 / 10, fit, className }: { html: string; title: string; width?: number; aspect?: number; /** Take the shape of what's inside (within reason) instead of `aspect`. */ fit?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  const [natural, setNatural] = useState<number | null>(null)
  const shape = fit && natural ? natural : aspect
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
    <div ref={box} className={cn("pointer-events-none relative w-full overflow-hidden bg-white", className)} style={{ aspectRatio: String(shape) }} aria-hidden>
      <iframe title={title} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} className="absolute top-0 left-0 origin-top-left border-0" style={{ width, height: width / shape, transform: `scale(${scale})` }}
        onLoad={(e) => { if (!fit) return; const h = (e.currentTarget.contentDocument?.querySelector("main") as HTMLElement | null)?.offsetHeight; if (h) setNatural(Math.min(4.5, Math.max(1.15, width / h))) }} />
    </div>
  )
}
