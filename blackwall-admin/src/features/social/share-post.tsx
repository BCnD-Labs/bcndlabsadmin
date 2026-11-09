import { Share2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { postAddress, socialDraftFromPost } from "@shared/site-links"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { socialHref, socialPostHref } from "@/lib/routes"
import type { Draft } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"

/** Share to Social: makes a Social draft from a post, for the accounts you tick. It posts nothing by itself. */
export function SharePostButton({ post }: { post: Draft }) {
  const accounts = useWorkspace((s) => s.socialAccounts)
  const site = useWorkspace((s) => s.sites.find((x) => x.id === post.siteId))
  const assets = useWorkspace((s) => s.assets)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const create = () => {
    const made = useWorkspace.getState().create("socialPosts", socialDraftFromPost(post, site, assets, picked))
    setOpen(false)
    toast.success("Social draft made", { description: "Nothing has been posted yet." })
    navigate(socialPostHref(made.id))
  }
  const address = postAddress(post, site)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setPicked([]); setOpen(true) }}><Share2 /> Share to Social</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 sm:max-w-md" aria-describedby="share-about">
          <DialogTitle className="font-heading text-base font-bold">Share to Social</DialogTitle>
          <DialogDescription id="share-about" className="text-xs text-muted-foreground">Makes a draft with this post's title, summary, cover and address. Nothing is posted.</DialogDescription>
          {accounts.length ? (
            <ul className="grid gap-1" aria-label="Accounts">
              {accounts.map((a) => (
                <li key={a.id}><label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-raised"><input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} /><span className="min-w-0 flex-1 truncate text-ink">{a.name}</span><span className="shrink-0 text-[11px] text-muted-foreground capitalize">{a.platform} · {a.brand}</span></label></li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">You have no social accounts yet. You can still make the draft and pick accounts later on the <button type="button" className="underline" onClick={() => { setOpen(false); navigate(socialHref) }}>Social page</button>.</p>}
          {!address && <p className="text-[11px] text-faint">This post's site has no domain yet, so the draft won't include an address.</p>}
          <div className="flex justify-end gap-2"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Make draft</Button></div>
        </DialogContent>
      </Dialog>
    </>
  )
}
