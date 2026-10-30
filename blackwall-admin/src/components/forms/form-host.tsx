import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useUi } from "@/stores/ui"
import { EventForm } from "./event-form"
import { NoteForm } from "./note-form"
import { ProjectForm } from "./project-form"
import { RepoForm } from "./repo-form"
import { TaskForm } from "./task-form"

/** Single app-wide host for record forms opened via `useUi().openForm`. */
export function FormHost() {
  const form = useUi((s) => s.form)
  const close = useUi((s) => s.closeForm)
  const key = form ? `${form.kind}:${form.id ?? "new"}` : "none"

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" aria-describedby={undefined}>
        {form?.kind === "task" && <TaskForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "event" && <EventForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "note" && <NoteForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "project" && <ProjectForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "repo" && <RepoForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
      </DialogContent>
    </Dialog>
  )
}
