import { RotateCw } from "lucide-react"
import { NoSignal } from "./no-signal"
import { useUi } from "@/stores/ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { providerDef, type ProviderId } from "@shared/connections"
import type { Feed } from "@/services/data"

/** Placeholder for a panel whose feed isn't showing data: not connected, failed, or loading. */
export function FeedFallback({ feed, provider, what }: { feed: Feed<unknown>; provider: ProviderId; what: string }) {
  const name = providerDef(provider).name
  if (feed.status === "loading" || ((feed.status === "live" || feed.status === "sample") && !feed.data)) {
    return (
      <div className="space-y-2 px-3.5 py-3" aria-busy="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    )
  }
  if (feed.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2 px-3.5 py-3">
        <p className="text-[13px] text-red-text">Couldn't load {what}.</p>
        {feed.error && <p className="font-mono text-[11px] break-all text-muted-foreground">{feed.error}</p>}
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="outline" onClick={feed.refresh}><RotateCw /> Retry</Button>
          <Button variant="quiet" onClick={() => useUi.getState().openSettings("connections")}>Connection settings</Button>
          {(provider === "github" || provider === "analytics") && <Button variant="outline" onClick={() => useUi.getState().openSettings("home")}>Choose data source</Button>}
        </div>
      </div>
    )
  }
  return <NoSignal badge={false} message={`Connect ${name} to see ${what} here.`} add={provider} action={`Connect ${name}`} />
}

export const hasData = <T,>(feed: Feed<T>): feed is Feed<T> & { data: T } =>
  (feed.status === "live" || feed.status === "sample") && !!feed.data
