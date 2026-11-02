import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { api } from "@/services/connector"
import type { Service } from "@/lib/types"
// Material Symbols for tiles without a logo (same package and mask technique as account icons).
import dns from "@material-symbols/svg-400/rounded/dns.svg?url"
import storage from "@material-symbols/svg-400/rounded/storage.svg?url"
import cloud from "@material-symbols/svg-400/rounded/cloud.svg?url"
import smartToy from "@material-symbols/svg-400/rounded/smart_toy.svg?url"
import movie from "@material-symbols/svg-400/rounded/movie.svg?url"
import apps from "@material-symbols/svg-400/rounded/apps.svg?url"
import lan from "@material-symbols/svg-400/rounded/lan.svg?url"
import monitorHeart from "@material-symbols/svg-400/rounded/monitor_heart.svg?url"
import terminal from "@material-symbols/svg-400/rounded/terminal.svg?url"
import folder from "@material-symbols/svg-400/rounded/folder.svg?url"
import notifications from "@material-symbols/svg-400/rounded/notifications.svg?url"
import database from "@material-symbols/svg-400/rounded/database.svg?url"
import hub from "@material-symbols/svg-400/rounded/hub.svg?url"
import description from "@material-symbols/svg-400/rounded/description.svg?url"
import router from "@material-symbols/svg-400/rounded/router.svg?url"
import memory from "@material-symbols/svg-400/rounded/memory.svg?url"

export const SERVICE_ICONS = { dns, storage, cloud, smart_toy: smartToy, movie, apps, lan, monitor_heart: monitorHeart, terminal, folder, notifications, database, hub, description, router, memory } as const
export type ServiceIconName = keyof typeof SERVICE_ICONS
const isIcon = (v?: string): v is ServiceIconName => !!v && Object.hasOwn(SERVICE_ICONS, v)

/** Logos come from the server's copy (/api/icons/<slug>); one request per slug per session. */
const cache = new Map<string, Promise<string | null>>()
export function loadLogo(slug: string): Promise<string | null> {
  let p = cache.get(slug)
  if (!p) {
    p = api<{ svg: string }>(`icons/${encodeURIComponent(slug)}`)
      .then((r) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}`)
      .catch(() => null)
    cache.set(slug, p)
  }
  return p
}
/** Forget a failed lookup so the form can try again. */
export const retryLogo = (slug: string) => cache.delete(slug)

export function useLogo(slug?: string) {
  const [state, setState] = useState<{ slug?: string; url: string | null; loading: boolean }>({ url: null, loading: !!slug })
  useEffect(() => {
    let live = true
    if (!slug) return
    void loadLogo(slug).then((url) => live && setState({ slug, url, loading: false }))
    return () => {
      live = false
    }
  }, [slug])
  if (!slug) return { url: null, loading: false }
  return state.slug === slug ? state : { url: null, loading: true }
}

function Glyph({ name, style }: { name: ServiceIconName; style?: CSSProperties }) {
  const url = `url("${SERVICE_ICONS[name]}")`
  return <span aria-hidden className="inline-block shrink-0 bg-current" style={{ WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat`, ...style }} />
}

/** A service's logo on a dark square; the Material icon (or initials) in Mikoshi green when there's no logo. */
export function ServiceLogo({ service, size = 36, className }: { service: Pick<Service, "name" | "logo" | "materialIcon">; size?: number; className?: string }) {
  const { url } = useLogo(service.logo || undefined)
  const pad = Math.round(size * 0.17)
  return (
    <span data-category="mikoshi" className={cn("inline-flex shrink-0 items-center justify-center rounded-[9px] bg-well text-[var(--bw-category)]", className)} style={{ width: size, height: size, padding: pad }} aria-hidden>
      {url ? (
        <img src={url} alt="" className="size-full object-contain" draggable={false} />
      ) : isIcon(service.materialIcon) ? (
        <Glyph name={service.materialIcon} style={{ width: size * 0.55, height: size * 0.55 }} />
      ) : (
        <span className="font-heading text-xs font-bold uppercase">{service.name.slice(0, 2) || "?"}</span>
      )}
    </span>
  )
}

export { Glyph as ServiceGlyph }
