import type { ComponentType } from "react"
import { DevScreen } from "../screens/DevScreen.tsx"
import { FilesScreen } from "../screens/FilesScreen.tsx"
import { HomeScreen } from "../screens/HomeScreen.tsx"
import { InsightsScreen } from "../screens/InsightsScreen.tsx"
import { LearningScreen } from "../screens/LearningScreen.tsx"
import { JournalScreen } from "../screens/JournalScreen.tsx"
import { MikoshiScreen } from "../screens/mikoshi/MikoshiScreen.tsx"
import { NotesScreen } from "../screens/NotesScreen.tsx"
import { PlannerScreen } from "../screens/PlannerScreen.tsx"
import { WebsiteScreen } from "../screens/WebsiteScreen.tsx"
import { SocialScreen } from "../screens/SocialScreen.tsx"
import type { NavigationTarget } from "./target.ts"
import type { ScreenKey } from "./destinations.ts"

/** `focused` is false while a screen that stays mounted in the background (see KEEP_ALIVE) is not the one on show. */
export type ScreenProps = { onOpenSettings: () => void; onNavigate?: (screen: ScreenKey, target?: NavigationTarget) => void; navigationTarget?: NavigationTarget; focused?: boolean; /** Opens Web view on a page, for the things native screens don't do yet. */ onUseWeb?: (path?: string) => void }

/** Every screen the shell can show, by destination key. A new screen needs an entry here and in destinations.ts. */
export const SCREENS: Record<ScreenKey, ComponentType<ScreenProps>> = {
  home: HomeScreen,
  planner: PlannerScreen,
  learning: LearningScreen,
  journal: JournalScreen,
  dev: DevScreen,
  notes: NotesScreen,
  insights: InsightsScreen,
  website: WebsiteScreen,
  social: SocialScreen,
  mikoshi: MikoshiScreen,
  files: FilesScreen,
}

