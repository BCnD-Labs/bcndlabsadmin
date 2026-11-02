import { ImageOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { joinUrl } from "@shared/site"
import { cn } from "@/lib/utils"
import { localImages, rawImageUrl } from "@/services/site"

/**
 * An image on the website. Uses the copy in memory if it was just uploaded, then
 * the live site, then the repository through Blackwall's server (for images the
 * site hasn't redeployed with yet).
 */
export function SiteImage({ path, siteUrl, alt = "", className }: { path: string; siteUrl?: string; alt?: string; className?: string }) {
  return <SiteImageInner key={path} path={path} siteUrl={siteUrl} alt={alt} className={className} />
}

function SiteImageInner({ path, siteUrl, alt, className }: { path: string; siteUrl?: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | undefined>(() => localImages.get(path) ?? (siteUrl ? joinUrl(siteUrl, path) : undefined))
  const [state, setState] = useState<"trying" | "raw" | "failed">(src ? "trying" : "raw")
  useEffect(() => {
    if (state !== "raw") return
    let live = true
    rawImageUrl(path)
      .then((u) => live && setSrc(u))
      .catch(() => live && setState("failed"))
    return () => {
      live = false
    }
  }, [state, path])
  if (state === "failed")
    return (
      <span className={cn("flex items-center justify-center bg-well text-faint", className)} title={`Couldn't load ${path}`}>
        <ImageOff className="size-5" aria-hidden />
      </span>
    )
  if (!src) return <span className={cn("block animate-pulse bg-well", className)} aria-hidden />
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} onError={() => setState((s) => (s === "trying" ? "raw" : "failed"))} />
}

/**
 * A live, scaled-down view of a web page as its thumbnail: the real page in an
 * iframe at 1280px wide, scripts off, not interactive.
 */
export function LiveThumb({ url, title, className }: { url: string; title: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1280))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-white", className)} aria-hidden>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-well" />}
      <iframe
        src={url}
        title={`Preview of ${title}`}
        loading="lazy"
        sandbox="allow-same-origin"
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        style={{ width: 1280, height: 800, transform: `scale(${scale})` }}
      />
    </div>
  )
}

/** Stand-in when a post has no cover: its initials on a quiet tile. */
export function CoverPlaceholder({ title, className }: { title: string; className?: string }) {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return (
    <span
      className={cn("flex items-center justify-center bg-panel font-heading text-lg font-medium text-muted-foreground", className)}
      aria-hidden
    >
      {letters || "—"}
    </span>
  )
}
