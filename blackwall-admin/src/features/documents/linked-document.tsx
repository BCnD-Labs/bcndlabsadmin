import { useCallback } from "react"
import { toast } from "sonner"
import { create } from "zustand"
import { downloadFile, fetchFile } from "@/features/mikoshi/storage-api"
import type { DocLink } from "@/lib/types"
import { DocumentViewer } from "./document-viewer"
import { documentKind } from "./document-kind"
import { fileNameOf, nextcloudPathOf } from "./nextcloud-link"

interface LinkedDocumentState {
  target: { name: string; path: string } | null
  open: (path: string) => void
  close: () => void
}

/** Which linked Nextcloud file is open. One host renders it app-wide, so a menu can close without taking the viewer with it. */
export const useLinkedDocument = create<LinkedDocumentState>()((set) => ({
  target: null,
  open: (path) => set({ target: { name: fileNameOf(path), path } }),
  close: () => set({ target: null }),
}))

/** Opens a `nextcloud:` link in the viewer. Returns false for any other link, which the caller opens as usual. */
export function openNextcloudLink(link: Pick<DocLink, "url">): boolean {
  const path = nextcloudPathOf(link.url)
  if (!path) return false
  if (documentKind(path)) useLinkedDocument.getState().open(path)
  else void downloadFile({ name: fileNameOf(path), path, type: "file", size: 0, modified: "" }).catch((e) => toast.error((e as Error).message))
  return true
}

export function LinkedDocumentHost() {
  const target = useLinkedDocument((s) => s.target)
  const close = useLinkedDocument((s) => s.close)
  const path = target?.path
  const load = useCallback(() => fetchFile(path ?? ""), [path])
  if (!target) return null
  return <DocumentViewer key={target.path} name={target.name} load={load} onClose={close} onDownload={() => void downloadFile({ name: target.name, path: target.path, type: "file", size: 0, modified: "" }).catch((e) => toast.error((e as Error).message))} />
}
