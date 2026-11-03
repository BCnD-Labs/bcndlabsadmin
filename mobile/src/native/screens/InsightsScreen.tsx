import { SampleBadge, Screen } from "../ui.tsx"
import { InsightsView } from "./more/InsightsView.tsx"

/** Top-level Insights screen: the sample Insights view under a title and the Sample data badge. */
export function InsightsScreen() {
  return (
    <Screen title="Insights" right={<SampleBadge />}>
      <InsightsView />
    </Screen>
  )
}
