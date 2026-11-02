import { Inbox, MailCheck, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { GridItem, WorkspaceGrid } from "@/components/common/workspace-grid"
import { timeAgo } from "@/lib/dates"
import { useUi } from "@/stores/ui"
import { useWorkspace } from "@/stores/workspace"
import { SiteSwitcher } from "./site-switcher"
import { useCurrentSite } from "./use-cms"

/** Website → Forms: the reusable form library, and where submissions land. */
export function CmsFormsPage() {
  const forms = useWorkspace((s) => s.forms)
  const pages = useWorkspace((s) => s.pages)
  const sites = useWorkspace((s) => s.sites)
  const site = useCurrentSite()
  const openForm = useUi((s) => s.openForm)
  const usedOn = (id: string) => pages.filter((p) => JSON.stringify(p.sections).includes(id)).map((p) => `${sites.find((s) => s.id === p.siteId)?.name ?? "?"} · ${p.title}`)

  return (
    <>
      <PageHeader title="Website" badge={<SiteSwitcher />} actions={<Button onClick={() => openForm({ kind: "siteForm" })}><Plus /> Form</Button>} />
      <WorkspaceGrid>
        <GridItem span={2}>
          <Panel category="website" title="Form library" meta="reusable on any site">
            {forms.length ? (
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="text-[11px] text-faint"><tr><th className="py-2 pl-3.5 font-normal">Form</th><th className="font-normal">Used on</th><th className="hidden w-24 font-normal sm:table-cell">Edited</th></tr></thead>
                <tbody>
                  {forms.map((f) => {
                    const used = usedOn(f.id)
                    return (
                      <tr key={f.id} className="cursor-pointer border-t border-line-soft hover:bg-raised" onClick={() => openForm({ kind: "siteForm", id: f.id })}>
                        <td className="py-2 pl-3.5"><b className="text-ink">{f.name}</b><span className="block truncate text-[11.5px] text-muted-foreground">{f.fields.map((x) => x.label).join(" · ")}</span></td>
                        <td className="truncate text-xs text-muted-foreground">{used.length ? used.join(", ") : "Not on a page yet"}</td>
                        <td className="hidden text-xs text-muted-foreground sm:table-cell">{timeAgo(f.updatedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={MailCheck} title="No forms yet" action={<Button variant="outline" onClick={() => openForm({ kind: "siteForm" })}><Plus /> Form</Button>}>
                Make a contact form, a comment form or a sign-up once, then add it to any page with the Form block.
              </EmptyState>
            )}
            <p className="border-t border-line-soft px-3.5 py-2.5 text-[11.5px] text-muted-foreground">Every form asks for an email; a submission only counts after the sender clicks the link in a verification email. Turnstile blocks bots.</p>
          </Panel>
        </GridItem>
        <GridItem span={2}>
          <Panel category="website" title="Submissions">
            <EmptyState icon={Inbox} title={site?.formEndpoint ? "No submissions yet" : "Submissions need the form receiver"}>
              {site?.formEndpoint
                ? "Verified submissions from your site's forms show up here."
                : "Forms on a static site send to a small Cloudflare Worker that verifies the email and holds submissions until Blackwall collects them. Setting it up is the next step of this build."}
            </EmptyState>
          </Panel>
        </GridItem>
      </WorkspaceGrid>
    </>
  )
}
