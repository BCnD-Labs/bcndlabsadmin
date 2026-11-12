/** Word, Excel and PowerPoint files that the in-app viewer can show (the modern, zipped formats). */
export type DocumentKind = "docx" | "xlsx" | "pptx"

export const documentKind = (name: string): DocumentKind | null => {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase()
  return ext === "docx" || ext === "xlsx" || ext === "pptx" ? ext : null
}

/** Older binary Office files (.doc, .xls, .ppt) and OpenDocument files can't be shown; the viewer says so instead of failing. */
export const isLegacyOffice = (name: string) => /\.(doc|xls|ppt|odt|ods|odp|rtf)$/i.test(name.trim())

export const KIND_LABEL: Record<DocumentKind, string> = { docx: "Word document", xlsx: "Excel workbook", pptx: "PowerPoint" }

/** Links inside a document may only go to the web or an email address; script and data links are removed. */
export const safeHref = (href: string | null): string | null => {
  const value = href?.trim() ?? ""
  return /^(https?:\/\/|mailto:)/i.test(value) ? value : null
}

/** Makes every link in rendered document content safe: web/email only, opened in a new tab, no referrer. */
export function lockLinks(root: ParentNode) {
  for (const a of root.querySelectorAll("a")) {
    const href = safeHref(a.getAttribute("href"))
    if (href) {
      a.setAttribute("href", href)
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noreferrer noopener")
    } else a.removeAttribute("href")
  }
}

/** Largest sheet the viewer draws; bigger ones show the top-left corner and say so. */
export const SHEET_MAX_ROWS = 1000
export const SHEET_MAX_COLS = 40

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1
  let out = ""
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

export type SheetCell = string | number | boolean | Date | null | undefined

export function cellText(value: SheetCell): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}
