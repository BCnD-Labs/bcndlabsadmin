/**
 * The Embed block turns a share URL into the right embed, without any JavaScript dependency from the service.
 *
 * Each provider gets a pattern and a function that turns a matched URL into an iframe `src`. The iframe loads from the
 * provider's own origin. Services whose embed needs a widget script (Twitter / X, Bluesky, GitHub Gist) are intentionally
 * not here — those would need the published site's CSP to list each domain, which is a bigger step than Round 3 asks for.
 */

export interface EmbedResult {
  provider: string
  src: string
  /** CSS aspect-ratio keyword like "16 / 9", for the wrapper. Audio-only providers use "auto" and a fixed height. */
  aspect: string
  title: string
  /** For Spotify-style widgets, the iframe should have a smaller height rather than a wide aspect. */
  fixedHeight?: number
}

interface Provider { name: string; pattern: RegExp; build: (m: RegExpExecArray) => EmbedResult | null }

const PROVIDERS: Provider[] = [
  // YouTube: watch, share, embed, shorts and live URLs (nocookie too).
  { name: "YouTube", pattern: /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?=$|[?&#/])/, build: (m) => ({ provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${m[1]}`, aspect: "16 / 9", title: "YouTube video" }) },
  // Vimeo: vimeo.com/<id>
  { name: "Vimeo", pattern: /^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)(?=$|[?&#/])/, build: (m) => ({ provider: "Vimeo", src: `https://player.vimeo.com/video/${m[1]}`, aspect: "16 / 9", title: "Vimeo video" }) },
  // Loom: loom.com/share/<id>
  { name: "Loom", pattern: /^https?:\/\/(?:www\.)?loom\.com\/share\/([\w-]{20,})(?=$|[?&#/])/, build: (m) => ({ provider: "Loom", src: `https://www.loom.com/embed/${m[1]}`, aspect: "16 / 9", title: "Loom recording" }) },
  // CodePen: codepen.io/<user>/pen/<slug>
  { name: "CodePen", pattern: /^https?:\/\/codepen\.io\/([\w-]+)\/(?:pen|details|full)\/([\w-]+)(?=$|[?&#/])/, build: (m) => ({ provider: "CodePen", src: `https://codepen.io/${m[1]}/embed/${m[2]}?editors=1000&theme-id=dark`, aspect: "4 / 3", title: "CodePen demo" }) },
  // Calendly: calendly.com/<user>/<event>. The URL is used as-is; Calendly takes a hint in the query.
  { name: "Calendly", pattern: /^https?:\/\/calendly\.com\/([\w-]+)\/([\w-]+)(?=$|[?&#/])/, build: (m) => ({ provider: "Calendly", src: `https://calendly.com/${m[1]}/${m[2]}?embed_domain=&embed_type=Inline`, aspect: "4 / 5", title: "Calendly booking" }) },
  // Spotify: track, album, episode, playlist. open.spotify.com/<kind>/<id>
  { name: "Spotify", pattern: /^https?:\/\/open\.spotify\.com\/(track|album|episode|playlist|show)\/([A-Za-z0-9]+)(?=$|[?&#/])/, build: (m) => ({ provider: "Spotify", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, aspect: "auto", fixedHeight: m[1] === "track" ? 152 : 352, title: `Spotify ${m[1]}` }) },
]

/** The list of providers for the inspector's help text and tests. */
export const EMBED_PROVIDERS = PROVIDERS.map((p) => p.name)

/** The first provider that matches the URL, or null for an unknown URL. */
export function embedOf(url: string): EmbedResult | null {
  const trimmed = String(url ?? "").trim()
  if (!trimmed) return null
  for (const p of PROVIDERS) {
    const m = p.pattern.exec(trimmed)
    if (m) {
      const r = p.build(m)
      if (r) return r
    }
  }
  return null
}
