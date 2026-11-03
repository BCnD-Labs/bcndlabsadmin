/**
 * The one place the app imports from blackwall-admin/shared (the rules the web app and the
 * server use). Re-export only; keep logic in shared/ so native and web cannot drift apart.
 */
export { validWorkspace, emptyWorkspace, mergeWorkspace, same, COLLECTION_KEYS } from "../../../blackwall-admin/shared/workspace.ts"
export type { Collections, WorkspaceSnapshot } from "../../../blackwall-admin/shared/workspace.ts"
export { validPlannerFields, validDateKey, REFLECTION_ITEMS } from "../../../blackwall-admin/shared/planner.ts"
