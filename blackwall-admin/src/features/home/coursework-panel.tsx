import { ArrowRight, GraduationCap } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PanelFooter } from "@/components/common/panel"
import { CourseworkRow } from "@/features/learning/coursework"
import { compareCoursework } from "@/features/learning/learning-utils"
import { daysUntil } from "@/lib/dates"
import { learningHref } from "@/lib/routes"
import { useCourseMap, useWorkspace } from "@/stores/workspace"

/** Header meta: "N due this week". */
export function CourseworkMeta() {
  const n = useWorkspace((s) => s.tasks.filter((t) => { if (!t.courseId || t.done || !t.due) return false; const d = daysUntil(t.due); return d >= 0 && d <= 7 }).length)
  return <>{n} due this week</>
}

/** Home square: open coursework that's overdue or due in the next 14 days, across courses. */
export function CourseworkPanel() {
  const tasks = useWorkspace((s) => s.tasks)
  const courses = useCourseMap()
  const items = tasks
    .filter((t) => t.courseId && courses.has(t.courseId) && !t.done && t.due && daysUntil(t.due) <= 14)
    .sort(compareCoursework)
    .slice(0, 4)

  if (!courses.size) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No courses yet"
        className="items-start text-left"
        action={
          <Button variant="outline" asChild>
            <Link to={learningHref}>Go to Learning</Link>
          </Button>
        }
      >
        Add a course to see its assignments, exams and events here.
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col">
      {items.length ? (
        <ul className="max-h-72 min-h-0 overflow-y-auto">
          {items.map((t) => (
            <CourseworkRow key={t.id} task={t} course={courses.get(t.courseId!)} showCourse />
          ))}
        </ul>
      ) : (
        <EmptyState icon={GraduationCap} title="Nothing due in the next two weeks" className="flex-1" />
      )}
      <PanelFooter>
        <Link to={learningHref} className="bw-action-link">
          All courses <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </PanelFooter>
    </div>
  )
}
