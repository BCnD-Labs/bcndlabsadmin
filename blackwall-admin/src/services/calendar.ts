import type { CalendarService } from "./types"

/** No calendar provider is connected; Blackwall shows local events only. */
export const unconnectedCalendar: CalendarService = {
  source: { status: "not-connected", provider: "No provider selected" },
  async listEvents() {
    return []
  },
}
