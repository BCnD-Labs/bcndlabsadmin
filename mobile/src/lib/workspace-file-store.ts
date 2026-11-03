/**
 * The workspace cache on the phone: one JSON file in the app's private document directory.
 * Implements `TextStore` (workspace-client.ts). It never throws: a missing file, a full disk or
 * a native error all degrade to "no cache" (read returns null, write does nothing).
 *
 * A save writes a temporary file first, then swaps it in, so a crash mid-write leaves either the
 * old file or the complete new one (read falls back to the temporary file if the swap was cut short).
 * expo-file-system is loaded on first use, so this file can be tested with an injected `fs`.
 */
import type * as ExpoFs from "expo-file-system/legacy"
import type { TextStore } from "./workspace-client.ts"

export type FsLike = Pick<typeof ExpoFs, "documentDirectory" | "readAsStringAsync" | "writeAsStringAsync" | "deleteAsync" | "moveAsync">

const FILE = "blackwall-workspace.json"

export function createWorkspaceFileStore(fs?: FsLike): TextStore {
  const load = async (): Promise<FsLike> => fs ?? ((await import("expo-file-system/legacy")) as FsLike)
  const readFile = async (api: FsLike, uri: string): Promise<string | null> => {
    try {
      return await api.readAsStringAsync(uri)
    } catch {
      return null
    }
  }
  return {
    async read() {
      try {
        const api = await load()
        if (!api.documentDirectory) return null
        return (await readFile(api, api.documentDirectory + FILE)) ?? (await readFile(api, `${api.documentDirectory}${FILE}.tmp`))
      } catch {
        return null
      }
    },
    async write(text: string) {
      try {
        const api = await load()
        if (!api.documentDirectory) return
        const target = api.documentDirectory + FILE
        const temp = `${target}.tmp`
        await api.writeAsStringAsync(temp, text)
        await api.deleteAsync(target, { idempotent: true })
        await api.moveAsync({ from: temp, to: target })
      } catch {
        /* no cache this time */
      }
    },
  }
}
