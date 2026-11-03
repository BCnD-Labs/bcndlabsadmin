import { Card, Screen, SampleBadge } from "../ui.tsx"

export function PlannerScreen(_props: { onOpenSettings: () => void }) {
  return (
    <Screen title="Planner" right={<SampleBadge />}>
      <Card title="Coming soon" />
    </Screen>
  )
}
