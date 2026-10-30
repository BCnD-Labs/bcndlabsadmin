import { ImageOff } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/common/panel"

export function MediaPage() {
  return (
    <>
      <PageHeader title="Media" description="No media library yet." />
      <div className="flex max-w-xl gap-3 brutal rounded-xl bg-card p-4 text-sm">
        <ImageOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-2">
          <p>Blackwall doesn't store images or files yet. Drafts hold text only.</p>
          <p className="text-muted-foreground">
            If your media lives somewhere with an account (a CDN, object storage, a host), you can keep its details under{" "}
            <Link to="/settings/connections" className="text-teal hover:underline">Settings → Connections</Link>.
          </p>
        </div>
      </div>
    </>
  )
}
