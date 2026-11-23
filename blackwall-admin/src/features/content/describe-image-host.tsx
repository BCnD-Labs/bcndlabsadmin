import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { answerDescribeImage, looksLikeFileName, useDescribeImage } from "@/services/describe-image"

/** Mounted once for the whole app, next to the publish review. */
export function DescribeImageHost() {
  const ask = useDescribeImage((s) => s.ask)
  return <Dialog open={!!ask} onOpenChange={(open) => { if (!open) answerDescribeImage(undefined) }}>{ask && <Body key={ask.src} />}</Dialog>
}

function Body() {
  const ask = useDescribeImage((s) => s.ask)!
  const [text, setText] = useState("")
  const [decorative, setDecorative] = useState(false)
  const ok = decorative || (text.trim().length > 0 && !looksLikeFileName(text))
  return (
    <DialogContent className="gap-3 sm:max-w-md" aria-describedby="describe-about">
      <DialogTitle className="font-heading text-base font-bold">Describe this picture</DialogTitle>
      <DialogDescription id="describe-about" className="text-xs">Say what it shows, for people who can't see it. It is published with the picture.</DialogDescription>
      <img src={ask.src} alt="The picture being added" className="max-h-40 w-fit rounded-md border border-line-soft object-contain" />
      <Textarea value={text} disabled={decorative} onChange={(e) => setText(e.target.value)} rows={3} maxLength={200} aria-label="Picture description" placeholder="The team at the workbench, laughing" data-testid="describe-text" />
      {!decorative && looksLikeFileName(text) && <p className="text-[12px] text-amber">That looks like a file name. Describe what the picture shows.</p>}
      <label className="flex items-center gap-2 text-[12.5px] text-ink">
        <Checkbox checked={decorative} onCheckedChange={(v) => setDecorative(v === true)} aria-label="This picture is only decoration" /> It is only decoration (no description needed)
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => answerDescribeImage(undefined)}>Cancel</Button>
        <Button disabled={!ok} onClick={() => answerDescribeImage(decorative ? "" : text.trim())} data-testid="describe-ok">Add picture</Button>
      </div>
    </DialogContent>
  )
}
