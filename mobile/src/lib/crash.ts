/**
 * Words for the crash fallback. Pure (tests load it in plain node).
 * The detail line helps a bug report without showing addresses: web and tailnet URLs are replaced and the text is cut short.
 */
export const CRASH_DETAIL_MAX = 160

export function crashDetail(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : "Unknown error"
  const clean = raw
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[address]")
    .replace(/\b[\w-]+(\.[\w-]+)*\.ts\.net\b/gi, "[address]")
    .replace(/\s+/g, " ")
    .trim()
  return clean.length > CRASH_DETAIL_MAX ? `${clean.slice(0, CRASH_DETAIL_MAX - 1)}…` : clean || "Unknown error"
}

/** The heading for a crash: one screen (the rest of the app still works) or the whole native app. */
export function crashTitle(scope: "screen" | "app", screenLabel?: string): string {
  return scope === "screen" ? `${screenLabel ?? "This screen"} hit a problem` : "The native app hit a problem"
}
