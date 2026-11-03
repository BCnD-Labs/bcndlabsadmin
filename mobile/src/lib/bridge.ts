import { originOf } from "./url.ts"

/**
 * The only page → app message: whether a pull-down that starts here may refresh.
 * Sent on every touchstart by PULL_GUARD_SCRIPT. Pull-to-refresh is allowed only when
 * the page is scrolled to the top, nothing scrollable under the finger is scrolled
 * down, and no dialog/sheet is open, so a pull inside a dialog or a scrolled list
 * never reloads the page and loses what you were doing.
 */
export const PULL_MESSAGE = { allow: "bw:pull:1", deny: "bw:pull:0" } as const

export const PULL_GUARD_SCRIPT = `(() => {
  if (window.__bwPullGuard) return; window.__bwPullGuard = true;
  const post = (ok) => { try { window.ReactNativeWebView.postMessage(ok ? "${PULL_MESSAGE.allow}" : "${PULL_MESSAGE.deny}") } catch (e) {} };
  const scrolled = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollTop > 0) return true;
    }
    return false;
  };
  const modalOpen = () => !!document.querySelector('[aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"]');
  window.addEventListener("touchstart", (e) => {
    const top = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    post(top && !modalOpen() && !scrolled(e.target));
  }, { passive: true, capture: true });
})(); true;`

/** Accepts only the exact pull message, and only from a page on your Blackwall origin. */
export function readPullMessage(data: unknown, pageUrl: string, allowedOrigin: string): boolean | null {
  if (originOf(pageUrl) !== allowedOrigin) return null
  if (data === PULL_MESSAGE.allow) return true
  if (data === PULL_MESSAGE.deny) return false
  return null
}
