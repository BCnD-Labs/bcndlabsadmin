import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../index.css"
import "../styles/countdown.css"
import "./mac.css"
import { MacApp } from "./mac-app"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MacApp />
  </StrictMode>,
)
