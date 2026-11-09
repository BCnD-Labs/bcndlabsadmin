/**
 * Which item types a course's kind offers, as the web's task form labels them (the web keeps the
 * table in features/learning/learning-utils.ts next to its icons, so native carries the labels only).
 * Pure: no React.
 */
import type { Collections } from "../../../lib/shared.ts"

type Course = Collections["courses"][number]
export type ItemType = NonNullable<Collections["tasks"][number]["learningType"]>
export type Kind = NonNullable<Course["kind"]>
export interface TypeOption { value: ItemType; label: string }

const t = (value: ItemType, label: string): TypeOption => ({ value, label })
const KIND_TYPES: Record<Kind, TypeOption[]> = {
  course: [t("assignment", "Assignment"), t("quiz", "Quiz"), t("exam", "Exam"), t("milestone", "Milestone"), t("event", "Event")],
  certification: [t("milestone", "Exam domain"), t("exam", "Practice test"), t("assignment", "Study task"), t("event", "Event")],
  selfpaced: [t("milestone", "Section"), t("assignment", "Exercise"), t("event", "Study session")],
  skill: [t("milestone", "Milestone"), t("assignment", "Practice"), t("event", "Practice session")],
  reading: [t("milestone", "Chapter"), t("assignment", "Reading goal"), t("event", "Reading session")],
}

/** The types a kind offers, in the web's order. A missing or unknown kind is a course (older records). */
export const typeOptions = (kind?: Kind): TypeOption[] => KIND_TYPES[kind ?? "course"] ?? KIND_TYPES.course

/** The type to use after picking a course: keep the current one if the kind has it, else the kind's first (web rule). */
export function typeAfterCourseChange(current: ItemType | "", kind?: Kind): ItemType {
  const options = typeOptions(kind)
  const wanted = current || "assignment"
  return options.some((o) => o.value === wanted) ? wanted : options[0].value
}

/** A practice test on a certification is the one item that carries a score (0 to 100). */
export const isScored = (kind: Kind | undefined, type: ItemType | ""): boolean => kind === "certification" && type === "exam"

export const courseLabel = (c: Pick<Course, "code" | "title">): string => (c.code && c.title ? `${c.code} · ${c.title}` : c.title || c.code)

/** The label of a type for a kind ("Exam domain"); the raw value when unknown. */
export const typeLabel = (type: ItemType | "", kind?: Kind): string => typeOptions(kind).find((o) => o.value === type)?.label ?? (type || "")

