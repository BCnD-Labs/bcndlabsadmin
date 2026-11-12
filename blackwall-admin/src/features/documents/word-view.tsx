import { useEffect, useRef } from "react"
import { renderAsync } from "docx-preview"
import { lockLinks } from "./document-kind"

/** A Word document drawn page by page. Read-only. */
export default function WordView({ blob, onError }: { blob: Blob; onError: (message: string) => void }) {
  const body = useRef<HTMLDivElement>(null)
  const styles = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    const host = body.current
    if (!host || !styles.current) return
    renderAsync(blob, host, styles.current, { inWrapper: true, breakPages: true, useBase64URL: true, ignoreLastRenderedPageBreak: false })
      .then(() => { if (alive) lockLinks(host) })
      .catch((e) => alive && onError(`This document couldn't be opened (${(e as Error).message}).`))
    return () => { alive = false; host.replaceChildren() }
  }, [blob, onError])
  return (
    <div className="h-full overflow-auto rounded-md bg-well [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-4 [&_.docx-wrapper>section.docx]:!mb-4 [&_.docx-wrapper>section.docx]:shadow-md">
      <div ref={styles} />
      <div ref={body} data-testid="word-view" />
    </div>
  )
}
