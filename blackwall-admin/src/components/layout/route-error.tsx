import { isRouteErrorResponse, useRouteError } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/common/panel"

/** Last-resort error screen. Local data is untouched; reloading usually recovers. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error"
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Panel tool="blackwall" command="render" className="w-full max-w-md" label="Something broke">
        <div className="flex flex-col gap-3 px-5 py-5">
          <h1 className="font-heading text-xl leading-tight font-bold">Something broke while rendering this view</h1>
          <p className="rounded-[8px] border border-rim bg-well px-3 py-2 font-mono text-[11px] break-words text-red-text">{message}</p>
          <p className="text-xs text-muted-foreground">Your local records are still saved in this browser.</p>
          <div className="mt-1 flex gap-2">
            <Button size="lg" onClick={() => location.reload()}>Reload</Button>
            <Button size="lg" variant="outline" asChild><a href="/">Go home</a></Button>
          </div>
        </div>
      </Panel>
    </main>
  )
}
