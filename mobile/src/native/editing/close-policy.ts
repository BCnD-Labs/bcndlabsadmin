export type CloseChoice = { text: string; style?: "cancel" | "destructive"; onPress?: () => void }
/** One policy for every native editor; validation/refusal never closes the editor. */
export function requestEditorClose({ dirty, busy, close, save, prompt }: { dirty: boolean; busy: boolean; close: () => void; save: () => Promise<boolean>; prompt: (choices: CloseChoice[]) => void }) {
  if (busy) return
  if (!dirty) return close()
  prompt([
    { text: "Keep editing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: close },
    { text: "Save", onPress: () => { void save().then(ok => { if (ok) close() }).catch(() => {}) } },
  ])
}
