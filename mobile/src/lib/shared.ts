/**
 * The one place the app imports from blackwall-admin/shared (the rules the web app and the
 * server use). Re-export only; keep logic in shared/ so native and web cannot drift apart.
 */
export { validWorkspace, emptyWorkspace, mergeWorkspace, same, COLLECTION_KEYS } from "../../../blackwall-admin/shared/workspace.ts"
export type { Collections, WorkspaceSnapshot } from "../../../blackwall-admin/shared/workspace.ts"
export { validPlannerFields, validDateKey, REFLECTION_ITEMS } from "../../../blackwall-admin/shared/planner.ts"
export { defaultMakeId, toggleTask, createTask, updateTask, removeTask, toggleStar, setTaskStatus, applyFocusPlan, addSubtasks, updateSubtask, toggleSubtask, removeSubtask, removeCourseTopic, saveJournal, saveJournalSections, saveJournalItem, saveJournalLegacyText, moveJournal, createNote, updateNote, removeNote, togglePin, createCourse, updateCourse, createService, updateService, removeService } from "../../../blackwall-admin/shared/records.ts"
export type { NewTask, NewNote, NewCourse, NewService } from "../../../blackwall-admin/shared/records.ts"
export { GROUP_ORDER, TASK_TABS, compareTasks, groupOf, inTab, isForToday, isOverdue, matchesSearch, normalizeSearch, taskGroups, taskRows, parseQuickAdd } from "../../../blackwall-admin/shared/task-rules.ts"
export type { TaskGroup, TaskTab } from "../../../blackwall-admin/shared/task-rules.ts"
export { postAccounts, postState } from "../../../blackwall-admin/shared/social.ts"
export type { PostState } from "../../../blackwall-admin/shared/social.ts"
export { addDaysToKey, dayNumber, daysBetween, weekdayOfKey } from "../../../blackwall-admin/shared/date-keys.ts"
export { EFFORTS, MEETING_KINDS, WEEKDAY_LABELS, WORK_STATUSES, daysLabel, dueWords, isMeetingId, leadDays, meetingCourseId, meetingEvents, meetingKindLabel, meetingsForDay, minutesOf, planWeek, startBy, statusLabel, statusOf, studyPlan, todayPlan, topicUsage, weekLoad, PLAN_PER_DAY } from "../../../blackwall-admin/shared/learning.ts"
export type { ClassMeeting, CourseTopic, Subtask, StudyProposal, TopicUse, DayLoad, MeetingKind, WorkEffort, WorkStatus, MeetingOccurrence, PlanProposal, TodayPlan, WeekDay } from "../../../blackwall-admin/shared/learning.ts"
export { stepProgress, openSteps, stepsDueBy, stepsOn, hasPlannedSteps } from "../../../blackwall-admin/shared/steps.ts"
export type { StepRef } from "../../../blackwall-admin/shared/steps.ts"
export { MAX_RECORD_LINKS as MAX_LINKS, hasLink, modulesOf, noteTitle as noteLinkTitle, notesOfTask, setNoteTaskLinks, tasksLinkingTask, tasksOfNote, withLink } from "../../../blackwall-admin/shared/links.ts"
export { canEditFile, extensionOf, formatSize, isOffice, isTextFile, joinPath, parentOf, TEXT_LIMIT } from "../../../blackwall-admin/shared/storage.ts"
export type { EditingCreator, EditingInfo, FolderListing, StorageEntry, StorageInfo } from "../../../blackwall-admin/shared/storage.ts"
export { ICON_SLUG } from "../../../blackwall-admin/shared/icons.ts"
