import { toast } from "sonner"
import { downloadFile } from "@/features/mikoshi/storage-api"
import type { DocLink } from "@/lib/types"
import { useDocs } from "./docs-store"
import { documentKind } from "./document-kind"
import { fileNameOf, nextcloudPathOf } from "./nextcloud-link"

/** Opens a `nextcloud:` link: Word, Excel and PowerPoint files in the Docs app, anything else as a download. Returns false for any other link, which the caller opens as usual. */
export function openNextcloudLink(link: Pick<DocLink, "url">): boolean {
  const path = nextcloudPathOf(link.url)
  if (!path) return false
  if (documentKind(path)) useDocs.getState().open(path)
  else void downloadFile({ name: fileNameOf(path), path, type: "file", size: 0, modified: "" }).catch((e) => toast.error((e as Error).message))
  return true
}
