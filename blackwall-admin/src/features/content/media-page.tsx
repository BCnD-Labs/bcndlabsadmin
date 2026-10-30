import { ImageOff } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/common/panel"
import { SourceBadge } from "@/components/common/source-badge"

export function MediaPage() {
  return (
    <>
      <PageHeader title="Media" badge={<SourceBadge status="not-connected" />} description="No media library is connected." />
      <div className="flex max-w-xl gap-3 rounded-lg border bg-card p-4 text-sm">
        <ImageOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-2">
          <p>Blackwall doesn't store images or files yet. Drafts hold text only, so nothing here is simulated.</p>
          <p className="text-muted-foreground">
            Next step: decide where website media lives (the site repository, object storage or a CDN), then add a
            server-side MediaService. See <Link to="/settings/integrations" className="text-teal hover:underline">Settings → Integrations</Link>.
          </p>
        </div>
      </div>
    </>
  )
}
