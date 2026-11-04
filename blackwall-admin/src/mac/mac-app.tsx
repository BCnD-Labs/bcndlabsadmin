import { RouterProvider } from "react-router-dom"
import { createBlackwallRouter } from "@/app-routes"
import { MacShell } from "./mac-shell"

const router = createBlackwallRouter(<MacShell />)

export function MacApp() {
  return <RouterProvider router={router} />
}
