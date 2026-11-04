import { defaultMakeId, type Collections } from "../../lib/shared.ts"

type Project = Collections["projects"][number]
export type ProjectFields = Pick<Project, "name" | "code" | "status" | "color" | "description">

/** Apply a project edit and repo assignment together, preserving unrelated workspace records. */
export function saveProjectRecord(data: Collections, previousId: string | undefined, fields: ProjectFields, linkedIds: readonly string[], options: { id?: string; now?: string } = {}): Collections {
  if (previousId && !data.projects.some(project => project.id === previousId)) throw new Error("This project no longer exists.")
  const id = previousId ?? options.id ?? defaultMakeId("prj")
  const now = options.now ?? new Date().toISOString()
  const linked = new Set(linkedIds)
  const projects = previousId
    ? data.projects.map(project => project.id === id ? { ...project, ...fields, updatedAt: now } : project)
    : [{ ...fields, id, createdAt: now, updatedAt: now }, ...data.projects]
  const repos = data.repos.map(repo => {
    if (linked.has(repo.id) && !repo.projectId) return { ...repo, projectId: id, updatedAt: now }
    if (!linked.has(repo.id) && repo.projectId === id) return { ...repo, projectId: undefined, updatedAt: now }
    return repo
  })
  return { ...data, projects, repos }
}
