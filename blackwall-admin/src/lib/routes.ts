import type { Note } from "./types"

const KIND_ROUTE: Record<Note["kind"], string> = {
  note: "/knowledge/notes",
  reference: "/knowledge/references",
  link: "/knowledge/links",
}

export const noteHref = (n: Pick<Note, "id" | "kind">) => `${KIND_ROUTE[n.kind]}?id=${n.id}`
export const projectHref = (id: string) => `/work/projects/${id}`
export const draftHref = (id: string) => `/content/drafts/${id}`
export const noteListHref = (kind: Note["kind"]) => KIND_ROUTE[kind]
