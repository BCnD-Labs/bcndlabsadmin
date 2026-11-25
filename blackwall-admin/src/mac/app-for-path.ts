/** The desktop window each page opens in. A new section needs a line here, or it lands in Home. */
export function appForPath(path: string) {
  if (path.startsWith("/journal")) return "journal"
  if (path.startsWith("/productivity/learning")) return "learning"
  if (path.startsWith("/productivity/projects")) return "projects"
  if (path.startsWith("/work/projects")) return "projects"
  if (path.startsWith("/productivity/insights") || path === "/analytics") return "home"
  if (path.startsWith("/productivity") || path.startsWith("/work") || path.startsWith("/notes") || path.startsWith("/knowledge")) return "planner_app"
  if (path.startsWith("/development")) return "projects"
  if (path.startsWith("/assets")) return "website"
  if (path.startsWith("/mail")) return "mail"
  if (path.startsWith("/files")) return "files"
  if (path.startsWith("/docs")) return "files"
  if (path.startsWith("/cms") || path.startsWith("/content")) return "website"
  if (path.startsWith("/social")) return "website"
  if (path.startsWith("/mikoshi")) return "mikoshi"
  if (path.startsWith("/settings")) return "settings"
  return "home"
}
