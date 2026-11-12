import type { Collections } from "../../lib/shared.ts"

type Task = Collections["tasks"][number]
type Course = Collections["courses"][number]

/** Group Home learning rows by course, keeping their existing order. */
export function learningGroups(visible: Task[], courses: Course[]) {
  const names = new Map(courses.map(course => [course.id, course.title]))
  const groups: { id: string; title: string; tasks: Task[] }[] = []
  for (const task of visible) {
    const id = task.courseId ?? ""
    let group = groups.find(item => item.id === id)
    if (!group) {
      group = { id, title: names.get(id) ?? "Other learning", tasks: [] }
      groups.push(group)
    }
    group.tasks.push(task)
  }
  return groups
}
