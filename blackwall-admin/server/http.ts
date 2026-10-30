/** Small helpers so providers stay readable. */

export class ProviderError extends Error {
  readonly status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export async function getJson<T>(url: string, init: RequestInit = {}, what = "request"): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw new ProviderError(`${what} failed: ${(e as Error).message}`)
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 200)
    try {
      const j = JSON.parse(text)
      detail = j.message ?? j.error_description ?? j.error?.message ?? j.errors?.[0]?.message ?? detail
    } catch {
      /* not JSON */
    }
    detail = String(detail).split(/\s+Trace ID:/)[0]
    throw new ProviderError(`${what}: HTTP ${res.status}${detail ? ` – ${detail}` : ""}`, res.status === 401 || res.status === 403 ? 401 : 502)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ProviderError(`${what}: response wasn't JSON`)
  }
}

export function need(value: string | undefined, label: string): string {
  if (!value) throw new ProviderError(`${label} is missing`, 400)
  return value
}

export const daysAgo = (n: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const fmtCount = (n: number) => new Intl.NumberFormat("en").format(n)
