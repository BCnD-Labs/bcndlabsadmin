import { offsetKey } from "@/lib/dates"
import type {
  CalendarEvent,
  Draft,
  Note,
  Project,
  RepoLink,
  Task,
} from "@/lib/types"

/**
 * Starter records written to local storage the first time Blackwall loads.
 * They are ordinary local records — edit or delete them freely, or clear the
 * workspace from Settings → Appearance. Dates are relative to the first load.
 */
export function createSeed() {
  const now = new Date()
  const ago = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString()

  const projects: Project[] = [
    {
      id: "prj_website",
      name: "bcndlabs website",
      code: "WEB",
      status: "active",
      description:
        "Public hub for bcndlabs: project pages, writing, and contact.",
      color: "teal",
      createdAt: ago(60 * 24 * 40),
      updatedAt: ago(35),
    },
    {
      id: "prj_blackwall",
      name: "Blackwall",
      code: "BWL",
      status: "active",
      description:
        "Internal workspace for projects, content, applications and operations.",
      color: "amber",
      createdAt: ago(60 * 24 * 3),
      updatedAt: ago(12),
    },
    {
      id: "prj_mikoshi",
      name: "Mikoshi monitoring",
      code: "MKS",
      status: "planned",
      description:
        "Service health for the website, Cloudflare DNS and Azure resources.",
      color: "slate",
      createdAt: ago(60 * 24 * 20),
      updatedAt: ago(60 * 26),
    },
    {
      id: "prj_soulkiller",
      name: "Soulkiller DB",
      code: "SKR",
      status: "paused",
      description:
        "Personal SQL-backed data store. Future backend for Blackwall records.",
      color: "red",
      createdAt: ago(60 * 24 * 60),
      updatedAt: ago(60 * 24 * 9),
    },
  ]

  const task = (
    id: string,
    title: string,
    priority: Task["priority"],
    due: number | undefined,
    projectId?: string,
    status: Task["status"] = "todo",
    updatedMinutesAgo = 120,
  ): Task => ({
    id,
    title,
    priority,
    due: due === undefined ? undefined : offsetKey(due),
    projectId,
    status,
    createdAt: ago(updatedMinutesAgo + 600),
    updatedAt: ago(updatedMinutesAgo),
    completedAt: status === "done" ? ago(updatedMinutesAgo) : undefined,
  })

  const tasks: Task[] = [
    task("tsk_1", "Fix contact form validation on mobile", "urgent", -1, "prj_website"),
    task("tsk_2", "Review navigation rail hover delays", "high", 0, "prj_blackwall", "in-progress", 20),
    task("tsk_3", "Write project page copy for Blackwall", "medium", 0, "prj_website"),
    task("tsk_4", "Decide analytics provider for the website", "high", 2, "prj_website"),
    task("tsk_5", "Sketch Mikoshi health check list", "medium", 4, "prj_mikoshi"),
    task("tsk_6", "Renew Cloudflare domain", "high", 9, "prj_mikoshi"),
    task("tsk_7", "Outline Soulkiller schema for tasks & notes", "low", 14, "prj_soulkiller"),
    task("tsk_8", "Set up repository for blackwall-admin", "medium", -2, "prj_blackwall", "done", 60 * 20),
    task("tsk_9", "Collect inspiration for retro pixel details", "low", undefined, "prj_blackwall"),
  ]

  const event = (
    id: string,
    title: string,
    day: number,
    start?: string,
    end?: string,
    projectId?: string,
    location?: string,
  ): CalendarEvent => ({
    id,
    title,
    date: offsetKey(day),
    start,
    end,
    projectId,
    location,
    createdAt: ago(600),
    updatedAt: ago(600),
  })

  const events: CalendarEvent[] = [
    event("evt_1", "Deep work: Blackwall home screen", 0, "09:30", "11:30", "prj_blackwall"),
    event("evt_2", "Website content pass", 0, "14:00", "15:00", "prj_website"),
    event("evt_3", "Weekly planning", 1, "10:00", "10:30"),
    event("evt_4", "Cloudflare renewal window opens", 3, undefined, undefined, "prj_mikoshi"),
    event("evt_5", "Ship website project pages", 6, undefined, undefined, "prj_website"),
  ]

  const notes: Note[] = [
    {
      id: "nte_1",
      title: "Blackwall principles",
      body:
        "Local first. Honest data labels. Dense but readable.\nEvery screen should answer: what needs me next?",
      kind: "note",
      pinned: true,
      projectId: "prj_blackwall",
      createdAt: ago(60 * 30),
      updatedAt: ago(45),
    },
    {
      id: "nte_2",
      title: "Website theme tokens",
      body:
        "Teal raised borders, amber actions, pixel type for headings.\nBlackwall uses a softened graphite version.",
      kind: "reference",
      pinned: true,
      projectId: "prj_website",
      createdAt: ago(60 * 50),
      updatedAt: ago(60 * 5),
    },
    {
      id: "nte_3",
      title: "Integration questions",
      body:
        "Which analytics provider? Calendar source? Where will the server-side token boundary live (worker vs small API)?",
      kind: "note",
      pinned: true,
      createdAt: ago(60 * 70),
      updatedAt: ago(60 * 8),
    },
    {
      id: "nte_4",
      title: "shadcn/ui blocks",
      body: "Dashboard and sidebar patterns used as a starting point.",
      kind: "link",
      url: "https://ui.shadcn.com/blocks",
      pinned: false,
      projectId: "prj_blackwall",
      createdAt: ago(60 * 24 * 2),
      updatedAt: ago(60 * 24 * 2),
    },
    {
      id: "nte_5",
      title: "Mikoshi: services to watch",
      body: "bcndlabs website\nCloudflare domain + DNS\nAzure services\nGitHub repositories",
      kind: "note",
      pinned: false,
      projectId: "prj_mikoshi",
      createdAt: ago(60 * 24 * 4),
      updatedAt: ago(60 * 24 * 1),
    },
  ]

  const repos: RepoLink[] = [
    {
      id: "rep_website",
      fullName: "bcndlabs/website",
      url: "https://github.com/bcndlabs/website",
      projectId: "prj_website",
      productionUrl: "https://bcndlabs.com",
      createdAt: ago(60 * 24 * 10),
      updatedAt: ago(60 * 24 * 10),
    },
    {
      id: "rep_blackwall",
      fullName: "bcndlabs/blackwall-admin",
      url: "https://github.com/bcndlabs/blackwall-admin",
      projectId: "prj_blackwall",
      previewUrl: "http://localhost:5173",
      createdAt: ago(60 * 24 * 2),
      updatedAt: ago(60 * 24 * 2),
    },
  ]

  const drafts: Draft[] = [
    {
      id: "drf_1",
      title: "Introducing Blackwall",
      slug: "introducing-blackwall",
      kind: "post",
      status: "drafting",
      excerpt: "Why bcndlabs needed a workspace instead of another CMS.",
      body:
        "## Why\n\nThe website is the public hub. Blackwall is where the work happens.\n\n## What's next\n\n- Connect GitHub\n- Pick an analytics provider",
      projectId: "prj_blackwall",
      createdAt: ago(60 * 24),
      updatedAt: ago(25),
    },
    {
      id: "drf_2",
      title: "Projects",
      slug: "projects",
      kind: "page",
      status: "review",
      excerpt: "Index of current bcndlabs projects.",
      body: "A short list of what bcndlabs is building right now.",
      projectId: "prj_website",
      createdAt: ago(60 * 24 * 6),
      updatedAt: ago(60 * 3),
    },
    {
      id: "drf_3",
      title: "Notes on running a one-person lab",
      slug: "notes-on-running-a-one-person-lab",
      kind: "post",
      status: "idea",
      excerpt: "",
      body: "",
      createdAt: ago(60 * 24 * 12),
      updatedAt: ago(60 * 24 * 12),
    },
  ]

  return { projects, tasks, events, notes, repos, drafts }
}
