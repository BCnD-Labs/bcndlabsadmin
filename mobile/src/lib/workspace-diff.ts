/**
 * How many records the phone has changed that the server has not accepted yet (the number in
 * "Offline, 3 changes waiting"). Pure: compares the last confirmed copy with what the phone shows,
 * record by record (by id), only in the collections the unsent edits declared.
 */
import { same, type Collections } from "./shared.ts"

export function countUnsent(base: Collections, local: Collections, touched: Iterable<keyof Collections>): number {
  let count = 0
  for (const key of touched) {
    const before = new Map<string, unknown>(base[key].map((row) => [row.id, row]))
    const after = new Map<string, unknown>(local[key].map((row) => [row.id, row]))
    for (const [id, row] of after) if (!before.has(id) || !same(before.get(id), row)) count++
    for (const id of before.keys()) if (!after.has(id)) count++
  }
  return count
}
