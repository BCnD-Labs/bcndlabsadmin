import { create } from "zustand"
import type { LearningEntry } from "./reflection-lists"
import { LearningReflectionDialog } from "./learning-reflection-dialog"

interface Target { courseId?: string; taskId?: string; entry?: LearningEntry }
interface ReflectionState { target: Target | null; open: (target?: Target) => void; close: () => void }

/** Which learning reflection is being written or edited. One host shows the dialog app-wide, so any page can start one. */
export const useReflection = create<ReflectionState>()((set) => ({ target: null, open: (target = {}) => set({ target }), close: () => set({ target: null }) }))

export function ReflectionHost() {
  const target = useReflection((s) => s.target)
  const close = useReflection((s) => s.close)
  if (!target) return null
  return <LearningReflectionDialog key={target.entry?.item.id ?? `${target.courseId ?? ""}/${target.taskId ?? ""}`} {...target} onClose={close} />
}
