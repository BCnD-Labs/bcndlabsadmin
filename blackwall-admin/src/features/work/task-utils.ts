import * as rules from "@shared/task-rules"
import { todayKey } from "@/lib/dates"
import type { Task } from "@/lib/types"

/** The pure rules live in shared/task-rules.ts (also used by the native apps); these add today's date. */
export { GROUP_ORDER, TASK_FILTERS, compareTasks } from "@shared/task-rules"
export type { TaskFilter, TaskGroup } from "@shared/task-rules"

export const isOverdue = (t: Task) => rules.isOverdue(t, todayKey())

/** Open tasks that are overdue, due today, or starred. */
export const isForToday = (t: Task) => rules.isForToday(t, todayKey())

export const matchesFilter = (t: Task, f: rules.TaskFilter) => rules.matchesFilter(t, f, todayKey())

export const groupOf = (t: Task) => rules.groupOf(t, todayKey())
