import type { Category } from "@/components/common/category-icon"
import { HomeTrafficPanel, TrafficMeta } from "./extra-panels"
import type { ComponentType } from "react"
import type { PanelType } from "@/lib/home-slots"
import { CourseworkMeta, CourseworkPanel } from "./coursework-panel"
import { ProductivityMeta, ProductivityPanel } from "./productivity-panel"
import { CalendarMeta, DevelopmentMeta, HomeCalendarPanel, HomeDevelopmentPanel, HomeWebsitePanel, WebsiteMeta } from "./extra-panels"

export interface PanelBodyProps {
  /** Which Home square (0–3) the panel is in. */
  slot: number
}

/**
 * One entry per Home panel type. Adding a type = add its id to PANEL_TYPES
 * (lib/home-slots.ts) and an entry here.
 */
export interface PanelDef {
  label: string
  category?: Category
  /** Header prompt: `❯ tool $ command`. */
  tool: string
  command: string
  /** Right-hand header text; a component so it can read stores. */
  Meta?: ComponentType
  Body: ComponentType<PanelBodyProps>
  bodyClassName?: string
}

/** Retired four-slot layout leftover: an empty position renders nothing. */
const EmptySlot = () => null

export const PANELS: Record<PanelType, PanelDef> = {
  productivity: { label: "Tasks & notes", category: "tasks", tool: "productivity", command: "today", Meta: ProductivityMeta, Body: ProductivityPanel },
  coursework: { label: "Assignments & exams", category: "learning", tool: "learning", command: "upcoming", Meta: CourseworkMeta, Body: CourseworkPanel },
  calendar: { label: "Calendar & agenda", category: "calendar", tool: "calendar", command: "today", Meta: CalendarMeta, Body: HomeCalendarPanel },
  development: { label: "GitHub activity", category: "development", tool: "github", command: "status", Meta: DevelopmentMeta, Body: HomeDevelopmentPanel },
  website: { label: "Website content", category: "website", tool: "site", command: "posts", Meta: WebsiteMeta, Body: HomeWebsitePanel },
  analytics: { label: "Website traffic", category: "analytics", tool: "analytics", command: "traffic", Meta: TrafficMeta, Body: HomeTrafficPanel },
  empty: { label: "Hidden", tool: "slot", command: "empty", Body: EmptySlot },
}
