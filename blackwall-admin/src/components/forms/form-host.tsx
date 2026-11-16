import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useUi } from "@/stores/ui"
import { CourseForm } from "./course-form"
import { ServiceForm } from "@/features/mikoshi/service-form"
import { NewPageForm, NewSiteForm, PageFromTaskForm, SiteFormForm } from "@/features/cms/cms-forms"
import { SocialAccountForm } from "@/features/social/social-ui"
import { NoteForm } from "./note-form"
import { ProjectForm } from "./project-form"
import { RepoForm } from "./repo-form"
import { TaskForm } from "./task-form"

/** Single app-wide host for record forms opened via `useUi().openForm`. */
export function FormHost() {
  const mac = document.documentElement.dataset.runtime === "mac-native"
  const form = useUi((s) => s.form)
  const close = useUi((s) => s.closeForm)
  const key = form ? `${form.kind}:${form.id ?? "new"}` : "none"

  return (
    <Dialog open={!!form} modal={!mac} onOpenChange={(o) => !o && close()}>
      <DialogContent showOverlay={!mac} onInteractOutside={event => { if (mac) event.preventDefault() }} className={`mac-record-editor ${form?.kind === "course" || form?.kind === "siteForm" || form?.kind === "site" ? "gap-0 p-0 sm:max-w-xl" : "gap-0 p-0 sm:max-w-lg"}`} aria-describedby={undefined}>
        {form?.kind === "task" && <TaskForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "note" && <NoteForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "project" && <ProjectForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "repo" && <RepoForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "course" && <CourseForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "service" && <ServiceForm key={key} id={form.id} defaults={form.defaults} onDone={close} />}
        {form?.kind === "site" && <NewSiteForm key={key} onDone={close} />}
        {form?.kind === "sitePage" && <NewPageForm key={key} onDone={close} />}
        {form?.kind === "pageFromTask" && <PageFromTaskForm key={key} taskId={form.id} onDone={close} />}
        {form?.kind === "siteForm" && <SiteFormForm key={key} id={form.id} onDone={close} />}
        {form?.kind === "socialAccount" && <SocialAccountForm key={key} id={form.id} onDone={close} />}
      </DialogContent>
    </Dialog>
  )
}
