import { isRouteErrorResponse, useRouteError } from "react-router-dom"

/** Last-resort error screen. Local data is untouched; reloading usually recovers. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error"
  return (
    <div className="mx-auto mt-24 max-w-md rounded-lg border bg-card p-5 text-sm">
      <p className="wordmark mb-2 text-2xl">Blackwall</p>
      <h1 className="font-bold">Something broke while rendering this view.</h1>
      <p className="mt-1 font-mono text-xs text-red-text">{message}</p>
      <p className="mt-3 text-muted-foreground">Your local records are still saved in this browser.</p>
      <div className="mt-4 flex gap-2">
        <button className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground" onClick={() => location.reload()}>
          Reload
        </button>
        <a className="rounded-md border px-3 py-1.5" href="/">Go home</a>
      </div>
    </div>
  )
}
