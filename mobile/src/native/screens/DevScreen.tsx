import { Card, Screen, SampleBadge } from "../ui.tsx"

export function DevScreen(_props: { onOpenSettings: () => void }) {
  return (
    <Screen title="Dev" right={<SampleBadge />}>
      <Card title="Coming soon" />
    </Screen>
  )
}
