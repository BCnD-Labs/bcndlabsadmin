import { RouterProvider } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { createBlackwallRouter } from "./app-routes"

const router = createBlackwallRouter(<AppShell />)

export default function App() {
  return <RouterProvider router={router} />
}
