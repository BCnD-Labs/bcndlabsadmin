import { ImageIcon } from "lucide-react"
import { findAsset, humanBytes } from "@shared/assets"
import { Button } from "@/components/ui/button"
import type { Asset } from "@/lib/types"
import { useWorkspace } from "@/stores/workspace"
import { AssetImage, chooseAsset } from "./asset-flow"

/** A picture slot that can only be filled from the asset library: a thumbnail, what it is, and Choose / Change / Remove. */
export function AssetField({ value, onPick, onClear, id }: { value: string; onPick: (a: Asset) => void; onClear: () => void; id?: string }) {
  const assets = useWorkspace((s) => s.assets)
  const asset = findAsset(assets, value)
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] bg-raised p-1.5">
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-well text-faint">{asset ? <AssetImage asset={asset} className="size-14" /> : <ImageIcon className="size-5" aria-hidden />}</span>
      <span className="min-w-0 flex-1 text-xs">
        {asset ? <><b className="block truncate text-ink">{asset.name}</b><span className="block truncate text-muted-foreground">{asset.width}×{asset.height} · {humanBytes(asset.bytes)}</span></>
          : value ? <><b className="block truncate text-amber">Not in your library</b><span className="block truncate font-mono text-[10.5px] text-muted-foreground">{value}</span></>
          : <span className="text-muted-foreground">No picture yet</span>}
      </span>
      <Button id={id} type="button" size="sm" variant={value ? "outline" : "default"} onClick={() => chooseAsset(onPick)}>{value ? "Change" : "Choose"}</Button>
      {value && <Button type="button" size="sm" variant="quiet" onClick={onClear}>Remove</Button>}
    </div>
  )
}
