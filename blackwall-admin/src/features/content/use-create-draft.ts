import { useWorkspace } from "@/stores/workspace"
import type { Draft } from "@/lib/types"

/** Creates an empty local draft and returns it; callers navigate to the editor. */
export function useCreateDraft() {
  const create = useWorkspace((s) => s.create)
  return (defaults?: Partial<Draft>) =>
    create("drafts", {
      title: "Untitled draft",
      slug: "untitled-draft",
      kind: "post",
      status: "idea",
      excerpt: "",
      body: "",
      ...defaults,
    })
}
