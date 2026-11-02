import { useEffect } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { usePrefs } from "@/stores/prefs"

/** Phone-sized screens only: the mobile view never changes the tablet or desktop layout. */
export const PHONE_QUERY = "(max-width: 767px)"

/**
 * True when the dedicated mobile view should render: the setting is "mobile" and the screen is
 * phone-sized. Escape hatch: opening any address with ?layout=responsive switches the setting
 * back to the responsive layout (for when the mobile view itself is broken).
 */
export function useMobileView() {
  const mode = usePrefs((s) => s.layoutMode)
  const phone = useMediaQuery(PHONE_QUERY)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("layout") !== "responsive") return
    usePrefs.getState().set({ layoutMode: "responsive" })
    url.searchParams.delete("layout")
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
  }, [])
  return mode === "mobile" && phone
}
