import { Card, Screen, SampleBadge } from "../ui.tsx"

export function LearningScreen(_props: { onOpenSettings: () => void }) {
  return (
    <Screen title="Learning" right={<SampleBadge />}>
      <Card title="Coming soon" />
    </Screen>
  )
}
