import { useRef } from "react"
import { Alert } from "react-native"
import { requestEditorClose } from "./close-policy.ts"

export function useEditorClose(dirty: boolean, busy: boolean, onClose: () => void, save: () => Promise<boolean>) {
  const pending = useRef(false)
  return (after = onClose) => requestEditorClose({ dirty, busy: busy || pending.current, close: after, save: async () => {
    pending.current = true
    try { return await save() } finally { pending.current = false }
  }, prompt: choices => Alert.alert("Unsaved changes", "Save your changes before leaving?", choices) })
}
