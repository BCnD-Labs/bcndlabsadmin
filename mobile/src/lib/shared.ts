/**
 * The one place the app imports from blackwall-admin/shared (the rules the web app and the
 * server use). Re-export only; keep logic in shared/ so native and web cannot drift apart.
 */
export { validWorkspace, emptyWorkspace, mergeWorkspace, same, COLLECTION_KEYS } from "../../../blackwall-admin/shared/workspace.ts"
export type { Collections, WorkspaceSnapshot } from "../../../blackwall-admin/shared/workspace.ts"
export { validPlannerFields, validDateKey, REFLECTION_ITEMS } from "../../../blackwall-admin/shared/planner.ts"
export { toggleTask, createTask, updateTask, removeTask, toggleStar, saveJournal, moveJournal, createNote, updateNote, removeNote, togglePin } from "../../../blackwall-admin/shared/records.ts"
export type { NewTask, NewNote } from "../../../blackwall-admin/shared/records.ts"
export { GROUP_ORDER, TASK_TABS, compareTasks, groupOf, inTab, isOverdue, matchesSearch, normalizeSearch, taskGroups, taskRows, parseQuickAdd } from "../../../blackwall-admin/shared/task-rules.ts"
export type { TaskGroup, TaskTab } from "../../../blackwall-admin/shared/task-rules.ts"
export { addDaysToKey, dayNumber, daysBetween, weekdayOfKey } from "../../../blackwall-admin/shared/date-keys.ts"
