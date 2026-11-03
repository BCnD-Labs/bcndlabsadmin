/**
 * The reflection editor's rules (pure): a free-text note plus optional items (REFLECTION_ITEMS, shared
 * with the web). The draft holds every item the task already has, so items this screen doesn't
 * list are carried through untouched. Unchanged drafts return the stored reflection itself, so its
 * `updatedAt` only moves when something really changed.
 */
import { REFLECTION_ITEMS, same, type Collections } from "../../../lib/shared.ts"

export type Reflection = NonNullable<Collections["tasks"][number]["reflection"]>
export type ReflectionKey = keyof typeof REFLECTION_ITEMS
export interface ReflectionDraft { text: string; items: Record<string, string> }

export const REFLECTION_KEYS = Object.keys(REFLECTION_ITEMS) as ReflectionKey[]
export const emptyReflection = (): ReflectionDraft => ({ text: "", items: {} })

export const reflectionDraft = (r?: Reflection): ReflectionDraft => (r ? { text: r.text, items: { ...(r.items as Record<string, string>) } } : emptyReflection())
export const reflectionLabel = (key: ReflectionKey): string => REFLECTION_ITEMS[key].label
export const reflectionOptions = (key: ReflectionKey): readonly string[] => REFLECTION_ITEMS[key].options

/** A field with no choices, or a value that isn't one of them, is edited as free text. */
export const isOwnValue = (key: ReflectionKey, value: string): boolean => !reflectionOptions(key).length || (!!value && !reflectionOptions(key).includes(value))

export const addItem = (d: ReflectionDraft, key: ReflectionKey): ReflectionDraft => (key in d.items ? d : { ...d, items: { ...d.items, [key]: "" } })
export const setItem = (d: ReflectionDraft, key: ReflectionKey, value: string): ReflectionDraft => ({ ...d, items: { ...d.items, [key]: value } })
export function removeItem(d: ReflectionDraft, key: ReflectionKey): ReflectionDraft {
  const { [key]: _gone, ...items } = d.items
  return { ...d, items }
}

const isEmpty = (d: ReflectionDraft) => !d.text.trim() && !Object.keys(d.items).length

/** The stored value for a draft: undefined when empty, `existing` when unchanged, otherwise stamped with `now`. */
export function buildReflection(d: ReflectionDraft, existing: Reflection | undefined, now: string): Reflection | undefined {
  if (isEmpty(d)) return undefined
  if (existing && existing.text === d.text && same(existing.items, d.items)) return existing
  return { text: d.text, items: d.items as Reflection["items"], updatedAt: now }
}

/** The shared limits (100,000 characters of text, 10,000 per item). */
export function reflectionProblem(d: ReflectionDraft): string | undefined {
  if (d.text.length > 100_000) return "The reflection is too long."
  if (Object.values(d.items).some((v) => v.length > 10_000)) return "One of the items is too long."
  return undefined
}

/** One line for the collapsed section. */
export function reflectionPreview(d: ReflectionDraft): string {
  const first = d.text.trim().split("\n")[0]
  const items = Object.keys(d.items).length
  if (!first && !items) return "No reflection yet"
  return [first, items ? `${items} item${items === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")
}
