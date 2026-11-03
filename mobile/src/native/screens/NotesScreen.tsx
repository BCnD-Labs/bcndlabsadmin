import { SampleBadge, Screen } from "../ui.tsx"
import { NotesView } from "./more/NotesView.tsx"

/** Top-level Notes screen: the sample Notes view under a title and the Sample data badge. */
export function NotesScreen() {
  return (
    <Screen title="Notes" right={<SampleBadge />}>
      <NotesView />
    </Screen>
  )
}
