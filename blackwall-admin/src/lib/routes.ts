/** URLs for records and sections, so links don't hard-code paths. */
export const PRODUCTIVITY = "/productivity"
export const DEVELOPMENT = "/development"
export const JOURNAL = "/journal"
export const journalHref = JOURNAL
export const CMS = "/cms"
export const MIKOSHI = "/mikoshi"
export const SOCIAL = "/social"
export const socialHref = SOCIAL
export const socialPostHref = (id: string) => `${SOCIAL}/${id}`
export const launcherHref = MIKOSHI
export const mikoshiStatusHref = `${MIKOSHI}/status`
export const mikoshiStorageHref = `${MIKOSHI}/storage`

/** Productivity → Planner holds tasks, the calendar with the daily log, and notes on one page. */
export const plannerHref = PRODUCTIVITY
export const tasksHref = plannerHref
export const notesHref = `${plannerHref}#notes`
export const calendarHref = `${plannerHref}#day`
export const projectsHref = `${PRODUCTIVITY}/projects`
export const learningHref = `${PRODUCTIVITY}/learning`
export const insightsHref = `${PRODUCTIVITY}/insights`

export const cmsPagesHref = CMS
export const postsHref = `${CMS}/posts`
export const draftsHref = `${CMS}/posts?show=drafts`
export const formsHref = `${CMS}/forms`
export const siteSettingsHref = `${CMS}/settings`
export const sitePageHref = (id: string) => `${CMS}/pages/${id}`
export const mediaHref = `${CMS}/media`
export const siteAnalyticsHref = `${CMS}/analytics`

export const noteHref = (id: string) => `${plannerHref}?note=${id}#notes`
export const logHref = (date: string) => `${plannerHref}?date=${date}#day`
export const projectHref = (id: string) => `${projectsHref}/${id}`
export const courseHref = (id: string) => `${learningHref}/${id}`
/** A post (local draft id) in the CMS editor. */
export const draftHref = (id: string) => `${CMS}/posts/${id}`
