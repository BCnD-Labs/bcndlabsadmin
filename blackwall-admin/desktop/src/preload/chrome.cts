/**
 * Preload for the chrome UI only. Web tabs get no preload at all.
 * Sandboxed, so this is CommonJS and may only require "electron".
 */
import type { Channel, ShellBridge } from "../shared/ipc.ts"

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron")

const channel = (name: Channel) => name

const bridge: ShellBridge = {
  send: (command) => ipcRenderer.send(channel("shell:cmd"), command),
  setWebAddress: (value) => ipcRenderer.invoke(channel("shell:set-web-address"), String(value)),
  // Listeners get plain data, never the IPC event (which would expose `sender`).
  onState: (listener) => void ipcRenderer.on(channel("shell:state"), (_e, state) => listener(state)),
  onUi: (listener) => void ipcRenderer.on(channel("shell:ui"), (_e, command) => listener(command)),
  onFind: (listener) => void ipcRenderer.on(channel("shell:find"), (_e, result) => listener(result)),
}

contextBridge.exposeInMainWorld("shell", bridge)
