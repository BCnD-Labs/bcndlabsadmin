import { useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { PROVIDERS, type ProviderId } from "@shared/connections"
import { useUi, type SettingsSection } from "@/stores/ui"

const SECTION: Record<string, SettingsSection> = {
  general: "general",
  dashboard: "dashboard",
  appearance: "appearance",
  connections: "connections",
  integrations: "connections",
  server: "server",
  shortcuts: "shortcuts",
  navigation: "shortcuts",
}

/** Old /settings/... links and bookmarks: open the settings modal over Home. */
export function SettingsRoute() {
  const { section = "general" } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const add = params.get("add")
    useUi.getState().openSettings(SECTION[section] ?? "general", PROVIDERS.some((p) => p.id === add) ? (add as ProviderId) : undefined)
    navigate("/", { replace: true })
  }, [section, params, navigate])
  return null
}
