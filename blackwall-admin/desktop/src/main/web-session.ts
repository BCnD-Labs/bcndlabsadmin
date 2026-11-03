import { app, dialog, session, type Session } from "electron"
import path from "node:path"

/**
 * One persistent partition for every web tab, so the hosted Blackwall's
 * sign-in cookie (and its service worker, cache and storage) survive restarts.
 * The chrome UI uses the default session instead, so web pages never share
 * storage, protocol handlers or permissions with it.
 */
export const TAB_PARTITION = "persist:blackwall-web"

/**
 * Permissions are denied unless listed here.
 * clipboard-sanitized-write: plain-text copy (navigator.clipboard.writeText),
 * which Chrome grants every page by default; Blackwall's "Copy" buttons use it.
 */
const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write"])

export function createTabSession(): Session {
  const ses = session.fromPartition(TAB_PARTITION)

  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  ses.setDevicePermissionHandler(() => false)
  ses.setDisplayMediaRequestHandler((_req, callback) => callback({}))

  // Present as plain Chrome: some sites refuse or degrade for "Electron/…" user agents.
  ses.setUserAgent(
    ses
      .getUserAgent()
      .replace(/\sElectron\/\S+/, "")
      .replace(new RegExp(`\\s${app.getName()}\\/\\S+`, "i"), "")
      .replace(/\sblackwall-desktop\/\S+/i, ""),
  )

  // Downloads always ask where to save.
  ses.on("will-download", (_e, item) => {
    item.setSaveDialogOptions({
      title: "Save download",
      defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
    })
  })

  return ses
}

/**
 * Certificate errors are never overridden. Electron already rejects them when
 * no handler calls back with `true`; this handler only makes that explicit.
 */
export function rejectCertificateErrors() {
  app.on("certificate-error", (event, _wc, url, error, _cert, callback) => {
    event.preventDefault()
    console.warn(`[desktop] certificate error for ${url}: ${error}`)
    callback(false)
  })
}

/** Asks before handing a non-web link (mailto:, obsidian:, …) to another app. */
export async function confirmExternal(parent: Electron.BaseWindow | null, url: string): Promise<boolean> {
  const scheme = url.split(":")[0]
  const options: Electron.MessageBoxOptions = {
    type: "question",
    buttons: ["Open", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    message: `Open this ${scheme}: link in another app?`,
    detail: url.length > 300 ? `${url.slice(0, 300)}…` : url,
  }
  const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)
  return response === 0
}
