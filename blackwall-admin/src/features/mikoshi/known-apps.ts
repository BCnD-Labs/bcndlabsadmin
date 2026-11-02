/**
 * Self-hosted apps people commonly put on a launcher. Picking one fills the name, logo
 * (its dashboard-icons slug), what it is and a group; you add the address.
 */
export const KNOWN_APPS: { name: string; logo: string; description: string; group: string }[] = [
  { name: "Portainer", logo: "portainer", description: "Containers", group: "Infrastructure" },
  { name: "Cockpit", logo: "cockpit", description: "Server console", group: "Infrastructure" },
  { name: "Uptime Kuma", logo: "uptime-kuma", description: "Status", group: "Infrastructure" },
  { name: "Caddy", logo: "caddy", description: "Reverse proxy", group: "Infrastructure" },
  { name: "Homarr", logo: "homarr", description: "Dashboard", group: "Infrastructure" },
  { name: "Tailscale", logo: "tailscale", description: "VPN", group: "Infrastructure" },
  { name: "Nextcloud", logo: "nextcloud", description: "Files", group: "Apps" },
  { name: "n8n", logo: "n8n", description: "Automations", group: "Apps" },
  { name: "SiYuan", logo: "siyuan", description: "Notes", group: "Apps" },
  { name: "ntfy", logo: "ntfy", description: "Push alerts", group: "Apps" },
  { name: "AFFiNE", logo: "affine", description: "Docs", group: "Apps" },
  { name: "code-server", logo: "vscode", description: "Code editor", group: "Apps" },
  { name: "Vaultwarden", logo: "vaultwarden", description: "Passwords", group: "Apps" },
  { name: "Home Assistant", logo: "home-assistant", description: "Smart home", group: "Apps" },
  { name: "Grafana", logo: "grafana", description: "Metrics", group: "Infrastructure" },
  { name: "Open WebUI", logo: "open-webui", description: "Chat", group: "AI" },
  { name: "Ollama", logo: "ollama", description: "Models", group: "AI" },
  { name: "Jellyfin", logo: "jellyfin", description: "Media server", group: "Media" },
  { name: "Sonarr", logo: "sonarr", description: "TV", group: "Media" },
  { name: "Radarr", logo: "radarr", description: "Movies", group: "Media" },
  { name: "Prowlarr", logo: "prowlarr", description: "Indexers", group: "Media" },
]

/** dashboard-icons file names are lowercase with dashes: "Uptime Kuma" → "uptime-kuma". */
export const slugify = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64)
