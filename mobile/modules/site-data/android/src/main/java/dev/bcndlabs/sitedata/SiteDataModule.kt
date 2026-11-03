package dev.bcndlabs.sitedata

import android.webkit.CookieManager
import android.webkit.WebStorage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Clears what the app's WebView keeps for websites: all cookies (including the
 * HttpOnly sign-in cookie, which page JavaScript can't remove) and all web storage
 * (local storage, IndexedDB, Cache Storage and service workers, via WebStorage).
 * The HTTP cache is cleared separately with WebView.clearCache(true).
 */
class SiteDataModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SiteData")

    AsyncFunction("clearAll") { promise: Promise ->
      WebStorage.getInstance().deleteAllData()
      val cookies = CookieManager.getInstance()
      cookies.removeAllCookies { _ ->
        cookies.flush()
        promise.resolve(true)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
