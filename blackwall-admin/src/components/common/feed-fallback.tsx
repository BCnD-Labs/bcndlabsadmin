import { RotateCw } from "lucide-react"
import { NoSignal } from "./no-signal"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { providerDef, type ProviderId } from "@shared/connections"
import type { Feed } from "@/services/data"

/** Placeholder for a panel whose feed isn't showing data: not connected, failed, or loading. */
export function FeedFallback({ feed, provider, what }: { feed: Feed<unknown>; provider: ProviderId; what: string }) {
  const name = providerDef(provider).name
  if (feed.status === "loading" || ((feed.status === "live" || feed.status === "sample") && !feed.data)) {
    return (
      <div className="space-y-2 p-3" aria-busy="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    )
  }
  if (feed.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-sm">
        <p className="text-red-text">Couldn't load {what}.</p>
        {feed.error && <p className="font-mono text-xs break-all text-muted-foreground">{feed.error}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={feed.refresh}><RotateCw /> Retry</Button>
          <Button size="sm" variant="ghost" asChild><Link to="/settings/connections">Connection settings</Link></Button>
        </div>
      </div>
    )
  }
  return <NoSignal message={`Connect ${name} to see ${what} here.`} to={`/settings/connections?add=${provider}`} action={`Connect ${name}`} />
}

export const hasData = <T,>(feed: Feed<T>): feed is Feed<T> & { data: T } =>
  (feed.status === "live" || feed.status === "sample") && !!feed.data
