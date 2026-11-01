import { MapPinOff } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"

export function NotFound() {
  const { pathname } = useLocation()
  return (
    <>
      <PageHeader title="Page not found" />
      <Panel tool="cd" command={pathname} className="max-w-3xl">
        <EmptyState icon={MapPinOff} title="That page doesn't exist" action={<Button variant="outline" asChild><Link to="/">Go home</Link></Button>}>
          Use the sidebar, or press ⌘K to search.
        </EmptyState>
      </Panel>
    </>
  )
}
