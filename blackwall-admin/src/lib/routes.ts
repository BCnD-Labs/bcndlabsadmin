/** URLs for records and sections, so links don't hard-code paths. */
export const PRODUCTIVITY = "/productivity"
export const CMS = "/cms"

export const tasksHref = `${PRODUCTIVITY}/tasks`
export const projectsHref = `${PRODUCTIVITY}/projects`
export const learningHref = `${PRODUCTIVITY}/learning`
export const calendarHref = `${PRODUCTIVITY}/calendar`
export const notesHref = `${PRODUCTIVITY}/notes`
export const insightsHref = `${PRODUCTIVITY}/insights`
export const draftsHref = `${CMS}/drafts`
export const siteAnalyticsHref = `${CMS}/analytics`

export const noteHref = (id: string) => `${notesHref}?id=${id}`
export const projectHref = (id: string) => `${projectsHref}/${id}`
export const courseHref = (id: string) => `${learningHref}/${id}`
export const draftHref = (id: string) => `${draftsHref}/${id}`
export const logHref = (date: string) => `${calendarHref}/${date}`
