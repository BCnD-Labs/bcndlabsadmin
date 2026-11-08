/**
 * Subtasks ("steps") inside a task, as pure rules. A step may carry a date, which puts it on that
 * day's plan. Nothing here reads the clock; "today" is always a `YYYY-MM-DD` parameter.
 */
import type { Subtask, Task } from "../src/lib/types.ts"

export interface StepRef { task: Task; step: Subtask }

export const stepProgress = (task: Pick<Task, "subtasks">) => {
  const steps = task.subtasks ?? []
  return { done: steps.filter((s) => s.done).length, total: steps.length }
}

/** Every unfinished step of every open task. */
export function openSteps(tasks: Task[]): StepRef[] {
  return tasks.filter((t) => !t.done && t.kind !== "event").flatMap((task) => (task.subtasks ?? []).filter((s) => !s.done).map((step) => ({ task, step })))
}

/** Unfinished steps planned for `date` or earlier (earlier ones are late), oldest first. */
export const stepsDueBy = (tasks: Task[], date: string): StepRef[] =>
  openSteps(tasks).filter((r) => r.step.date && r.step.date <= date).sort((a, b) => a.step.date!.localeCompare(b.step.date!) || a.task.title.localeCompare(b.task.title))

/** Unfinished steps planned for exactly `date`. */
export const stepsOn = (tasks: Task[], date: string): StepRef[] => openSteps(tasks).filter((r) => r.step.date === date)

/** Does the task have any unfinished step with a day? Then it is already planned. */
export const hasPlannedSteps = (task: Task): boolean => !task.done && (task.subtasks ?? []).some((s) => !s.done && !!s.date)
