import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { docsHref } from "@/lib/routes"
import { useDocs } from "./docs-store"

/** When something asks to open a document, bring the Docs app forward. Lives in the app shell so any page can ask. */
export function DocsOpenHost() {
  const request = useDocs((s) => s.request)
  const navigate = useNavigate()
  useEffect(() => { if (request > 0) navigate(docsHref) }, [request, navigate])
  return null
}
