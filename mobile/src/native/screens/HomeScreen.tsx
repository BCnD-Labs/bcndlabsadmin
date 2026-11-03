import { Card, Screen, SampleBadge } from "../ui.tsx"

export function HomeScreen(_props: { onOpenSettings: () => void }) {
  return (
    <Screen title="Home" right={<SampleBadge />}>
      <Card title="Coming soon" />
    </Screen>
  )
}
