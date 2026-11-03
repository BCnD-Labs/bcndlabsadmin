import * as FileSystem from "expo-file-system/legacy"
import * as IntentLauncher from "expo-intent-launcher"
import { Linking } from "react-native"
import { percent, type UpdateManifest } from "./app-update.ts"

export type InstallResult = { ok: true } | { ok: false; reason: string }

const VIEW = "android.intent.action.VIEW"
const APK_TYPE = "application/vnd.android.package-archive"
const FLAG_GRANT_READ_URI_PERMISSION = 1
const FLAG_ACTIVITY_NEW_TASK = 268435456

/**
 * Downloads the new build into the app's cache (reporting whole-percent progress), checks its
 * MD5 when the manifest gives one, then hands it to Android's installer. Android shows its own
 * "Update this app?" prompt (and, the first time, asks to allow installs from Blackwall).
 * If the in-app install can't start, the download address is opened in the browser instead.
 * Android only accepts the update if it is signed with the same key as the installed app.
 */
export async function downloadAndInstall(manifest: UpdateManifest, url: string, onProgress: (percent: number) => void): Promise<InstallResult> {
  const dir = FileSystem.cacheDirectory
  if (!dir) return { ok: false, reason: "This phone has no space to save the download." }
  const target = `${dir}${manifest.file}`
  try {
    await FileSystem.deleteAsync(target, { idempotent: true })
    const job = FileSystem.createDownloadResumable(url, target, {}, (p) => onProgress(percent(p.totalBytesWritten, p.totalBytesExpectedToWrite)))
    const done = await job.downloadAsync()
    if (!done || done.status !== 200) {
      await FileSystem.deleteAsync(target, { idempotent: true })
      return { ok: false, reason: `The server answered ${done?.status ?? "nothing"} for the download.` }
    }
    onProgress(100)
    if (manifest.md5) {
      const info = await FileSystem.getInfoAsync(target, { md5: true })
      if (!info.exists || info.md5?.toLowerCase() !== manifest.md5) {
        await FileSystem.deleteAsync(target, { idempotent: true })
        return { ok: false, reason: "The download was damaged. Try again." }
      }
    }
  } catch {
    return { ok: false, reason: "The download failed. Check the connection and try again." }
  }
  try {
    const data = await FileSystem.getContentUriAsync(target)
    await IntentLauncher.startActivityAsync(VIEW, { data, type: APK_TYPE, flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK })
    return { ok: true }
  } catch {
    void Linking.openURL(url).catch(() => {})
    return { ok: false, reason: "Couldn't open the installer here, so the download opened in your browser instead." }
  }
}
