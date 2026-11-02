import type { CSSProperties } from "react"
import { APPEARANCE_KEYS, type PublicConnection } from "@shared/connections"
import { cn } from "@/lib/utils"
// A curated set of Material Symbols (Rounded, weight 400) for account avatars.
// Imported as URLs and drawn with a CSS mask, so they take any color and no SVG markup is injected.
import person from "@material-symbols/svg-400/rounded/person.svg?url"
import work from "@material-symbols/svg-400/rounded/work.svg?url"
import school from "@material-symbols/svg-400/rounded/school.svg?url"
import code from "@material-symbols/svg-400/rounded/code.svg?url"
import terminal from "@material-symbols/svg-400/rounded/terminal.svg?url"
import rocket from "@material-symbols/svg-400/rounded/rocket_launch.svg?url"
import science from "@material-symbols/svg-400/rounded/science.svg?url"
import home from "@material-symbols/svg-400/rounded/home.svg?url"
import star from "@material-symbols/svg-400/rounded/star.svg?url"
import bolt from "@material-symbols/svg-400/rounded/bolt.svg?url"
import games from "@material-symbols/svg-400/rounded/sports_esports.svg?url"
import pub from "@material-symbols/svg-400/rounded/public.svg?url"
import cloud from "@material-symbols/svg-400/rounded/cloud.svg?url"
import shield from "@material-symbols/svg-400/rounded/shield.svg?url"
import group from "@material-symbols/svg-400/rounded/group.svg?url"
import pets from "@material-symbols/svg-400/rounded/pets.svg?url"

export const ACCOUNT_ICONS = { person, work, school, code, terminal, rocket_launch: rocket, science, home, star, bolt, sports_esports: games, public: pub, cloud, shield, group, pets } as const
export type AccountIconName = keyof typeof ACCOUNT_ICONS

/** Flat Material hues. Order is also the default assignment order for new accounts. */
export const ACCOUNT_COLORS = ["#4285f4", "#a142f4", "#fa7b17", "#24c1e0", "#f538a0", "#34a853", "#fbbc04", "#ea4335", "#9aa0a6"] as const
const DEFAULT_ICONS: AccountIconName[] = ["person", "work", "school", "code", "rocket_launch"]

export interface AccountLook {
  color: string
  icon: AccountIconName
}

const isIcon = (v: string | undefined): v is AccountIconName => !!v && Object.hasOwn(ACCOUNT_ICONS, v)
const isColor = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)

/** A connection's chosen look, or a stable default from its position among same-provider connections. */
export function accountLook(c: Pick<PublicConnection, "config"> | undefined, index = 0): AccountLook {
  const color = c?.config[APPEARANCE_KEYS.color]
  const icon = c?.config[APPEARANCE_KEYS.icon]
  return {
    color: isColor(color) ? color : ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
    icon: isIcon(icon) ? icon : DEFAULT_ICONS[index % DEFAULT_ICONS.length],
  }
}

/** A Material Symbol in any color (CSS mask over currentColor). */
export function MaterialIcon({ name, className, style }: { name: AccountIconName; className?: string; style?: CSSProperties }) {
  const url = `url("${ACCOUNT_ICONS[name]}")`
  return <span aria-hidden className={cn("inline-block shrink-0 bg-current", className)} style={{ WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat`, ...style }} />
}

/** Round avatar: the account's icon on a tint of its color. */
export function AccountAvatar({ look, size = 36, label }: { look: AccountLook; size?: number; label?: string }) {
  return (
    <span role={label ? "img" : undefined} aria-label={label} title={label} className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, color: look.color, background: `color-mix(in srgb, ${look.color} 16%, transparent)` }}>
      <MaterialIcon name={look.icon} style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}

/** Small tinted chip: icon + account name. */
export function AccountChip({ look, name, className }: { look: AccountLook; name: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium", className)} style={{ color: look.color, background: `color-mix(in srgb, ${look.color} 15%, transparent)` }}>
      <MaterialIcon name={look.icon} className="size-3.5" />
      <span className="truncate">{name}</span>
    </span>
  )
}
