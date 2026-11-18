import { ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { storage } from "@/features/mikoshi/storage-api"

const IS_MAC = typeof document !== "undefined" && document.documentElement.dataset.runtime === "mac-native"

/** React drops allowpopups as a boolean; the string form reaches the element. The Mac app routes popups itself (desktop/src/main/tabs.ts). */
const POPUPS = { allowpopups: "true" } as object

/**
 * Nextcloud's office editor (Collabora) for one file. Nextcloud gives a one-time page address that needs no sign-in, which the
 * Mac app shows in a <webview> (the same kind of page the Browser window uses). Collabora saves back into Nextcloud as you type.
 * Elsewhere there is no embedded page, so the editor opens in its own browser tab.
 */
export function EditorPane({ path, name, active }: { path: string; name: string; active: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    storage.editOpen(path).then((r) => alive && setUrl(r.url)).catch((e) => alive && setError((e as Error).message))
    return () => { alive = false }
  }, [path])
  return (
    <div className={active ? "absolute inset-0" : "pointer-events-none invisible absolute inset-0"} role="tabpanel" aria-hidden={!active}>
      {error ? (
        <div role="alert" className="grid h-full place-items-center rounded-md bg-well p-6 text-center text-sm text-muted-foreground">{error}</div>
      ) : !url ? (
        <p className="p-4 text-sm text-muted-foreground">Opening {name} in the editor…</p>
      ) : IS_MAC ? (
        <webview src={url} partition="persist:blackwall-web" {...POPUPS} title={`Editing ${name}`} className="size-full rounded-md bg-well" />
      ) : (
        <div className="grid h-full place-items-center rounded-md bg-well p-6 text-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <p>The editor opens in its own tab here.</p>
            <Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Edit {name}</a></Button>
          </div>
        </div>
      )}
    </div>
  )
}
