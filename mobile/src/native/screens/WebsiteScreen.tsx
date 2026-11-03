import { SampleBadge, Screen } from "../ui.tsx"
import { WebsiteView } from "./more/WebsiteView.tsx"

/** Top-level Website screen: the sample Website view under a title and the Sample data badge. */
export function WebsiteScreen() {
  return (
    <Screen title="Website" right={<SampleBadge />}>
      <WebsiteView />
    </Screen>
  )
}
