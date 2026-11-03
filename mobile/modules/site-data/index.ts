import { requireOptionalNativeModule } from "expo"

type SiteDataNative = { clearAll(): Promise<boolean> }

// Optional so the JS still runs where the module isn't compiled in (for example Expo Go):
// there, clearing falls back to what page JavaScript can do.
const native = requireOptionalNativeModule<SiteDataNative>("SiteData")

export const nativeSiteDataAvailable = native != null

/** Clears all WebView cookies and web storage. Returns false if the native module isn't available. */
export async function clearNativeSiteData(): Promise<boolean> {
  if (!native) return false
  return native.clearAll()
}
