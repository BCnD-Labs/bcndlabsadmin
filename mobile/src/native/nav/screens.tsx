import type { ComponentType } from "react"
import { DevScreen } from "../screens/DevScreen.tsx"
import { HomeScreen } from "../screens/HomeScreen.tsx"
import { InsightsScreen } from "../screens/InsightsScreen.tsx"
import { LearningScreen } from "../screens/LearningScreen.tsx"
import { NotesScreen } from "../screens/NotesScreen.tsx"
import { PlannerScreen } from "../screens/PlannerScreen.tsx"
import { WebsiteScreen } from "../screens/WebsiteScreen.tsx"
import type { ScreenKey } from "./destinations.ts"

export type ScreenProps = { onOpenSettings: () => void }

/** Every screen the shell can show, by destination key. A new screen needs an entry here and in destinations.ts. */
export const SCREENS: Record<ScreenKey, ComponentType<ScreenProps>> = {
  home: HomeScreen,
  planner: PlannerScreen,
  learning: LearningScreen,
  dev: DevScreen,
  notes: NotesScreen,
  insights: InsightsScreen,
  website: WebsiteScreen,
}
