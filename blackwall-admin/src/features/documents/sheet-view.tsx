import { useEffect, useState } from "react"
import readXlsxFile from "read-excel-file/browser"
import { cn } from "@/lib/utils"
import { SHEET_MAX_COLS, SHEET_MAX_ROWS, cellText, columnName, type SheetCell } from "./document-kind"

interface Sheet { sheet: string; data: SheetCell[][] }

/** An Excel workbook as plain grids, one tab per sheet. Shows the saved values, not formulas. Read-only. */
export default function SheetView({ blob, onError }: { blob: Blob; onError: (message: string) => void }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    let alive = true
    readXlsxFile(blob)
      .then((result) => { if (alive) setSheets(result as Sheet[]) })
      .catch((e) => alive && onError(`This workbook couldn't be opened (${(e as Error).message}).`))
    return () => { alive = false }
  }, [blob, onError])
  if (!sheets) return <p className="p-4 text-sm text-muted-foreground">Reading the workbook…</p>
  const current = sheets[Math.min(active, sheets.length - 1)]
  const rows = current.data.slice(0, SHEET_MAX_ROWS)
  const width = Math.min(SHEET_MAX_COLS, Math.max(1, ...rows.map((r) => r.length)))
  const clipped = current.data.length > SHEET_MAX_ROWS || current.data.some((r) => r.length > SHEET_MAX_COLS)
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="sheet-view">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line-soft bg-panel">
        {rows.length ? (
          <table className="border-collapse text-[12px] tabular-nums">
            <thead className="sticky top-0 z-10 bg-raised text-muted-foreground">
              <tr>
                <th className="w-10 border border-line-soft px-1.5 py-1" aria-label="Row" />
                {Array.from({ length: width }, (_, c) => <th key={c} className="min-w-20 border border-line-soft px-2 py-1 font-medium">{columnName(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  <th className="sticky left-0 border border-line-soft bg-raised px-1.5 py-0.5 text-right font-normal text-muted-foreground">{r + 1}</th>
                  {Array.from({ length: width }, (_, c) => {
                    const v = row[c]
                    return <td key={c} className={cn("max-w-[28rem] truncate border border-line-soft px-2 py-0.5 text-ink", typeof v === "number" && "text-right")} title={cellText(v)}>{cellText(v)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-4 text-sm text-muted-foreground">This sheet is empty.</p>}
      </div>
      {clipped && <p className="text-[11px] text-faint">Showing the first {SHEET_MAX_ROWS} rows and {SHEET_MAX_COLS} columns. Open the file in Nextcloud for the rest.</p>}
      {sheets.length > 1 && (
        <div role="tablist" aria-label="Sheets" className="flex gap-1 overflow-x-auto">
          {sheets.map((s, i) => (
            <button key={s.sheet + i} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={cn("h-7 shrink-0 rounded-md px-3 text-xs", i === active ? "bg-selected text-ink" : "text-muted-foreground hover:text-ink")}>{s.sheet}</button>
          ))}
        </div>
      )}
    </div>
  )
}
